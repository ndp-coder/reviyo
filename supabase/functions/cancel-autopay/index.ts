// Edge Function: cancel-autopay
// Lets an owner turn off AutoPay. Access continues until the current trial or
// term ends; nothing further is charged.

import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";
import { cancelMandateAtRazorpay, createAdminClient } from "../_shared/autopay.ts";

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
    if (!businessId) return json({ error: "Missing business" }, 400);

    const admin = await createAdminClient();
    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData?.user) return json({ error: "Please sign in again." }, 401);

    const { data: business } = await admin
      .from("businesses")
      .select("id, owner_id")
      .eq("id", businessId)
      .maybeSingle();
    if (!business || business.owner_id !== userData.user.id) {
      return json({ error: "Unauthorized access to business" }, 403);
    }

    const { data: mandate } = await admin
      .from("autopay_mandates")
      .select("id, method, razorpay_customer_id, token_id")
      .eq("business_id", business.id)
      .in("status", ["authorized", "active", "paused"])
      .maybeSingle();
    if (!mandate) return json({ error: "AutoPay is not active." }, 404);

    // Stop our own charging first. Even if the bank-side cancellation fails,
    // nothing more is charged, because only the scheduler ever charges.
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("autopay_mandates")
      .update({ status: "cancelled", cancelled_at: now, updated_at: now })
      .eq("id", mandate.id);
    if (updateError) throw new Error("Could not cancel AutoPay");

    // Charges prepared but not yet sent are dropped too.
    await admin
      .from("payment_orders")
      .update({ status: "failed", updated_at: now })
      .eq("mandate_id", mandate.id)
      .eq("status", "created");

    let bankCancelled = true;
    try {
      await cancelMandateAtRazorpay(mandate);
    } catch (err) {
      bankCancelled = false;
      console.error("cancel-autopay: Razorpay cancellation failed", mandate.id, err);
    }

    return json({ cancelled: true, bank_cancelled: bankCancelled });
  } catch (err) {
    console.error("cancel-autopay error:", err);
    return json({ error: "Could not cancel AutoPay. Please try again or contact support." }, 500);
  }
});
