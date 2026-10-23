// Server-only authentication check. No order creation or customer data.
import { getSupabaseSecretKey } from '../_shared/autopay.ts';
import { QikinkClient, QikinkError } from '../_shared/qikink.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
let client: QikinkClient | undefined;
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const key = req.headers.get('apikey') ?? req.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!key) return json({ error: 'Unauthorized' }, 401);
    const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
    const a = await digest(key), b = await digest(getSupabaseSecretKey());
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) return json({ error: 'Unauthorized' }, 401);
    let body: unknown;
    try {
      const text = await req.text();
      if (text.length > 1024) return json({ error: 'Request too large' }, 413);
      body = JSON.parse(text);
    } catch { return json({ error: 'Invalid request' }, 400); }
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || !('action' in body) || body.action !== 'connection') return json({ error: 'Use action: connection' }, 400);
    client ??= new QikinkClient({ environment: 'live', clientId: Deno.env.get('QIKINK_CLIENT_ID') ?? '', clientSecret: Deno.env.get('QIKINK_LIVE_SECRET') ?? '' });
    return json({ environment: 'live', ...await client.checkConnection() });
  } catch (error) {
    return json({ error: 'Live connection check failed', category: error instanceof QikinkError ? error.category : 'internal' }, 502);
  }
});
