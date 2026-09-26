// Account erasure Edge Function.
//
// Implements the Data Principal's right to erasure under section 12(3) of the
// Digital Personal Data Protection Act, 2023, for Reviyo account holders.
//
// Flow:
//   1. Authenticate the caller from their own JWT. The account that gets
//      deleted is always the caller's own — the user id is never taken from
//      the request body, so one user can never erase another.
//   2. Preserve the statutory financial trail (payment_orders is ON DELETE
//      CASCADE from businesses, so this must happen first).
//   3. Delete the auth user via the admin API. That cascades to profiles,
//      businesses, review_topics, review_sessions, review_session_topics,
//      private_feedback, analytics_events, subscriptions, ai_generation_log,
//      and payment_orders.
//
// The caller must send a second confirmation field so an accidental or
// cross-site request cannot destroy an account.

import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";
import { cancelMandateAtRazorpay, getSupabaseSecretKey } from "../_shared/autopay.ts";

const REQUIRED_CONFIRMATION = "DELETE MY ACCOUNT";

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

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.startsWith("Bearer ")
      ? authHeader.slice("Bearer ".length).trim()
      : "";

    if (!accessToken) {
      return json({ error: "You must be signed in to delete your account." }, 401);
    }

    const body = await req.json().catch(() => ({})) as { confirmation?: string };
    if (body.confirmation !== REQUIRED_CONFIRMATION) {
      return json(
        { error: `Type "${REQUIRED_CONFIRMATION}" to confirm.` },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = getSupabaseSecretKey();
    const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");

    // Resolve the caller from their own token. Never trust a user id in the body.
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
    if (userError || !userData?.user) {
      return json({ error: "Your session is no longer valid. Sign in again." }, 401);
    }

    const userId = userData.user.id;

    // Cancel any AutoPay mandate at the bank before the rows disappear, so the
    // owner's UPI app or card no longer shows it. Best effort: once the account
    // is gone nothing can be charged anyway, because only our scheduler charges.
    const { data: mandates } = await admin
      .from("autopay_mandates")
      .select("id, method, razorpay_customer_id, token_id, businesses!inner(owner_id)")
      .eq("businesses.owner_id", userId)
      .in("status", ["authorized", "active", "paused"]);
    for (const mandate of mandates ?? []) {
      try {
        await cancelMandateAtRazorpay(mandate);
      } catch (err) {
        console.error("delete-account: could not cancel mandate", mandate.id, err);
      }
    }

    // Step 1 — copy the statutory financial trail out before the cascade.
    const { data: preserved, error: preserveError } = await admin.rpc(
      "preserve_financial_records_for_erasure",
      { p_user_id: userId },
    );

    if (preserveError) {
      console.error("delete-account: could not preserve financial records", preserveError);
      return json(
        { error: "Could not complete deletion. Nothing was deleted. Please contact support." },
        500,
      );
    }

    // Step 2 — delete the auth user. Everything else cascades from here.
    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (deleteError) {
      console.error("delete-account: auth user deletion failed", deleteError);
      return json(
        { error: "Could not complete deletion. Please contact support." },
        500,
      );
    }

    return json({
      deleted: true,
      deleted_at: new Date().toISOString(),
      financial_records_retained:
        (preserved as { financial_records_retained?: number } | null)
          ?.financial_records_retained ?? 0,
    });
  } catch (err) {
    console.error("delete-account error:", err);
    return json({ error: "Could not complete deletion. Please try again." }, 500);
  }
});
