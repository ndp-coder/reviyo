import { supabase } from '@/lib/supabase';

export type PaymentGate = 'paid' | 'not_paid' | 'unknown';

/**
 * Whether a business has ever paid: the ₹1 AutoPay check (a mandate with an
 * authorisation payment) or a plan. Until it has, the owner is kept on
 * onboarding's payment step and the app stays closed — including owners who
 * hold the free trial every new business got before AutoPay existed.
 *
 * A failed lookup is 'unknown', and callers let the owner through: sending a
 * paying owner back to pay again would be worse, and the database enforces
 * access to paid features either way.
 */
export async function paymentGate(businessId: string): Promise<PaymentGate> {
  const [mandates, orders] = await Promise.all([
    supabase
      .from('autopay_mandates')
      .select('id')
      .eq('business_id', businessId)
      .not('auth_payment_id', 'is', null)
      .limit(1),
    supabase
      .from('payment_orders')
      .select('id')
      .eq('business_id', businessId)
      .eq('status', 'paid')
      .limit(1),
  ]);
  if (mandates.error || orders.error) return 'unknown';
  return mandates.data.length > 0 || orders.data.length > 0 ? 'paid' : 'not_paid';
}
