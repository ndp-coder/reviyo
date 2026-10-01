import { createAdminClient } from "../_shared/autopay.ts";
import { runCommissions } from "../_shared/commissions.ts";

Deno.serve(async (req: Request) => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const expected = Deno.env.get("COMMISSION_CRON_SECRET") ?? "";
  const supplied = req.headers.get("x-cron-secret") ?? "";
  // Hash before comparison, so differently sized secrets follow the same path.
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
  const a = await hash(expected); const b = await hash(supplied);
  let diff = 0; for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (expected.length < 32 || diff !== 0) return json({ error: "Unauthorized" }, 401);
  try { return json({ ok: true, ...await runCommissions(await createAdminClient()) }); }
  catch { return json({ error: "Commission processing failed" }, 500); }
});
