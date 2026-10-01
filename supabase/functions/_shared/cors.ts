const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

// The live site, with and without www: the host may serve either before its
// redirect is in place, and a missing APP_ORIGINS secret must not break
// payments. Kept in step with siteUrl in src/config/legal.ts by a test.
// APP_ORIGINS adds more (a preview deploy, a staging domain).
export const PRODUCTION_ORIGINS = [
  "https://revio.in",
  "https://www.revio.in",
];

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("APP_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return new Set([...LOCAL_ORIGINS, ...PRODUCTION_ORIGINS, ...configured]);
}

export function isAllowedBrowserOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  if (!origin || allowedOrigins().has(origin.replace(/\/$/, ""))) return true;
  // The browser only reports a CORS failure; the function logs say which origin.
  console.warn(`Blocked request from origin ${origin}. Add it to APP_ORIGINS if it is ours.`);
  return false;
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Client-Info, Apikey, Authorization",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins().has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}
