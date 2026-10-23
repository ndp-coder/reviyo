// Developer-only sandbox checks. This function has no live environment option.
import { createAdminClient } from '../_shared/autopay.ts';
import { QikinkClient, QikinkError } from '../_shared/qikink.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
let client: QikinkClient | undefined;
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
    if (!token) return json({ error: 'Unauthorized' }, 401);
    const db = await createAdminClient();
    const { data: userData, error: userError } = await db.auth.getUser(token);
    if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
    const { data: admin, error: adminError } = await db.from('profiles').select('role').eq('id', userData.user.id).single();
    if (adminError || admin?.role !== 'admin') return json({ error: 'Developer access required' }, 403);
    let body: unknown;
    try { if (Number(req.headers.get('content-length') ?? 0) > 1024) return json({ error: 'Request too large' }, 413); body = await req.json(); }
    catch { return json({ error: 'Invalid request' }, 400); }
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || !('action' in body) || body.action !== 'connection') return json({ error: 'Use action: connection' }, 400);
    client ??= new QikinkClient({ environment: 'sandbox', clientId: Deno.env.get('QIKINK_CLIENT_ID') ?? '', clientSecret: Deno.env.get('QIKINK_SANDBOX_SECRET') ?? '' });
    return json({ environment: 'sandbox', ...await client.checkConnection() });
  } catch (error) {
    return json({ error: 'Sandbox check failed', category: error instanceof QikinkError ? error.category : 'internal' }, 502);
  }
});
