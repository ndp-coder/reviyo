// Shared AutoPay (Razorpay recurring payments) helpers for Edge Functions.
//
// Flow: a ₹1 authorisation payment registers a mandate ("token") with the
// owner's UPI app or card. That ₹1 is captured and refunded, the 14-day trial
// starts, and autopay-scheduler later charges the plan price against the token.
// Docs: https://razorpay.com/docs/api/payments/recurring-payments/

// Keep in step with PLAN_PRICES in create-razorpay-order (a test checks this).
export const AUTOPAY_PLAN_PRICES: Record<string, number> = {
  "6_months": 199900, // ₹1,999 in paise
  "12_months": 299900, // ₹2,999 in paise
};

/** The authorisation amount: ₹1, refunded immediately. */
export const AUTH_AMOUNT = 100;

export type AutopayMethod = "upi" | "card";

export function getSupabaseSecretKey(): string {
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (secretKeys) {
    const parsed = JSON.parse(secretKeys) as Record<string, string>;
    const key = parsed.default ?? Object.values(parsed)[0];
    if (key) return key;
  }

  const legacyKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacyKey) return legacyKey;

  throw new Error("Supabase server key is not available");
}

import type { SupabaseClient } from "npm:@supabase/supabase-js@2.57.4";

export type AdminClient = SupabaseClient;

/**
 * Razorpay API responses are external JSON. They are read field by field and
 * every value that matters is checked before use.
 */
// deno-lint-ignore no-explicit-any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RazorpayJson = any;

/**
 * A many-to-one embed (e.g. mandate -> business) comes back as one object at
 * runtime, but without generated types supabase-js types it as an array.
 */
export function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

export async function createAdminClient(): Promise<AdminClient> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not set");
  const { createClient } = await import("npm:@supabase/supabase-js@2.57.4");
  return createClient(supabaseUrl, getSupabaseSecretKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function razorpayConfigured(): boolean {
  return Boolean(Deno.env.get("RAZORPAY_KEY_ID") && Deno.env.get("RAZORPAY_KEY_SECRET"));
}

export class RazorpayApiError extends Error {
  constructor(readonly status: number, readonly description: string) {
    super(`Razorpay API error (${status}): ${description}`);
    this.name = "RazorpayApiError";
  }
}

/** Calls the Razorpay REST API with the server's key pair. */
export async function razorpay(path: string, init: { method?: string; body?: unknown } = {}): Promise<RazorpayJson> {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID");
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET");
  if (!keyId || !keySecret) throw new Error("Razorpay is not configured");

  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init.method ?? "GET",
    headers: {
      "Authorization": `Basic ${btoa(`${keyId}:${keySecret}`)}`,
      "Content-Type": "application/json",
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const text = await response.text();
  let data: RazorpayJson = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new RazorpayApiError(response.status, data?.error?.description ?? text.slice(0, 300));
  }
  return data;
}

export async function verifyHmacSha256(data: string, secret: string, expectedSignature: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(data));
  const generated = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const expected = expectedSignature.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expected)) return false;

  let difference = 0;
  for (let index = 0; index < generated.length; index += 1) {
    difference |= generated.charCodeAt(index) ^ expected.charCodeAt(index);
  }
  return difference === 0;
}

/**
 * Refunds the ₹1 authorisation. Safe to call repeatedly: if Razorpay already
 * shows it refunded, the existing refund id is recorded instead.
 */
export async function refundAuthorization(
  admin: AdminClient,
  mandateId: string,
  paymentId: string,
): Promise<string | null> {
  try {
    const payment = await razorpay(`/payments/${encodeURIComponent(paymentId)}`);
    let refundId: string | null = null;

    if ((payment.amount_refunded ?? 0) >= AUTH_AMOUNT) {
      const refunds = await razorpay(`/payments/${encodeURIComponent(paymentId)}/refunds`);
      refundId = refunds?.items?.[0]?.id ?? null;
    } else if (payment.status === "captured") {
      const refund = await razorpay(`/payments/${encodeURIComponent(paymentId)}/refund`, {
        method: "POST",
        body: { amount: AUTH_AMOUNT, speed: "normal", notes: { reason: "AutoPay setup verification" } },
      });
      refundId = refund.id;
    }

    if (refundId) {
      await admin
        .from("autopay_mandates")
        .update({ auth_refund_id: refundId, updated_at: new Date().toISOString() })
        .eq("id", mandateId);
    }
    return refundId;
  } catch (err) {
    // Not fatal: autopay-scheduler retries refunds that have not gone through.
    console.error("autopay: authorisation refund failed, will retry", mandateId, err);
    return null;
  }
}

