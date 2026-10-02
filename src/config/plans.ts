import type { SubscriptionPlan } from '@/lib/types';

/**
 * Plan prices in rupees, for display everywhere: marketing pages, Billing, and
 * AutoPay setup. The server holds the authoritative paise values; keep these in
 * step with it. Lives in config (not lib/autopay) so prerendered marketing pages
 * can import it without pulling in the Supabase client.
 */
export const PLANS: Record<SubscriptionPlan, { label: string; price: number; months: number }> = {
  '1_month': { label: 'Monthly', price: 500, months: 1 },
  '6_months': { label: '6 months', price: 1999, months: 6 },
  '12_months': { label: '12 months', price: 2999, months: 12 },
};

export const PLAN_ORDER: SubscriptionPlan[] = ['1_month', '6_months', '12_months'];

/** The longer plan, highlighted as the better deal. */
export const BEST_VALUE_PLAN: SubscriptionPlan = '12_months';

export function formatRupees(amount: number): string {
  return `₹${amount.toLocaleString('en-IN')}`;
}

/** Rounded monthly equivalent, e.g. "₹250/month". */
export function perMonth(plan: SubscriptionPlan): string {
  const { price, months } = PLANS[plan];
  return `${formatRupees(Math.round(price / months))}/month`;
}

export function planTerm(plan: SubscriptionPlan): string {
  const months = PLANS[plan].months;
  return `${months} ${months === 1 ? 'month' : 'months'}`;
}

export function billingPeriod(plan: SubscriptionPlan): string {
  return PLANS[plan].months === 1 ? 'every month' : `every ${planTerm(plan)}`;
}

export const PLAN_SUMMARY = PLAN_ORDER.map(plan => `${formatRupees(PLANS[plan].price)} for ${planTerm(plan)}`).join(' or ');

/** What the annual plan saves over twelve monthly purchases. */
export const YEARLY_SAVING = PLANS['1_month'].price * 12 - PLANS['12_months'].price;

/** Everything a subscription includes — identical for every term. */
export const PLAN_FEATURES = [
  '1 business, 1 location, 1 Google Business Profile',
  'Custom QR code (PNG and SVG) and printable counter card',
  'AI-assisted review drafting in the customer’s own words',
  'Customisable review topics',
  'Private feedback inbox',
  'Analytics dashboard with conversion funnel',
  'Email support',
];
