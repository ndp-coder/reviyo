// Sends owner emails from support@reviyo.in through the Hostinger mailbox
// (SMTP over TLS on port 465; Supabase blocks ports 25 and 587 for Edge
// Functions). Every email is claimed in the email_log table first, so the
// browser, the webhook, and the scheduler can all ask for the same receipt and
// it still goes out once.
//
// Email must never break a payment: every function here logs its own errors
// and returns. Without SMTP_PASSWORD set, nothing is sent (and nothing is
// claimed, so the scheduler sends it once the secret exists).

// @ts-types="npm:@types/nodemailer@8.0.2"
import nodemailer from "npm:nodemailer@10.0.12";
import type { AdminClient } from "./autopay.ts";
import {
  type Email,
  paymentFailedEmail,
  planEndingEmail,
  receiptEmail,
  renewalNoticeEmail,
  SENDER,
} from "./email-templates.ts";

type Kind = "receipt" | "renewal_notice" | "payment_failed" | "plan_ending";

/**
 * Lets an email finish after the response has been sent, so a slow mail
 * server never delays a payment confirmation or a Razorpay webhook reply.
 * Falls back to waiting where the runtime has no background tasks.
 */
export async function inBackground(task: Promise<unknown>): Promise<void> {
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime?.waitUntil) runtime.waitUntil(task);
  else await task;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function smtpConfig() {
  const password = Deno.env.get("SMTP_PASSWORD");
  if (!password) return null;
  return {
    hostname: Deno.env.get("SMTP_HOST") || "smtp.hostinger.com",
    port: Number(Deno.env.get("SMTP_PORT") || 465),
    username: Deno.env.get("SMTP_USER") || SENDER.supportEmail,
    password,
    from: Deno.env.get("EMAIL_FROM") || `${SENDER.brand} <${SENDER.supportEmail}>`,
  };
}

/** Sends one email now. Exported for the delivery test; everything else uses the send* functions. */
export async function sendEmail(to: string, email: Email): Promise<void> {
  const config = smtpConfig();
  if (!config) throw new Error("SMTP_PASSWORD is not set");
  const transport = nodemailer.createTransport({
    host: config.hostname,
    port: config.port,
    secure: config.port === 465,
    auth: { user: config.username, pass: config.password },
  });
  try {
    await transport.sendMail({
      from: config.from,
      to,
      replyTo: SENDER.supportEmail,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });
  } finally {
    transport.close();
  }
}

/** Claims, builds, and sends one email; releases the claim if it fails. */
async function sendOnce(
  admin: AdminClient,
  kind: Kind,
  ref: string,
  businessId: string,
  build: () => Promise<{ to: string; email: Email } | null>,
): Promise<boolean> {
  if (!smtpConfig()) {
    console.warn(`email: SMTP_PASSWORD is not set; ${kind} ${ref} not sent`);
    return false;
  }

  const { data: claimed, error: claimError } = await admin
    .from("email_log")
    .upsert({ kind, ref, business_id: businessId }, { onConflict: "kind,ref", ignoreDuplicates: true })
    .select("kind");
  if (claimError) {
    console.error(`email: could not claim ${kind} ${ref}:`, claimError.message);
    return false;
  }
  if (!claimed || claimed.length === 0) return false; // Already sent.

  try {
    const message = await build();
    if (!message) {
      await admin.from("email_log").delete().eq("kind", kind).eq("ref", ref);
      return false;
    }
    await sendEmail(message.to, message.email);
    return true;
  } catch (err) {
    console.error(`email: ${kind} ${ref} failed:`, err);
    await admin.from("email_log").delete().eq("kind", kind).eq("ref", ref);
    return false;
  }
}

async function businessAndOwner(admin: AdminClient, businessId: string) {
  const { data: business } = await admin
    .from("businesses")
    .select("name, owner_id")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) return null;
  const { data: profile } = await admin.from("profiles").select("email").eq("id", business.owner_id).maybeSingle();
  if (!profile?.email) return null;
  return { name: business.name as string, email: profile.email as string };
}

async function latestExpiry(admin: AdminClient, businessId: string): Promise<string | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("expires_at")
    .eq("business_id", businessId)
    .order("expires_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.expires_at as string | undefined) ?? null;
}

/** Payment receipt for a paid order (one-time purchase or AutoPay renewal). */
export async function sendReceipt(admin: AdminClient, orderId: string): Promise<boolean> {
  try {
    const { data: order } = await admin
      .from("payment_orders")
      .select("business_id, plan, amount, payment_id, kind, status, updated_at")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!order || order.status !== "paid" || !order.payment_id) return false;

    return await sendOnce(admin, "receipt", orderId, order.business_id, async () => {
      const owner = await businessAndOwner(admin, order.business_id);
      if (!owner) return null;
      return {
        to: owner.email,
        email: receiptEmail({
          businessName: owner.name,
          plan: order.plan,
          amountPaise: order.amount,
          paymentId: order.payment_id,
          orderId,
          paidAt: order.updated_at,
          accessUntil: await latestExpiry(admin, order.business_id),
          autopay: order.kind === "autopay",
        }),
      };
    });
  } catch (err) {
    console.error("email: receipt", orderId, err);
    return false;
  }
}

