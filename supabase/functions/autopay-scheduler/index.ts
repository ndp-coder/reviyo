// Edge Function: autopay-scheduler
// Runs on a schedule (pg_cron, every few hours). Never called by browsers.
//
// Each run:
//   1. Prepares charges: for every mandate whose trial/term ends within three
//      days, creates a Razorpay order with a pre-debit notification (required
//      by RBI/NPCI: at least 24h for UPI, 36h for cards before the debit).
//   2. Charges: for prepared orders whose notice period has passed, asks
//      Razorpay to debit the mandate. The order row is claimed first, so a
//      second run can never charge twice.
//   3. Reconciles: charges with no webhook after two days are checked with
//      Razorpay directly, and ₹1 setups that were paid but never finished
//      (closed tab, missed webhook) are completed and refunded.
//
// Charge results normally arrive through razorpay-webhook.

import {
  type AdminClient,
  createAdminClient,
  one,
  finalizeAutopayAuthorization,
  razorpay,
  refundAuthorization,
} from "../_shared/autopay.ts";
import { sendPendingEmails } from "../_shared/email.ts";

// Pre-debit notice we wait for before debiting. Cards need 36h 5m after the
// notice is delivered; UPI 24h. Two extra hours covers delivery delay.
const NOTICE_MS = 38 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Admin = AdminClient;

async function prepareCharges(admin: Admin, summary: Record<string, number>) {
  const { data: due, error } = await admin.rpc("autopay_mandates_due_for_charge");
  if (error) throw new Error(`Could not list due mandates: ${error.message}`);

  for (const m of due ?? []) {
    try {
      // Charge a day before the term ends so access never lapses, but never
      // sooner than the notice period allows.
      const expiresAt = new Date(m.expires_at).getTime();
      const chargeAfter = new Date(Math.max(expiresAt - ONE_DAY_MS, Date.now() + NOTICE_MS));

      const order = await razorpay("/orders", {
        method: "POST",
        body: {
          amount: m.amount,
          currency: "INR",
          payment_capture: true,
          receipt: `autopay_${Date.now().toString(36)}`,
          notification: {
            token_id: m.token_id,
            payment_after: Math.floor(chargeAfter.getTime() / 1000),
          },
          notes: { purpose: "autopay_charge", mandate_id: m.mandate_id, business_id: m.business_id, plan: m.plan },
        },
      });

      const { error: insertError } = await admin.from("payment_orders").insert({
        business_id: m.business_id,
        user_id: m.user_id,
        order_id: order.id,
        plan: m.plan,
        amount: order.amount,
        currency: order.currency,
        status: "created",
        receipt: order.receipt,
        kind: "autopay",
        mandate_id: m.mandate_id,
        charge_after: chargeAfter.toISOString(),
        metadata: { razorpay_order_id: order.id, notes: order.notes },
      });
      if (insertError) {
        // Another run prepared this mandate first (unique in-flight index).
        // The order just created here is never charged, so it is harmless.
        console.warn("autopay-scheduler: charge already prepared", m.mandate_id, insertError.message);
        continue;
      }
      summary.prepared += 1;
    } catch (err) {
      summary.errors += 1;
      console.error("autopay-scheduler: could not prepare charge", m.mandate_id, err);
    }
  }
}

async function sendCharges(admin: Admin, summary: Record<string, number>) {
  const { data: orders, error } = await admin
    .from("payment_orders")
    .select("id, order_id, amount, currency, mandate_id, autopay_mandates!inner(status, razorpay_customer_id, token_id, auth_payment_id)")
    .eq("kind", "autopay")
    .eq("status", "created")
    .lte("charge_after", new Date().toISOString());
  if (error) throw new Error(`Could not list charges: ${error.message}`);

  for (const o of orders ?? []) {
    const mandate = one(o.autopay_mandates);
    const now = new Date().toISOString();

    if (!mandate || !["authorized", "active"].includes(mandate.status)) {
      // Cancelled, paused, or failed since the charge was prepared: never send it.
      await admin.from("payment_orders").update({ status: "failed", updated_at: now }).eq("id", o.id).eq("status", "created");
      continue;
    }

    // Claim the order. Only the run that flips created -> attempted may charge.
    const { data: claimed } = await admin
      .from("payment_orders")
      .update({ status: "attempted", attempted_at: now, updated_at: now })
      .eq("id", o.id)
      .eq("status", "created")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    try {
      // Razorpay needs the payer's email and phone; reuse the ones from the
      // ₹1 setup payment rather than storing them ourselves.
      const authPayment = await razorpay(`/payments/${encodeURIComponent(mandate.auth_payment_id)}`);
      await razorpay("/payments/create/recurring", {
        method: "POST",
        body: {
          email: authPayment.email,
          contact: authPayment.contact,
          amount: o.amount,
          currency: o.currency,
          order_id: o.order_id,
          customer_id: mandate.razorpay_customer_id,
          token: mandate.token_id,
          recurring: true,
          description: "Reviyo plan renewal",
        },
      });
      summary.charged += 1;
    } catch (err) {
      summary.errors += 1;
      console.error("autopay-scheduler: charge request failed", o.order_id, err);
      await admin.rpc("settle_autopay_charge", { p_order_id: o.order_id, p_payment_id: null, p_captured: false });
    }
  }
}

