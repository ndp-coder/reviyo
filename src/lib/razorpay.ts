import { supabase } from '@/lib/supabase';
import { branding } from '@/config/branding';
import { PLANS } from '@/config/plans';
import { readFunctionError } from '@/lib/function-errors';
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
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    const script = existingScript ?? document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    let finished = false;
    const finish = (loaded: boolean) => {
      if (finished) return;
      finished = true;
      window.clearTimeout(timeout);
      script.removeEventListener('load', onLoad);
      script.removeEventListener('error', onError);
      if (!loaded) script.remove();
      resolve(loaded);
    };
    const onLoad = () => finish(Boolean(window.Razorpay));
    const onError = () => finish(false);
    const timeout = window.setTimeout(onError, 20_000);
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    if (!existingScript) {
      try { document.body.appendChild(script); }
      catch { finish(false); }
    }
  }).then((loaded) => {
    // Failed promises and failed script tags must not poison later attempts.
    if (!loaded) scriptLoadingPromise = null;
    return loaded;
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
      // error.message is only "Edge Function returned a non-2xx status code";
      // the function's own explanation is in the response body.
      return { error: await readFunctionError(error, 'We couldn’t start the payment. Please try again.') };
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
      return {
        success: false,
        error: await readFunctionError(
          error,
          'We couldn’t confirm the payment yet. If money was debited, your plan activates automatically within a few minutes — no need to pay again.'
        ),
      };
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
    params.onError('Could not open secure checkout. Check your connection and try again.');
    return;
  }

  const razorpayKey =
    params.order.key_id ||
    (import.meta.env.VITE_RAZORPAY_KEY_ID as string | undefined)?.trim();

  if (!razorpayKey) {
    params.onError('Payments are temporarily unavailable. Please contact support.');
    return;
  }

  const options: RazorpayCheckoutOptions = {
    key: razorpayKey,
    amount: params.order.amount,
    currency: params.order.currency || 'INR',
    name: branding.name,
    description: `${PLANS[params.order.plan].label} subscription`,
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
