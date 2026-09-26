import { supabase } from '@/lib/supabase';
import { branding } from '@/config/branding';
import type {
  SubscriptionPlan,
  RazorpayOrderResponse,
  RazorpayCheckoutSuccessResponse,
  Subscription,
} from '@/lib/types';

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance;
  }
}

export interface RazorpayInstance {
  open: () => void;
  close: () => void;
  on: (event: string, handler: (response: { error: { description: string; code: string } }) => void) => void;
}

export interface RazorpayCheckoutOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  /** Recurring (AutoPay) checkouts only. */
  customer_id?: string;
  /** "1" for UPI AutoPay, true for card mandates (per Razorpay's docs). */
  recurring?: '1' | boolean;
  image?: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  handler: (response: RazorpayCheckoutSuccessResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

let scriptLoadingPromise: Promise<boolean> | null = null;

export function loadRazorpayScript(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);

  if (scriptLoadingPromise) return scriptLoadingPromise;

  scriptLoadingPromise = new Promise<boolean>((resolve) => {
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(true));
      existingScript.addEventListener('error', () => resolve(false));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error('Failed to load Razorpay SDK checkout script');
      resolve(false);
    };
    document.body.appendChild(script);
  });

  return scriptLoadingPromise;
}

export async function createRazorpayOrder(
  businessId: string,
  plan: SubscriptionPlan
): Promise<{ order?: RazorpayOrderResponse; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke<RazorpayOrderResponse>(
      'create-razorpay-order',
      {
        body: { business_id: businessId, plan },
      }
    );

    if (error) {
      return { error: error.message || 'Failed to create payment order' };
    }

    if (!data || !data.order_id) {
      return { error: 'Invalid response from payment order service' };
    }

    return { order: data };
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error initiating payment order' };
  }
}

export async function verifyRazorpayPayment(payload: {
  business_id: string;
  plan: SubscriptionPlan;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}): Promise<{ success: boolean; subscription?: Subscription; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke<{
      success: boolean;
      subscription?: Subscription;
      message?: string;
    }>('verify-razorpay-payment', {
      body: payload,
    });

    if (error) {
      return { success: false, error: error.message || 'Failed to verify payment' };
    }

    return {
      success: data?.success ?? false,
      subscription: data?.subscription,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Error verifying payment',
    };
  }
}

export async function startRazorpayCheckout(params: {
  order: RazorpayOrderResponse;
  userEmail?: string;
  userName?: string;
  onSuccess: (payment: RazorpayCheckoutSuccessResponse) => void;
  onError: (error: string) => void;
  onDismiss?: () => void;
}): Promise<void> {
  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    params.onError('Could not load Razorpay payment SDK. Please check your network connection.');
    return;
  }

  const razorpayKey =
    params.order.key_id ||
    (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim();

  if (!razorpayKey) {
    params.onError('Razorpay Key ID is not configured. Please add your key in the environment.');
    return;
  }

  const options: RazorpayCheckoutOptions = {
    key: razorpayKey,
    amount: params.order.amount,
    currency: params.order.currency || 'INR',
    name: branding.name,
    description: `${params.order.plan === '6_months' ? '6 Months' : '12 Months'} Subscription`,
    order_id: params.order.order_id,
    image: new URL(branding.icon, window.location.origin).toString(),
    theme: {
      color: branding.colors.primary,
    },
    prefill: {
      name: params.userName,
      email: params.userEmail,
    },
    handler: (response) => {
      params.onSuccess(response);
    },
    modal: {
      ondismiss: () => {
        if (params.onDismiss) params.onDismiss();
      },
    },
  };

  const razorpay = new window.Razorpay(options);
  razorpay.on('payment.failed', (response) => {
    params.onError(response.error.description || 'Payment was unsuccessful');
  });
  razorpay.open();
}
