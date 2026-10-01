import { type AdminClient, razorpay } from "./autopay.ts";

export async function razorpayX(path: string, body?: unknown, idempotency?: string): Promise<Record<string, unknown>> {
  const key = Deno.env.get("RAZORPAYX_KEY_ID");
  const secret = Deno.env.get("RAZORPAYX_KEY_SECRET");
  if (!key || !secret) throw new Error("RazorpayX is not configured");
  const headers: Record<string, string> = { Authorization: `Basic ${btoa(`${key}:${secret}`)}`, "Content-Type": "application/json" };
  if (idempotency) headers["X-Payout-Idempotency"] = idempotency;
  const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET", headers, body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  // Do not log responses: contacts and fund accounts contain bank details.
  if (!response.ok) throw new Error(`RazorpayX request failed (${response.status})`);
  return await response.json();
}

export function paymentQualifies(payment: Record<string, unknown>, order: string, recordedPaidAt: string, now = Date.now()): boolean {
  const created = Number(payment.created_at) * 1000;
  const recorded = Date.parse(recordedPaidAt);
  return payment.status === "captured" && payment.captured === true && payment.order_id === order
    && payment.amount === 299900 && payment.currency === "INR" && payment.amount_refunded === 0
    && !payment.refund_status && Number.isFinite(created) && Number.isFinite(recorded)
    && Math.max(created, recorded) <= now - 14 * 86400000;
}

async function disputedPayments(): Promise<Set<string>> {
  const ids = new Set<string>(); const seen = new Set<string>();
  for (let skip = 0; skip < 10000; skip += 100) {
    const result = await razorpay(`/disputes?count=100&skip=${skip}`);
    if (!Array.isArray(result.items)) throw new Error("Could not check disputes");
    for (const item of result.items) {
      if (typeof item.id !== "string" || seen.has(item.id) || typeof item.payment_id !== "string") throw new Error("Incomplete dispute listing");
      seen.add(item.id); ids.add(item.payment_id);
    }
    if (result.items.length < 100) return ids;
  }
  throw new Error("Dispute listing limit reached; review required");
}

function payoutStatus(result: Record<string, unknown>): string {
  const status = String(result.status);
  if (status === "pending") return "processing"; // Waiting for RazorpayX approval.
  return ["queued", "processing", "processed", "failed", "reversed", "cancelled"].includes(status) ? status : "needs_attention";
}

export async function savePayout(admin: AdminClient, id: string, result: Record<string, unknown>, body: Record<string, unknown>, expectedStatus: string) {
  if (typeof result.id !== "string" || !result.id.startsWith("pout_") || result.amount !== body.amount
    || result.currency !== "INR" || result.fund_account_id !== body.fund_account_id || result.reference_id !== id) {
    throw new Error("Payout identity mismatch; reconciliation required");
  }
  // Optimistic update: a delayed worker cannot overwrite a newer result.
  const { error } = await admin.from("commission_earnings").update({
    payout_id: result.id, status: payoutStatus(result), last_checked_at: new Date().toISOString(),
    detail: ["failed", "reversed", "cancelled"].includes(String(result.status)) ? "RazorpayX transfer did not complete. Developer review required." : null,
  }).eq("id", id).eq("status", expectedStatus);
  if (error) throw error;
}

