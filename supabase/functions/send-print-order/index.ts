// Edge Function: send-print-order
// Called by the dashboard right after an owner saves their delivery address,
// so a paid business's free printed QR kit goes to the printer straight away
// instead of on the scheduler's next run. Safe to call any time: it only acts
// on an order that is ready, and each email goes out once.

import { getCorsHeaders, isAllowedBrowserOrigin } from "../_shared/cors.ts";
import { createAdminClient } from "../_shared/autopay.ts";
import { sendPrintOrder } from "../_shared/email.ts";

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

    const sent = await sendPrintOrder(admin, business.id);
    const { data: order } = await admin
      .from("qr_print_orders")
      .select("status, sent_to_printer_at")
      .eq("business_id", business.id)
      .maybeSingle();
    return json({ sent, status: order?.status ?? null, sent_to_printer_at: order?.sent_to_printer_at ?? null });
  } catch (err) {
    console.error("send-print-order error:", err);
    return json({ error: "Could not send the print order right now. It will go out automatically soon." }, 500);
  }
});
