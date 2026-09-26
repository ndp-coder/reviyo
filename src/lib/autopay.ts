import { supabase } from '@/lib/supabase';
import { branding } from '@/config/branding';
import { legal } from '@/config/legal';
import { PLANS, formatRupees } from '@/config/plans';
import { loadRazorpayScript, type RazorpayCheckoutOptions } from '@/lib/razorpay';
import { readFunctionError } from '@/lib/function-errors';
import type {
  AutopayMethod,
  AutopaySetupOrder,
  RazorpayCheckoutSuccessResponse,
  Subscription,
  SubscriptionPlan,
} from '@/lib/types';

/** Prices in rupees, for display. The server holds the authoritative paise values. */
export const AUTOPAY_PLANS = PLANS;
export { formatRupees };

async function invoke<T>(name: string, body: Record<string, unknown>, fallback: string): Promise<{ data?: T; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke<T>(name, { body });
    if (error) return { error: await readFunctionError(error, fallback) };
    return { data: data ?? undefined };
  } catch {
    return { error: 'Could not reach the server. Check your connection and try again.' };
  }
}

/**
 * Sets up AutoPay end to end: creates the ₹1 authorisation order, opens
 * Razorpay Checkout for the chosen method, and confirms the result with the
 * server, which refunds the ₹1 and starts the trial.
 */
export async function setUpAutopay(params: {
  businessId: string;
  plan: SubscriptionPlan;
  method: AutopayMethod;
  userName?: string;
  userEmail?: string;
  onDismiss?: () => void;
}): Promise<{ success: boolean; trialStarted?: boolean; subscription?: Subscription | null; error?: string; dismissed?: boolean }> {
  const created = await invoke<AutopaySetupOrder>(
    'create-autopay-mandate',
    {
      business_id: params.businessId,
      plan: params.plan,
      method: params.method,
      consent_version: legal.autopayTermsVersion,
    },
    'Could not start AutoPay setup. Please try again.'
  );
  if (!created.data) return { success: false, error: created.error };
  const order = created.data;

  const loaded = await loadRazorpayScript();
  if (!loaded || !window.Razorpay) {
    return { success: false, error: 'Could not load the payment window. Check your connection and try again.' };
  }

  const payment = await new Promise<
    { response: RazorpayCheckoutSuccessResponse } | { error: string } | { dismissed: true }
  >((resolve) => {
    const options: RazorpayCheckoutOptions = {
      key: order.key_id,
      amount: order.amount,
      currency: order.currency,
      name: branding.name,
      description: `AutoPay setup: ₹1, refunded`,
      order_id: order.order_id,
      customer_id: order.customer_id,
      recurring: order.method === 'upi' ? '1' : true,
      image: new URL(branding.icon, window.location.origin).toString(),
      prefill: { name: params.userName, email: params.userEmail },
      theme: { color: branding.colors.primary },
      handler: (response) => resolve({ response }),
      modal: { ondismiss: () => resolve({ dismissed: true }) },
    };
    const checkout = new window.Razorpay!(options);
    checkout.on('payment.failed', (response) =>
      resolve({ error: response.error.description || 'The ₹1 payment did not go through. Please try again.' })
    );
    checkout.open();
  });

  if ('dismissed' in payment) return { success: false, dismissed: true };
  if ('error' in payment) return { success: false, error: payment.error };

  const verified = await invoke<{ success: boolean; trial_started?: boolean; subscription?: Subscription | null }>(
    'verify-autopay-mandate',
    { ...payment.response },
    'We received your ₹1 but could not finish setting up AutoPay. It will complete automatically within a few minutes.'
  );
  if (!verified.data?.success) return { success: false, error: verified.error };

  return {
    success: true,
    trialStarted: verified.data.trial_started,
    subscription: verified.data.subscription,
  };
}

export async function cancelAutopay(businessId: string): Promise<{ cancelled: boolean; error?: string }> {
  const result = await invoke<{ cancelled: boolean }>(
    'cancel-autopay',
    { business_id: businessId },
    'Could not cancel AutoPay. Please try again or contact support.'
  );
  return result.data?.cancelled ? { cancelled: true } : { cancelled: false, error: result.error };
}
