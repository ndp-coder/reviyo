import type { DashboardStats } from '@/lib/use-dashboard-stats';

// Last result per business, kept for this browser tab. Moving between Overview
// and Analytics shows these numbers immediately while fresh ones load, instead
// of a skeleton every time. Kept apart from use-dashboard-stats so signing out
// can clear it without loading the Supabase client on public pages.
export const dashboardStatsCache = new Map<string, DashboardStats>();

/** Forgets every cached business's numbers, e.g. when the owner signs out. */
export function clearDashboardStatsCache() {
  dashboardStatsCache.clear();
}
