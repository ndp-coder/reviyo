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
// @ts-types="npm:@types/qrcode@1.5.6"
import QRCode from "npm:qrcode@1.5.4";
import type { AdminClient } from "./autopay.ts";
import {
  type Email,
  paymentFailedEmail,
  planEndingEmail,
  type PrintAddress,
  printAddressNeededEmail,
  printOrderEmail,
  printOrderPlacedEmail,
  printShippedEmail,
  receiptEmail,
  renewalNoticeEmail,
  SENDER,
} from "./email-templates.ts";
import { type QrMatrix, STAND_SOURCE, standSvg, TENT_CARD_SOURCE, tentCardSvg } from "./print-artwork.ts";

type Kind =
  | "receipt"
  | "renewal_notice"
  | "payment_failed"
  | "plan_ending"
  | "print_order"
  | "print_order_placed"
  | "print_address_needed"
  | "print_shipped";

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
      attachments: email.attachments,
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

// ============================================
// Free printed QR kit
// ============================================

/** Where print orders go: the print partner, or our own inbox to forward. */
const printOrderEmailAddress = () => Deno.env.get("PRINT_ORDER_EMAIL")?.trim() || SENDER.supportEmail;

const PRINT_ORDER_COLUMNS =
  "id, business_id, status, recipient_name, phone, address_line1, address_line2, city, state, pincode, business_name, courier, tracking_number, sent_to_printer_at";

interface PrintOrderRow extends PrintAddress {
  id: string;
  business_id: string;
  status: string;
  business_name: string | null;
  courier: string | null;
  tracking_number: string | null;
  sent_to_printer_at: string | null;
}

