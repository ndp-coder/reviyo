// Official Qikink Open API, Orders 08-25:
// https://documenter.getpostman.com/view/26157218/2sBYAysUHS
export type QikinkErrorCategory = 'validation' | 'auth' | 'rate_limit' | 'vendor' | 'invalid_response' | 'network' | 'timeout';
export class QikinkError extends Error {
  constructor(readonly category: QikinkErrorCategory) { super('Qikink request failed'); this.name = 'QikinkError'; }
}
export interface QikinkClientOptions {
  environment: 'sandbox' | 'live'; clientId: string; clientSecret: string;
  fetch?: typeof fetch; timeoutMs?: number;
}
export interface QikinkListedOrder { orderId: string; reference: string; status: string }
const hosts = { sandbox: 'https://sandbox.qikink.com', live: 'https://api.qikink.com' } as const;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 4096): v is string => typeof v === 'string' && !!v.trim() && v.length <= max && !Array.from(v).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127);
const orderId = (v: unknown) => typeof v === 'number' ? Number.isSafeInteger(v) && v > 0 : typeof v === 'string' && /^[1-9]\d*$/.test(v);

/** Reuse one instance per credential/environment per isolate: issuing a token replaces its predecessor.
 * No retries, including auth failures. After ambiguous creates, reconcile the persisted reference first.
 */
