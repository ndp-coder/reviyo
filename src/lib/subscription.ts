import type { Subscription } from '@/lib/types';

/**
 * Mirrors business_has_active_subscription() in the database: a trial or paid
 * plan that has not yet expired. The database is what actually enforces this;
 * the dashboard uses it only to decide which pages to show.
 */
export function hasSubscriptionAccess(subscription: Subscription | null): boolean {
  if (!subscription || !subscription.expires_at) return false;
  if (subscription.status !== 'trial' && subscription.status !== 'active') return false;
  return new Date(subscription.expires_at).getTime() > Date.now();
}

/** Dashboard pages that stay open without a subscription: renew, and data rights. */
export const PATHS_OPEN_WITHOUT_SUBSCRIPTION = ['/dashboard/billing', '/dashboard/settings'];