// Automatic reconciliation uses the provider's authoritative status. Unknown
// results are retried with the SAME key/body, never a fresh transfer.
export async function runCommissions(admin: AdminClient): Promise<Record<string, number>> {
  const summary = { qualified: 0, submitted: 0, reconciled: 0, errors: 0 };
  if (Deno.env.get("COMMISSION_PAYOUTS_ENABLED") !== "true") return summary;
  const account = Deno.env.get("RAZORPAYX_ACCOUNT_NUMBER");
  if (!account) throw new Error("RazorpayX source account is not configured");
  const disputed = await disputedPayments();
  const { data: candidates, error } = await admin.rpc("commission_candidates");
  if (error) throw error;
  for (const c of (candidates ?? []).slice(0, 20)) {
    try {
      const payment = await razorpay(`/payments/${encodeURIComponent(c.payment_id)}`);
      if (payment.id !== c.payment_id) continue;
      if (!c.capture_verified_at) {
        // Fulfilment can happen at authorisation. Start the hold only after
        // observing actual capture, never from an authorised-only payment.
        if (paymentQualifies(payment, c.razorpay_order_id, c.paid_at, Date.now() + 14 * 86400000) && !disputed.has(c.payment_id)) {
          const { error: captureError } = await admin.from("commission_referrals").update({ capture_verified_at: new Date().toISOString() })
            .eq("id", c.referral_id).is("capture_verified_at", null);
          if (captureError) throw captureError;
        }
        continue;
      }
      if (!paymentQualifies(payment, c.razorpay_order_id, c.capture_verified_at)) continue;
      // A captured payment can still be disputed. Fail closed if the provider
      // cannot answer, or if any dispute exists for this payment.
      if (disputed.has(c.payment_id)) continue;
      const { data: qualified, error: qualifyError } = await admin.rpc("qualify_commission", { p_referral_id: c.referral_id, p_order_id: c.payment_order_id });
      if (qualifyError) throw qualifyError;
      if (qualified) summary.qualified++;
    } catch { summary.errors++; }
    finally {
      await admin.from("commission_referrals").update({ last_checked_at: new Date().toISOString() }).eq("id", c.referral_id);
    }
  }
  const { data: earnings, error: earningsError } = await admin.from("commission_earnings")
    .select("id,partner_id,referral_id,milestone,kind,payout_id,payout_body,status")
    .in("status", ["pending", "sending", "queued", "processing", "processed"])
    .or(`last_checked_at.is.null,last_checked_at.lt.${new Date(Date.now() - 3600000).toISOString()}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true }).order("id").limit(20);
  if (earningsError) throw earningsError;
  for (const e of earnings ?? []) {
    try {
      if (e.payout_id) {
        const result = await razorpayX(`payouts/${encodeURIComponent(e.payout_id)}`);
        await savePayout(admin, e.id, result, e.payout_body, e.status);
        summary.reconciled++;
      } else {
        if (e.status === "pending") {
          const { data: refs, error: refsError } = await admin.from("commission_referrals")
            .select("id,qualified_at,capture_verified_at,payment_orders!inner(payment_id,order_id)")
            .eq("partner_id", e.partner_id).not("qualified_at", "is", null).order("qualified_at").order("id")
            .limit(e.kind === "bonus" ? e.milestone : 1)
            .eq(e.kind === "bonus" ? "partner_id" : "id", e.kind === "bonus" ? e.partner_id : e.referral_id);
          if (refsError) throw refsError;
          if (!refs?.length || (e.kind === "bonus" && refs.length < e.milestone)) throw new Error("Referral records unavailable");
          for (const r of refs) {
            const order = Array.isArray(r.payment_orders) ? r.payment_orders[0] : r.payment_orders;
            const payment = await razorpay(`/payments/${encodeURIComponent(order.payment_id)}`);
            if (payment.id !== order.payment_id || !paymentQualifies(payment, order.order_id, r.capture_verified_at) || disputed.has(order.payment_id)) {
              const { error: holdError } = await admin.from("commission_earnings").update({ status: "needs_attention", detail: "A qualifying payment was refunded, disputed, or unavailable. Transfer paused for developer review." }).eq("id", e.id).eq("status", "pending");
              if (holdError) throw holdError;
              throw new Error("Payment no longer qualifies");
            }
          }
        }
        const { data: body, error: prepareError } = await admin.rpc("prepare_commission_payout", { p_id: e.id, p_account: account });
        if (prepareError) throw prepareError;
        if (!body) {
          await admin.from("commission_earnings").update({ last_checked_at: new Date().toISOString() }).eq("id", e.id);
          continue;
        }
        const result = await razorpayX("payouts", body, e.id);
        await savePayout(admin, e.id, result, body, "sending");
        summary.submitted++;
      }
    } catch {
      summary.errors++;
      await admin.from("commission_earnings").update({ last_checked_at: new Date().toISOString(), detail: "Transfer check failed; automatic reconciliation will retry safely." })
        .eq("id", e.id).in("status", ["pending", "sending", "queued", "processing", "processed"]);
    }
  }
  return summary;
}