async function reconcileStaleCharges(admin: Admin, summary: Record<string, number>) {
  const staleBefore = new Date(Date.now() - 2 * ONE_DAY_MS).toISOString();
  const { data: orders } = await admin
    .from("payment_orders")
    .select("order_id")
    .eq("kind", "autopay")
    .eq("status", "attempted")
    .lte("attempted_at", staleBefore);

  for (const o of orders ?? []) {
    try {
      const payments = await razorpay(`/orders/${encodeURIComponent(o.order_id)}/payments`);
      const items: Array<{ id: string; status: string }> = payments?.items ?? [];
      const captured = items.find((p) => p.status === "captured");
      if (captured) {
        await admin.rpc("settle_autopay_charge", { p_order_id: o.order_id, p_payment_id: captured.id, p_captured: true });
        summary.reconciled += 1;
      } else if (items.length > 0 && items.every((p) => p.status === "failed")) {
        await admin.rpc("settle_autopay_charge", { p_order_id: o.order_id, p_payment_id: items[0].id, p_captured: false });
        summary.reconciled += 1;
      }
    } catch (err) {
      console.error("autopay-scheduler: could not reconcile", o.order_id, err);
    }
  }
}

async function completeUnfinishedSetups(admin: Admin, summary: Record<string, number>) {
  const settledBefore = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Paid ₹1 whose trial never started (browser closed and webhook missed).
  const { data: pending } = await admin
    .from("autopay_mandates")
    .select("auth_order_id")
    .eq("status", "created")
    .lte("created_at", settledBefore)
    .gte("created_at", new Date(Date.now() - 3 * ONE_DAY_MS).toISOString());

  for (const m of pending ?? []) {
    try {
      const payments = await razorpay(`/orders/${encodeURIComponent(m.auth_order_id)}/payments`);
      const paid = (payments?.items ?? []).find(
        (p: { status: string }) => p.status === "captured" || p.status === "authorized",
      );
      if (paid) {
        await finalizeAutopayAuthorization(admin, m.auth_order_id, paid.id);
        summary.setups_completed += 1;
      }
    } catch (err) {
      console.error("autopay-scheduler: could not complete setup", m.auth_order_id, err);
    }
  }

  // ₹1 refunds that failed earlier.
  const { data: unrefunded } = await admin
    .from("autopay_mandates")
    .select("id, auth_payment_id")
    .not("auth_payment_id", "is", null)
    .is("auth_refund_id", null)
    .lte("updated_at", settledBefore);

  for (const m of unrefunded ?? []) {
    if (await refundAuthorization(admin, m.id, m.auth_payment_id)) summary.refunds_retried += 1;
  }
}

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const expected = Deno.env.get("AUTOPAY_CRON_SECRET") ?? "";
  const provided = req.headers.get("x-cron-secret") ?? "";
  if (expected.length < 32 || !timingSafeEqual(provided, expected)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const summary: Record<string, number> = {
    prepared: 0,
    charged: 0,
    reconciled: 0,
    setups_completed: 0,
    refunds_retried: 0,
    errors: 0,
  };

  try {
    const admin = await createAdminClient();
    await completeUnfinishedSetups(admin, summary);
    await reconcileStaleCharges(admin, summary);
    await sendCharges(admin, summary);
    await prepareCharges(admin, summary);
    // Renewal notices for the charges just prepared, plus receipts, failure
    // notices, and plan-ending reminders that nothing else has sent yet.
    try {
      await sendPendingEmails(admin, summary);
    } catch (err) {
      console.error("autopay-scheduler: emails", err);
    }
    console.log("autopay-scheduler run", summary);
    return json({ ok: true, ...summary });
  } catch (err) {
    console.error("autopay-scheduler error:", err);
    return json({ ok: false, ...summary }, 500);
  }
});