/** Our own notice before an AutoPay renewal charge (the bank sends one too). */
export async function sendRenewalNotice(admin: AdminClient, orderId: string): Promise<boolean> {
  try {
    const { data: order } = await admin
      .from("payment_orders")
      .select("business_id, plan, amount, kind, status, charge_after")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!order || order.kind !== "autopay" || order.status !== "created" || !order.charge_after) return false;

    return await sendOnce(admin, "renewal_notice", orderId, order.business_id, async () => {
      const owner = await businessAndOwner(admin, order.business_id);
      if (!owner) return null;
      return {
        to: owner.email,
        email: renewalNoticeEmail({
          businessName: owner.name,
          plan: order.plan,
          amountPaise: order.amount,
          chargeOn: order.charge_after,
        }),
      };
    });
  } catch (err) {
    console.error("email: renewal notice", orderId, err);
    return false;
  }
}

/** Tells the owner an AutoPay renewal failed. */
export async function sendPaymentFailed(admin: AdminClient, orderId: string): Promise<boolean> {
  try {
    const { data: order } = await admin
      .from("payment_orders")
      .select("business_id, plan, amount, kind, status")
      .eq("order_id", orderId)
      .maybeSingle();
    if (!order || order.kind !== "autopay" || order.status !== "failed") return false;

    return await sendOnce(admin, "payment_failed", orderId, order.business_id, async () => {
      const owner = await businessAndOwner(admin, order.business_id);
      if (!owner) return null;
      return {
        to: owner.email,
        email: paymentFailedEmail({
          businessName: owner.name,
          plan: order.plan,
          amountPaise: order.amount,
          accessUntil: await latestExpiry(admin, order.business_id),
        }),
      };
    });
  } catch (err) {
    console.error("email: payment failed", orderId, err);
    return false;
  }
}

/**
 * Catch-up pass for the scheduler: sends anything a browser or webhook did not
 * (receipts and failure notices from the last three days, notices for charges
 * waiting to go out), plus reminders for trials and plans ending within three
 * days that have no AutoPay to renew them.
 */
export async function sendPendingEmails(admin: AdminClient, summary: Record<string, number>): Promise<void> {
  if (!smtpConfig()) return;
  const since = new Date(Date.now() - 3 * DAY_MS).toISOString();
  const count = (key: string, sent: boolean) => {
    if (sent) summary[key] = (summary[key] ?? 0) + 1;
  };

  const { data: paid } = await admin
    .from("payment_orders")
    .select("order_id")
    .eq("status", "paid")
    .gte("updated_at", since)
    .limit(500);
  for (const o of paid ?? []) count("receipts_sent", await sendReceipt(admin, o.order_id));

  const { data: failed } = await admin
    .from("payment_orders")
    .select("order_id")
    .eq("kind", "autopay")
    .eq("status", "failed")
    .gte("updated_at", since)
    .limit(500);
  for (const o of failed ?? []) count("failure_notices_sent", await sendPaymentFailed(admin, o.order_id));

  const { data: upcoming } = await admin
    .from("payment_orders")
    .select("order_id")
    .eq("kind", "autopay")
    .eq("status", "created")
    .limit(500);
  for (const o of upcoming ?? []) count("renewal_notices_sent", await sendRenewalNotice(admin, o.order_id));

  // Trials and plans ending within three days, with no live AutoPay.
  const { data: ending } = await admin
    .from("subscriptions")
    .select("id, business_id, status, expires_at")
    .in("status", ["trial", "active"])
    .gt("expires_at", new Date().toISOString())
    .lte("expires_at", new Date(Date.now() + 3 * DAY_MS).toISOString())
    .limit(500);
  for (const s of ending ?? []) {
    try {
      const { data: live } = await admin
        .from("autopay_mandates")
        .select("id")
        .eq("business_id", s.business_id)
        .in("status", ["authorized", "active"])
        .limit(1);
      if (live && live.length > 0) continue;
      // Is this still the business's current term? A renewal may have added a later one.
      if ((await latestExpiry(admin, s.business_id)) !== s.expires_at) continue;

      const sent = await sendOnce(admin, "plan_ending", `${s.id}:${s.expires_at}`, s.business_id, async () => {
        const owner = await businessAndOwner(admin, s.business_id);
        if (!owner) return null;
        return {
          to: owner.email,
          email: planEndingEmail({ businessName: owner.name, endsOn: s.expires_at, isTrial: s.status === "trial" }),
        };
      });
      count("plan_ending_reminders_sent", sent);
    } catch (err) {
      console.error("email: plan ending", s.id, err);
    }
  }
}
