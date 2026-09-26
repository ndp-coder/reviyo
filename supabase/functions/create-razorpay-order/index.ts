// Edge Function: create-razorpay-order
// Creates a Razorpay order for subscription purchase or renewal

import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";

const PLAN_PRICES: Record<string, { amount: number; label: string }> = {
  "6_months": { amount: 199900, label: "6 Months Plan" },   // ₹1,999 in paise
  "12_months": { amount: 299900, label: "12 Months Plan" }, // ₹2,999 in paise
};

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
    const { business_id, plan } = body;

    if (!business_id || typeof business_id !== "string") {
      return new Response(JSON.stringify({ error: "Missing or invalid business_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!plan || !(plan in PLAN_PRICES)) {
      return new Response(JSON.stringify({ error: "Invalid plan. Choose '6_months' or '12_months'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify ownership
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id, owner_id, name")
      .eq("id", business_id)
      .single();

    if (businessError || !business || business.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: "Unauthorized access to business" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const razorpayKeyId = Deno.env.get("RAZORPAY_KEY_ID");
    const razorpayKeySecret = Deno.env.get("RAZORPAY_KEY_SECRET");

    if (!razorpayKeyId || !razorpayKeySecret) {
      return new Response(
        JSON.stringify({
          error: "Razorpay is not configured on the server. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
          code: "RAZORPAY_NOT_CONFIGURED",
        }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const planConfig = PLAN_PRICES[plan];
    const receipt = `rcpt_${Date.now().toString().slice(-8)}_${Math.random().toString(36).substring(2, 6)}`;

    // Create order with Razorpay
    const basicAuth = btoa(`${razorpayKeyId}:${razorpayKeySecret}`);
    const rzpResponse = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${basicAuth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: planConfig.amount,
        currency: "INR",
        // Capture as soon as the customer pays, whatever the account's default
        // capture setting. An authorized-but-uncaptured payment is refunded by
        // Razorpay after a few days, so it must never count as paid.
        payment_capture: true,
        receipt,
        notes: {
          business_id: business.id,
          business_name: business.name,
          plan,
          user_id: user.id,
        },
      }),
    });

    if (!rzpResponse.ok) {
      const errorText = await rzpResponse.text();
      console.error("Razorpay order creation failed:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create Razorpay order" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rzpOrder = await rzpResponse.json();

    // Persist order in payment_orders table
    const { error: insertError } = await supabase.from("payment_orders").insert({
      business_id: business.id,
      user_id: user.id,
      order_id: rzpOrder.id,
      plan,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      status: "created",
      receipt: rzpOrder.receipt,
      metadata: {
        razorpay_order_id: rzpOrder.id,
        notes: rzpOrder.notes,
      },
    });

    if (insertError) {
      console.error("Failed to store payment order:", insertError);
      return new Response(
        JSON.stringify({ error: "Could not safely create payment order" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        order_id: rzpOrder.id,
        amount: rzpOrder.amount,
        currency: rzpOrder.currency,
        key_id: razorpayKeyId,
        plan,
        business_name: business.name,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("create-razorpay-order unhandled error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
