import { supabase } from '@/lib/supabase';

export type PaymentGate = 'paid' | 'not_paid' | 'unknown';

/** A refundable mandate check alone never unlocks onboarding. Honour paid
 * orders and existing access (including trials granted before their removal).
 * Failed lookups stay unknown so owners are not prompted to pay twice.
 */
export async function paymentGate(businessId: string): Promise<PaymentGate> {
  const [access, orders] = await Promise.all([
    supabase.from('subscriptions').select('id').eq('business_id', businessId)
      .in('status', ['active', 'trial']).gt('expires_at', new Date().toISOString()).limit(1),
    supabase.from('payment_orders').select('id').eq('business_id', businessId)
      .eq('status', 'paid').limit(1),
  ]);
  if (access.error || orders.error) return 'unknown';
  return access.data.length > 0 || orders.data.length > 0 ? 'paid' : 'not_paid';
}
