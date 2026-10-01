import type { SubscriptionPlan } from '@/lib/types';

export interface DeveloperSummary {
  businesses: number; users: number; trials: number; paying: number; expired: number;
  aiDrafts: number; started: number; paidTotal: number; paid30Days: number;
  failedPayments: number; mandatesAttention: number; payoutsAttention: number;
  pendingPayouts: number; paused: number;
}
export interface DeveloperOperations {
  payments: { id: string; order_id: string; payment_id: string | null; amount: number; currency: string; plan: SubscriptionPlan; status: string; created_at: string; kind: string; business_name: string; email: string | null }[];
  mandates: { id: string; status: string; failed_attempts: number; updated_at: string; business_name: string }[];
  activity: { id: string; business_name: string; action: string; reason: string; created_at: string; actor_email: string | null }[];
}
export interface DeveloperSetup { emailReady: boolean; payoutsReady: boolean; enabled: boolean; schedulerReady: boolean }
export type DeveloperSection = 'overview' | 'businesses' | 'payments' | 'partners' | 'activity' | 'setup';
export const developerDate = (value: string) => new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
