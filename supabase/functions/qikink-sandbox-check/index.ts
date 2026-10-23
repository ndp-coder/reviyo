// Developer-only sandbox checks. This function has no live environment option.
import { createAdminClient, getSupabaseSecretKey } from '../_shared/autopay.ts';
import { QikinkClient, QikinkError, buildStandOrder } from '../_shared/qikink.ts';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
let client: QikinkClient | undefined;
Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer /, '');
    const serverKey = req.headers.get('apikey') ?? token;
    if (!serverKey) return json({ error: 'Unauthorized' }, 401);
    const db = await createAdminClient();
    // The dashboard's server-key test runner has no end-user JWT. Existing
    // service credentials may run these sandbox-only diagnostics as well.
    const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
    const a = await digest(serverKey), b = await digest(getSupabaseSecretKey());
    let diff = 0;
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
    if (diff !== 0) {
      if (!token) return json({ error: 'Unauthorized' }, 401);
      const { data: userData, error: userError } = await db.auth.getUser(token);
      if (userError || !userData.user) return json({ error: 'Unauthorized' }, 401);
      const { data: admin, error: adminError } = await db.from('profiles').select('role').eq('id', userData.user.id).single();
      if (adminError || admin?.role !== 'admin') return json({ error: 'Developer access required' }, 403);
    }
    let body: unknown;
    try { if (Number(req.headers.get('content-length') ?? 0) > 1024) return json({ error: 'Request too large' }, 413); body = await req.json(); }
    catch { return json({ error: 'Invalid request' }, 400); }
    if (!body || typeof body !== 'object' || !('action' in body)) return json({ error: 'Invalid request' }, 400);
    client ??= new QikinkClient({ environment: 'sandbox', clientId: Deno.env.get('QIKINK_CLIENT_ID') ?? '', clientSecret: Deno.env.get('QIKINK_SANDBOX_SECRET') ?? '' });
    if (body.action === 'connection' && Object.keys(body).length === 1) return json({ environment: 'sandbox', ...await client.checkConnection() });
    if (!['sample', 'api_reference_sample'].includes(String(body.action)) || Object.keys(body).length !== 2 || !('requestId' in body) || typeof body.requestId !== 'string' || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(body.requestId)) return json({ error: 'Use connection or a sample with a UUID requestId' }, 400);
    const payload = await buildStandOrder({ jobUUID: body.requestId, sku: 'UAcryDiSt-Wh-NA', name: 'Reviyo sandbox sample', email: 'support@reviyo.in', totalOrderValue: 299,
      address: { line1: '1 Sandbox Test Road', phone: '9000000000', city: 'Vijayawada', state: 'Andhra Pradesh', pincode: '520001' },
      designUrl: 'https://reviyo.in/images/stand/qikink-sample.png', mockupUrl: 'https://reviyo.in/images/stand/qikink-sample-mockup.png' });
    // Qikink's published create-order fixture isolates API access from acrylic
    // SKU availability in sandbox. This is NOT validation of stand fulfilment.
    if (body.action === 'api_reference_sample') {
      payload.line_items[0].sku = 'MVnHs-Wh-S';
      payload.line_items[0].print_type_id = 1;
    }
    return json({ environment: 'sandbox', sampleType: body.action === 'sample' ? 'acrylic_stand' : 'documented_api_fixture', reference: payload.order_number, ...await client.createOrder(payload) });
  } catch (error) {
    return json({ error: 'Sandbox check failed', category: error instanceof QikinkError ? error.category : 'internal', reason: error instanceof QikinkError ? error.reason : undefined }, 502);
  }
});