export class QikinkClient {
  #host: string; #clientId: string; #secret: string; #fetch: typeof fetch; #timeout: number;
  #cached?: { value: string; expires: number }; #pending?: Promise<string>;
  constructor(options: QikinkClientOptions) {
    if (!options || (options.environment !== 'sandbox' && options.environment !== 'live') ||
        !text(options.clientId) || !text(options.clientSecret) ||
        !Number.isInteger(options.timeoutMs ?? 10000) || (options.timeoutMs ?? 10000) <= 0 || (options.timeoutMs ?? 10000) > 2147483647) throw new QikinkError('validation');
    this.#host = hosts[options.environment]; this.#clientId = options.clientId; this.#secret = options.clientSecret;
    this.#fetch = options.fetch ?? globalThis.fetch; this.#timeout = options.timeoutMs ?? 10000;
  }
  async #request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeout);
    try {
      const response = await this.#fetch(this.#host + path, { ...init, redirect: 'error', signal: controller.signal });
      if (!response.ok) throw new QikinkError(response.status === 401 || response.status === 403 ? 'auth' : response.status === 429 ? 'rate_limit' : 'vendor');
      let data: unknown;
      try { data = await response.json(); }
      catch { throw new QikinkError('invalid_response'); }
      if (!record(data)) throw new QikinkError('invalid_response');
      if ('error' in data || data.success === false || ('status_code' in data && String(data.status_code) !== '200')) throw new QikinkError('vendor');
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new QikinkError('timeout');
      if (error instanceof QikinkError) throw error;
      throw new QikinkError('network');
    } finally { clearTimeout(timer); }
  }
  async #token(): Promise<string> {
    if (this.#cached && Date.now() < this.#cached.expires) return this.#cached.value;
    if (!this.#pending) this.#pending = (async () => {
      const started = Date.now();
      const data = await this.#request('/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ClientId: this.#clientId, client_secret: this.#secret }).toString() });
      const seconds = typeof data.expires_in === 'number' ? data.expires_in :
        typeof data.expires_in === 'string' && /^\d+$/.test(data.expires_in) ? Number(data.expires_in) : NaN;
      if (data.ClientId !== this.#clientId || !text(data.Accesstoken) || !Number.isFinite(seconds) || seconds <= 0 || seconds > Number.MAX_SAFE_INTEGER / 1000) throw new QikinkError('invalid_response');
      this.#cached = { value: data.Accesstoken, expires: started + seconds * 1000 - Math.min(30000, seconds * 100) };
      return data.Accesstoken;
    })();
    try { return await this.#pending; } finally { this.#pending = undefined; }
  }
  async #authorized(path: string, body?: string) {
    const token = await this.#token();
    try {
      return await this.#request(path, { method: body === undefined ? 'GET' : 'POST', body,
        headers: { ClientId: this.#clientId, Accesstoken: token, 'Content-Type': 'application/json' } });
    } catch (error) {
      if (error instanceof QikinkError && error.category === 'auth' && this.#cached?.value === token) this.#cached = undefined;
      throw error;
    }
  }
  async createOrder(payload: Record<string, unknown>): Promise<{ orderId: string }> {
    let body: string;
    try { body = JSON.stringify(payload); if (!record(payload) || typeof body !== 'string') throw new Error(); }
    catch { throw new QikinkError('validation'); }
    const data = await this.#authorized('/api/order/create', body);
    if (String(data.status_code) !== '200' || !orderId(data.order_id)) throw new QikinkError('invalid_response');
    return { orderId: String(data.order_id) };
  }
  async checkConnection(): Promise<{ authenticated: true }> {
    await this.#token();
    return { authenticated: true };
  }
  /** First page within Qikink's fixed date window; sandbox listing is currently documented unavailable. */
  async listOrders(reference: string): Promise<{ orders: QikinkListedOrder[]; hasNext: boolean }> {
    if (!text(reference, 22)) throw new QikinkError('validation');
    const data = await this.#authorized('/api/order/list?' + new URLSearchParams({ order_reference_no: reference }));
    if (data.success !== true || !Array.isArray(data.data) || !record(data.pagination) || typeof data.pagination.has_next !== 'boolean') throw new QikinkError('invalid_response');
    const orders = data.data.map((item: unknown) => {
      if (!record(item) || !orderId(item.order_id) || !text(item.number) || !text(item.status)) throw new QikinkError('invalid_response');
      return { orderId: String(item.order_id), reference: item.number, status: item.status };
    });
    return { orders, hasNext: data.pagination.has_next };
  }
}

/** SKU is supplied by the caller from their account; no catalog default is assumed. */
export interface StandOrderInput {
  jobUUID: string; sku: string; name: string; email: string; totalOrderValue: number;
  address: { line1: string; line2?: string; phone: string; city: string; state: string; pincode: string };
  designUrl: string; mockupUrl: string;
}
export type StandOrderPayload = Awaited<ReturnType<typeof buildStandOrder>>;
/** 72 bits from SHA-256 of the entire normalized UUID, base36 encoded into 14 characters.
 * Collision probability ~1e-10 at one million jobs; caller must persist order_number before sending.
 */
export async function buildStandOrder(input: StandOrderInput) {
  const a = input.address;
  const imageUrl = (value: string) => {
    try { const url = new URL(value); return text(value, 512) && url.protocol === 'https:' && !url.username && !url.password; }
    catch { return false; }
  };
  if (!text(input.jobUUID) || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(input.jobUUID) ||
      !text(input.sku, 50) || !text(input.name) || !text(input.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) ||
      !a || !text(a.line1, 90) || (a.line2 !== undefined && a.line2 !== '' && !text(a.line2)) || !text(a.phone) ||
      !text(a.city) || !text(a.state) || !/^[1-9]\d{5}$/.test(a.pincode) || !Number.isFinite(input.totalOrderValue) || input.totalOrderValue < 0 ||
      !imageUrl(input.designUrl) || !imageUrl(input.mockupUrl)) throw new QikinkError('validation');
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.jobUUID.toLowerCase())));
  const reference = digest.slice(0, 9).reduce((n, byte) => n * 256n + BigInt(byte), 0n).toString(36).padStart(14, '0');
  const [first, ...rest] = input.name.trim().split(/\s+/);
  return {
    order_number: reference, qikink_shipping: 1, gateway: 'Prepaid', total_order_value: input.totalOrderValue,
    line_items: [{ sku: input.sku, quantity: 1, price: input.totalOrderValue, print_type_id: 5, search_from_my_products: 0,
      designs: [{ design_code: reference, width_inches: 4, height_inches: 6, placement_sku: 'fr', design_link: input.designUrl, mockup_link: input.mockupUrl }] }],
    shipping_address: { first_name: first, last_name: rest.join(' '), address1: a.line1, address2: a.line2 ?? '', phone: a.phone,
      email: input.email, city: a.city, province: a.state, zip: Number(a.pincode), country_code: 'IN' },
  };
}
