const LOCAL_ORIGINS = new Set([
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function allowedOrigins(): Set<string> {
  const configured = (Deno.env.get("APP_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return new Set([...LOCAL_ORIGINS, ...configured]);
}

export function isAllowedBrowserOrigin(req: Request): boolean {
  const origin = req.headers.get("Origin");
  return !origin || allowedOrigins().has(origin.replace(/\/$/, ""));
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
