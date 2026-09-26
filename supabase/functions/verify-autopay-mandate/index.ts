// Edge Function: verify-autopay-mandate
// Called by the browser after the ₹1 AutoPay authorisation succeeds in
// Razorpay Checkout. Verifies the signature, then captures and refunds the ₹1
// and starts the 14-day trial. The webhook does the same if the browser never
// gets here (for example, the tab was closed).

import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";
import { createAdminClient, finalizeAutopayAuthorization, one, verifyHmacSha256 } from "../_shared/autopay.ts";

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (!isAllowedBrowserOrigin(req)) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers: { "Content-Type": "application/json", "Vary": "Origin" },
    });
  }
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const accessToken = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    if (!accessToken) return json({ error: "Please sign in again." }, 401);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const orderId = typeof body.razorpay_order_id === "string" ? body.razorpay_order_id : "";
    const paymentId = typeof body.razorpay_payment_id === "string" ? body.razorpay_payment_id : "";
    const signature = typeof body.razorpay_signature === "string" ? body.razorpay_signature : "";
    if (!orderId || !paymentId || !signature) {
      return json({ error: "Missing payment details" }, 400);
    }

    const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!keySecret) return json({ error: "Payments are not configured yet." }, 503);

    const admin = await createAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData?.user) return json({ error: "Please sign in again." }, 401);

    // The setup must belong to a business this user owns.
    const { data: mandate } = await admin
      .from("autopay_mandates")
      .select("id, business_id, businesses!inner(owner_id)")
      .eq("auth_order_id", orderId)
      .maybeSingle();
    if (!mandate || one(mandate.businesses)?.owner_id !== userData.user.id) {
      return json({ error: "AutoPay setup not found" }, 404);
    }

    if (!(await verifyHmacSha256(`${orderId}|${paymentId}`, keySecret, signature))) {
      console.error("verify-autopay-mandate: signature mismatch for order", orderId);
      return json({ error: "Invalid payment signature" }, 400);
    }

    const result = await finalizeAutopayAuthorization(admin, orderId, paymentId);
    return json({
      success: true,
      trial_started: result?.trial_started ?? false,
      subscription: result?.subscription ?? null,
    });
  } catch (err) {
    console.error("verify-autopay-mandate error:", err);
    return json(
      { error: "We received your payment but could not finish setting up AutoPay. It will complete automatically within a few minutes." },
      500,
    );
  }
});