/** Short, readable reference for the printer and support: "RV-1A2B3C4D". */
export const printOrderRef = (orderId: string) => `RV-${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

function qrMatrix(text: string): QrMatrix {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  return { size: modules.size, isDark: (row: number, col: number) => Boolean(modules.get(row, col)) };
}

/** Same link and ?src the dashboard preview uses (src/lib/print-artwork.ts). */
const printedReviewUrl = (slug: string, source: string) =>
  `${SENDER.siteUrl.replace(/\/+$/, "")}/r/${encodeURIComponent(slug)}?src=${encodeURIComponent(source)}`;

async function wasSent(admin: AdminClient, kind: Kind, ref: string): Promise<boolean> {
  const { data } = await admin.from("email_log").select("kind").eq("kind", kind).eq("ref", ref).maybeSingle();
  return Boolean(data);
}

/**
 * Sends a ready print order to the printer. The order is claimed first
 * (ready -> sent_to_printer), which freezes the address the owner can still
 * edit until then; if the email does not go out, the claim is undone so the
 * next run tries again. Then the owner gets a confirmation.
 */
export async function sendPrintOrder(admin: AdminClient, businessId: string): Promise<boolean> {
  try {
    if (!smtpConfig()) return false;
    const { data: business } = await admin.from("businesses").select("name, slug").eq("id", businessId).maybeSingle();
    if (!business) return false;

    const { data: claimed, error: claimError } = await admin
      .from("qr_print_orders")
      .update({
        status: "sent_to_printer",
        sent_to_printer_at: new Date().toISOString(),
        business_name: business.name,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .eq("status", "ready")
      .select(PRINT_ORDER_COLUMNS)
      .maybeSingle();
    if (claimError) {
      console.error("print order: could not claim", businessId, claimError.message);
      return false;
    }
    if (!claimed) return false; // Not ready, or another run has it.
    const order = claimed as PrintOrderRow;

    const sent = await deliverPrintOrder(admin, order, business.name as string, business.slug as string);
    if (!sent) {
      await admin
        .from("qr_print_orders")
        .update({ status: "ready", sent_to_printer_at: null, updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .eq("status", "sent_to_printer");
      return false;
    }
    await sendPrintOrderPlaced(admin, order);
    return true;
  } catch (err) {
    console.error("print order", businessId, err);
    return false;
  }
}

/** The printer email itself, sent once per order. True once it has gone out. */
async function deliverPrintOrder(admin: AdminClient, order: PrintOrderRow, name: string, slug: string): Promise<boolean> {
  const ref = printOrderRef(order.id);
  const standFile = `${ref}-table-stand-4x6in.svg`;
  const tentCardFile = `${ref}-table-tent-card-105x296mm.svg`;
  const sent = await sendOnce(admin, "print_order", order.id, order.business_id, async () => ({
    to: printOrderEmailAddress(),
    email: {
      ...printOrderEmail({ orderRef: ref, businessName: name, address: order, standFile, tentCardFile }),
      attachments: [
        { filename: standFile, content: standSvg(name, qrMatrix(printedReviewUrl(slug, STAND_SOURCE))), contentType: "image/svg+xml" },
        {
          filename: tentCardFile,
          content: tentCardSvg(name, qrMatrix(printedReviewUrl(slug, TENT_CARD_SOURCE))),
          contentType: "image/svg+xml",
        },
      ],
    },
  }));
  // false also means "already sent earlier"; the log says which.
  return sent || (await wasSent(admin, "print_order", order.id));
}

async function sendPrintOrderPlaced(admin: AdminClient, order: PrintOrderRow): Promise<boolean> {
  return await sendOnce(admin, "print_order_placed", order.id, order.business_id, async () => {
    const owner = await businessAndOwner(admin, order.business_id);
    if (!owner) return null;
    return { to: owner.email, email: printOrderPlacedEmail({ businessName: owner.name, address: order }) };
  });
}

/** Asks the owner for a delivery address, once, when a paid order has none. */
export async function sendPrintAddressNeeded(admin: AdminClient, businessId: string): Promise<boolean> {
  try {
    const { data: order } = await admin
      .from("qr_print_orders")
      .select("id, status")
      .eq("business_id", businessId)
      .maybeSingle();
    if (!order || order.status !== "awaiting_address") return false;
    return await sendOnce(admin, "print_address_needed", order.id, businessId, async () => {
      const owner = await businessAndOwner(admin, businessId);
      if (!owner) return null;
      return { to: owner.email, email: printAddressNeededEmail({ businessName: owner.name }) };
    });
  } catch (err) {
    console.error("email: print address needed", businessId, err);
    return false;
  }
}

/** Tells the owner the kit shipped, with the tracking number, once. */
async function sendPrintShipped(admin: AdminClient, order: PrintOrderRow): Promise<boolean> {
  if (order.status !== "shipped" || !order.courier || !order.tracking_number) return false;
  return await sendOnce(admin, "print_shipped", order.id, order.business_id, async () => {
    const owner = await businessAndOwner(admin, order.business_id);
    if (!owner) return null;
    return {
      to: owner.email,
      email: printShippedEmail({
        businessName: owner.name,
        courier: order.courier as string,
        trackingNumber: order.tracking_number as string,
        address: order,
      }),
    };
  });
}

/**
 * Everything a payment can start: the receipt, then the printed QR kit (sent
 * to the printer if the address is in, otherwise a request for the address).
 * Used by the payment Edge Functions right after an order is paid.
 */
export async function sendAfterPayment(admin: AdminClient, orderId: string): Promise<void> {
  await sendReceipt(admin, orderId);
  try {
    const { data: order } = await admin.from("payment_orders").select("business_id, status").eq("order_id", orderId).maybeSingle();
    if (!order || order.status !== "paid") return;
    if (!(await sendPrintOrder(admin, order.business_id))) {
      await sendPrintAddressNeeded(admin, order.business_id);
    }
  } catch (err) {
    console.error("email: after payment", orderId, err);
  }
}

/** Scheduler catch-up for print orders: ready ones, missing address requests, shipping notices. */
async function sendPendingPrintEmails(admin: AdminClient, count: (key: string, sent: boolean) => void): Promise<void> {
  const { data: ready } = await admin.from("qr_print_orders").select("business_id").eq("status", "ready").limit(100);
  for (const o of ready ?? []) count("print_orders_sent", await sendPrintOrder(admin, o.business_id));

  // A run that stopped between claiming an order and emailing it.
  const stale = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: claimed } = await admin
    .from("qr_print_orders")
    .select(PRINT_ORDER_COLUMNS)
    .eq("status", "sent_to_printer")
    .lt("sent_to_printer_at", stale)
    .limit(100);
  for (const row of (claimed ?? []) as PrintOrderRow[]) {
    try {
      if (await wasSent(admin, "print_order", row.id)) {
        await sendPrintOrderPlaced(admin, row);
        continue;
      }
      const { data: business } = await admin.from("businesses").select("name, slug").eq("id", row.business_id).maybeSingle();
      if (!business) continue;
      if (await deliverPrintOrder(admin, row, row.business_name ?? (business.name as string), business.slug as string)) {
        count("print_orders_sent", true);
        await sendPrintOrderPlaced(admin, row);
      }
    } catch (err) {
      console.error("print order: retry", row.id, err);
    }
  }

  const { data: waiting } = await admin.from("qr_print_orders").select("business_id").eq("status", "awaiting_address").limit(200);
  for (const o of waiting ?? []) count("print_address_requests_sent", await sendPrintAddressNeeded(admin, o.business_id));

  const recent = new Date(Date.now() - 7 * DAY_MS).toISOString();
  const { data: shipped } = await admin
    .from("qr_print_orders")
    .select(PRINT_ORDER_COLUMNS)
    .eq("status", "shipped")
    .gte("updated_at", recent)
    .limit(100);
  for (const row of (shipped ?? []) as PrintOrderRow[]) {
    try {
      count("print_shipped_notices_sent", await sendPrintShipped(admin, row));
    } catch (err) {
      console.error("email: print shipped", row.id, err);
    }
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

  await sendPendingPrintEmails(admin, count);
}