/**
 * Completes an AutoPay setup once its ₹1 payment exists: captures it if
 * needed, records the mandate token, starts the trial, and refunds the ₹1.
 * Called from the browser verification, the webhook, and the scheduler, so
 * every step is idempotent.
 */
export async function finalizeAutopayAuthorization(
  admin: AdminClient,
  authOrderId: string,
  paymentId: string,
): Promise<RazorpayJson> {
  const { data: mandate, error: mandateError } = await admin
    .from("autopay_mandates")
    .select("id, auth_refund_id, method, razorpay_customer_id")
    .eq("auth_order_id", authOrderId)
    .maybeSingle();
  if (mandateError) throw new Error("Could not load AutoPay setup");
  if (!mandate) throw new Error("AutoPay setup not found");

  let payment = await razorpay(`/payments/${encodeURIComponent(paymentId)}`);
  if (payment.order_id !== authOrderId) {
    throw new Error("Payment does not belong to this AutoPay setup");
  }
  if (payment.amount !== AUTH_AMOUNT || payment.currency !== "INR") {
    throw new Error("Unexpected authorisation amount");
  }

  if (payment.status === "authorized") {
    payment = await razorpay(`/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: "POST",
      body: { amount: AUTH_AMOUNT, currency: "INR" },
    });
  }
  if (payment.status !== "captured" && payment.status !== "refunded") {
    throw new Error(`Authorisation payment is ${payment.status}`);
  }

  const tokenId: string | undefined = payment.token_id;
  if (!tokenId) {
    throw new Error("No AutoPay mandate was created for this payment");
  }

  const { data: result, error: trialError } = await admin.rpc("start_autopay_trial", {
    p_auth_order_id: authOrderId,
    p_payment_id: paymentId,
    p_token_id: tokenId,
  });
  if (trialError) {
    if (/already set up/i.test(trialError.message)) {
      // A second setup finished after the first (two tabs, double click).
      // Give this ₹1 back and cancel the extra mandate so it can never charge.
      await refundAuthorization(admin, mandate.id, paymentId);
      try {
        await cancelMandateAtRazorpay({ ...mandate, token_id: tokenId });
      } catch (err) {
        console.error("autopay: could not cancel duplicate mandate", mandate.id, err);
      }
      const now = new Date().toISOString();
      await admin
        .from("autopay_mandates")
        .update({ status: "cancelled", auth_payment_id: paymentId, token_id: tokenId, cancelled_at: now, updated_at: now })
        .eq("id", mandate.id);
      return { duplicate: true };
    }
    throw new Error(`Could not start trial: ${trialError.message}`);
  }

  if (!mandate.auth_refund_id) {
    await refundAuthorization(admin, mandate.id, paymentId);
  }
  return result;
}

/**
 * Cancels the mandate with Razorpay. UPI mandates are cancelled through NPCI;
 * card tokens are deleted. Throws if Razorpay refuses.
 */
export async function cancelMandateAtRazorpay(mandate: {
  method: string;
  razorpay_customer_id: string;
  token_id: string | null;
}): Promise<void> {
  if (!mandate.token_id) return;
  const base = `/customers/${encodeURIComponent(mandate.razorpay_customer_id)}/tokens/${encodeURIComponent(mandate.token_id)}`;
  if (mandate.method === "upi") {
    await razorpay(`${base}/cancel`, { method: "PUT" });
  } else {
    await razorpay(base, { method: "DELETE" });
  }
}
