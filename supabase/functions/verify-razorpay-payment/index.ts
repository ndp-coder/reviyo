// Edge Function: verify-razorpay-payment
// Verifies Razorpay payment signature and activates/extends the subscription

import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";

function getSupabaseSecretKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    const key = parsed.default ?? Object.values(parsed)[0];
    if (key) return key;
  }

  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  throw new Error("Supabase server key is not available");
}

async function verifyHmacSha256(data: string, secret: string, expectedSignature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const generatedSignature = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  const expected = expectedSignature.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected) || expected.length !== generatedSignature.length) return false;

  let difference = 0;
  for (let index = 0; index < generatedSignature.length; index += 1) {
    difference |= generatedSignature.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

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

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl) throw new Error("SUPABASE_URL is not set");

    const supabaseKey = getSupabaseSecretKey();
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid user token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const {
      business_id,
      plan,
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (!business_id || !plan || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return new Response(
        JSON.stringify({ error: "Missing required payment verification parameters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify ownership
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_id")
      .eq("id", business_id)
      .single();

    if (businessError || !business || business.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized access to business" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: paymentOrder, error: orderError } = await supabase
      .from("payment_orders")
      .select("business_id, user_id, plan, status, payment_id")
      .eq("order_id", razorpay_order_id)
      .maybeSingle();

    if (orderError || !paymentOrder) {
      return new Response(JSON.stringify({ error: "Payment order not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      paymentOrder.user_id !== user.id ||
      paymentOrder.business_id !== business_id ||
      paymentOrder.plan !== plan
    ) {
      return new Response(JSON.stringify({ error: "Payment order details do not match" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
    if (!razorpayKeySecret) {
      return new Response(
        JSON.stringify({ error: "Razorpay secret is not configured on the server" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify Razorpay signature: HMAC_SHA256(order_id + "|" + payment_id, secret)
    const expectedPayload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const isValid = await verifyHmacSha256(expectedPayload, razorpayKeySecret, razorpay_signature);

    if (!isValid) {
      console.error("Signature verification failed for order:", razorpay_order_id);
      return new Response(
        JSON.stringify({ error: "Invalid payment signature" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The database locks and fulfills the stored order atomically. It never uses
    // browser-supplied plan or business values to grant a subscription.
    const { data: paymentResult, error: subError } = await supabase.rpc(
      "process_paid_order",
      {
        p_order_id: razorpay_order_id,
        p_payment_id: razorpay_payment_id,
      }
    );

    if (subError) {
      console.error("Failed to update subscription:", subError);
      return new Response(
        JSON.stringify({ error: "Payment verified but subscription activation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: paymentResult?.subscription,
        message: "Payment verified and subscription activated successfully",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-razorpay-payment unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
