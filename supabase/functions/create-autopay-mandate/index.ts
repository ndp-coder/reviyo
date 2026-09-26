// Edge Function: create-autopay-mandate
// Starts an AutoPay setup: creates (or reuses) the Razorpay customer and a ₹1
// authorisation order that registers a recurring mandate capped at the plan
// price. The browser then opens Razorpay Checkout with that order.

import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";
import {
  AUTH_AMOUNT,
  AUTOPAY_PLAN_PRICES,
  createAdminClient,
  razorpay,
  razorpayConfigured,
  RazorpayApiError,
} from "../_shared/autopay.ts";

// Mandates last five years; the owner can cancel at any time before that.
const MANDATE_VALIDITY_SECONDS = 5 * 365 * 24 * 60 * 60;

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
    const businessId = typeof body.business_id === "string" ? body.business_id : "";
    const plan = typeof body.plan === "string" ? body.plan : "";
    const method = body.method === "upi" || body.method === "card" ? body.method : null;
    const consentVersion = typeof body.consent_version === "string" ? body.consent_version.trim() : "";

    if (!businessId) return json({ error: "Missing business" }, 400);
    if (!(plan in AUTOPAY_PLAN_PRICES)) return json({ error: "Choose the 6-month or 12-month plan." }, 400);
    if (!method) return json({ error: "Choose UPI or card." }, 400);
    if (!consentVersion || consentVersion.length > 40) {
      return json({ error: "Please accept the AutoPay terms to continue." }, 400);
    }

    if (!razorpayConfigured()) {
      return json({ error: "Payments are not configured yet.", code: "RAZORPAY_NOT_CONFIGURED" }, 503);
    }

    const admin = await createAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData?.user) return json({ error: "Please sign in again." }, 401);
    const user = userData.user;

    const { data: business, error: businessError } = await admin
      .from("businesses")
      .select("id, owner_id, name")
      .eq("id", businessId)
      .maybeSingle();
    if (businessError || !business || business.owner_id !== user.id) {
      return json({ error: "Unauthorized access to business" }, 403);
    }

    const { data: liveMandate } = await admin
      .from("autopay_mandates")
      .select("id")
      .eq("business_id", business.id)
      .in("status", ["authorized", "active", "paused"])
      .maybeSingle();
    if (liveMandate) {
      return json({ error: "AutoPay is already set up for this business." }, 409);
    }

    const { data: profile } = await admin.from("profiles").select("full_name").eq("id", user.id).maybeSingle();

    // fail_existing "0" returns the existing customer for this email instead of erroring.
    const customer = await razorpay("/customers", {
      method: "POST",
      body: {
        name: (profile?.full_name || business.name).slice(0, 50),
        email: user.email,
        fail_existing: "0",
        notes: { user_id: user.id },
      },
    });

    const amount = AUTOPAY_PLAN_PRICES[plan];
    const order = await razorpay("/orders", {
      method: "POST",
      body: {
        amount: AUTH_AMOUNT,
        currency: "INR",
        customer_id: customer.id,
        method,
        receipt: `mandate_${Date.now().toString(36)}`,
        notes: { purpose: "autopay_authorization", business_id: business.id, plan },
        token: {
          max_amount: amount,
          expire_at: Math.floor(Date.now() / 1000) + MANDATE_VALIDITY_SECONDS,
          frequency: "as_presented",
        },
      },
    });

    const { error: insertError } = await admin.from("autopay_mandates").insert({
      business_id: business.id,
      user_id: user.id,
      plan,
      amount,
      method,
      razorpay_customer_id: customer.id,
      auth_order_id: order.id,
      status: "created",
      consent_version: consentVersion,
    });
    if (insertError) {
      console.error("create-autopay-mandate: could not store mandate", insertError);
      return json({ error: "Could not start AutoPay setup. Please try again." }, 500);
    }

    return json({
      order_id: order.id,
      amount: AUTH_AMOUNT,
      currency: "INR",
      key_id: Deno.env.get("RAZORPAY_KEY_ID"),
      customer_id: customer.id,
      method,
      plan,
      plan_amount: amount,
      business_name: business.name,
    });
  } catch (err) {
    console.error("create-autopay-mandate error:", err);
    if (err instanceof RazorpayApiError) {
      return json({ error: "The payment provider could not start AutoPay. Please try again shortly." }, 502);
    }
    return json({ error: "Could not start AutoPay setup. Please try again." }, 500);
  }
});
