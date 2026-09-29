// Edge Function: razorpay-webhook
// Handles asynchronous Razorpay webhook events.
//
// Enable these events in the Razorpay dashboard:
//   payment.authorized, payment.captured, payment.failed, order.paid,
//   token.confirmed, token.rejected, token.paused, token.cancelled
//
// Every handler below is idempotent, because Razorpay may deliver an event
// more than once and several events describe the same payment.

import {
  type AdminClient,
  createAdminClient,
  finalizeAutopayAuthorization,
  verifyHmacSha256,
} from "../_shared/autopay.ts";
import { inBackground, sendPaymentFailed, sendReceipt } from "../_shared/email.ts";

const jsonHeaders = { "Content-Type": "application/json" };

type Admin = AdminClient;

const TOKEN_STATUS: Record<string, { status: string; from: string[] }> = {
  "token.confirmed": { status: "active", from: ["authorized", "paused"] },
  "token.paused": { status: "paused", from: ["authorized", "active"] },
  "token.rejected": { status: "rejected", from: ["created", "authorized", "active", "paused"] },
  "token.cancelled": { status: "cancelled", from: ["created", "authorized", "active", "paused", "failed"] },
};

async function handleTokenEvent(admin: Admin, eventType: string, tokenId: string | undefined) {
  const transition = TOKEN_STATUS[eventType];
  if (!transition || !tokenId) return;
  const now = new Date().toISOString();
  const { error } = await admin
    .from("autopay_mandates")
    .update({
      status: transition.status,
      updated_at: now,
      ...(transition.status === "cancelled" ? { cancelled_at: now } : {}),
    })
    .eq("token_id", tokenId)
    .in("status", transition.from);
  if (error) throw new Error(`Could not update mandate: ${error.message}`);
}

async function handlePaymentEvent(admin: Admin, eventType: string, orderId: string, paymentId: string) {
  // 1. The ₹1 AutoPay setup payment.
  const { data: mandate } = await admin
    .from("autopay_mandates")
    .select("id")
    .eq("auth_order_id", orderId)
    .maybeSingle();
  if (mandate) {
    if (eventType !== "payment.failed") {
      try {
        await finalizeAutopayAuthorization(admin, orderId, paymentId);
      } catch (err) {
        // Acknowledge anyway: autopay-scheduler finishes paid setups on its next
        // run, and retrying a permanent error here would only get the webhook
        // disabled by Razorpay.
        console.error("razorpay-webhook: could not finish AutoPay setup", orderId, err);
      }
    }
    return;
  }

  // 2. A plan purchase or an AutoPay renewal charge.
  const { data: order } = await admin
    .from("payment_orders")
    .select("kind")
    .eq("order_id", orderId)
    .maybeSingle();
  if (!order) return; // Not ours (for example, another app on the same account).

  if (order.kind === "autopay") {
    if (eventType === "payment.authorized") return; // captured automatically
    const { error } = await admin.rpc("settle_autopay_charge", {
      p_order_id: orderId,
      p_payment_id: paymentId,
      p_captured: eventType !== "payment.failed",
    });
    if (error) throw new Error(`Could not settle AutoPay charge: ${error.message}`);
    await inBackground(eventType === "payment.failed" ? sendPaymentFailed(admin, orderId) : sendReceipt(admin, orderId));
    return;
  }

  // One-time purchase. The database resolves trusted plan/business data from
  // the stored order, locks it, and makes duplicate delivery harmless.
  if (eventType === "order.paid" || eventType === "payment.captured") {
    const { error } = await admin.rpc("process_paid_order", {
      p_order_id: orderId,
      p_payment_id: paymentId,
    });
    if (error) throw new Error(`Failed to process paid order: ${error.message}`);
    await inBackground(sendReceipt(admin, orderId));
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: jsonHeaders,
    });
  }

  try {
    const webhookSignature = req.headers.get("x-razorpay-signature");
    const webhookSecret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET");

    if (!webhookSecret) {
      console.error("RAZORPAY_WEBHOOK_SECRET is not configured");
      return new Response(JSON.stringify({ error: "Webhook is not configured" }), {
        status: 503,
        headers: jsonHeaders,
      });
    }

    if (!webhookSignature) {
      return new Response(JSON.stringify({ error: "Missing signature" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const rawBody = await req.text();

    const isValid = await verifyHmacSha256(rawBody, webhookSecret, webhookSignature);
    if (!isValid) {
      console.error("Razorpay webhook signature verification failed");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: jsonHeaders,
      });
    }

    const event = JSON.parse(rawBody);
    const eventType: string = event.event;
    const admin = await createAdminClient();

    if (eventType.startsWith("token.")) {
      await handleTokenEvent(admin, eventType, event.payload?.token?.entity?.id);
    } else if (
      eventType === "order.paid" ||
      eventType === "payment.captured" ||
      eventType === "payment.authorized" ||
      eventType === "payment.failed"
    ) {
      const paymentEntity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const orderId = paymentEntity?.order_id || orderEntity?.id;
      const paymentId = paymentEntity?.id;
      if (orderId && paymentId) {
        await handlePaymentEvent(admin, eventType, orderId, paymentId);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: jsonHeaders,
    });
  } catch (err) {
    // A 500 makes Razorpay retry the delivery later.
    console.error("razorpay-webhook error:", err);
    return new Response(
      JSON.stringify({ error: "Internal webhook error" }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
