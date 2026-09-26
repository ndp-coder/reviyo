import { supabase } from '@/lib/supabase';
import { readFunctionError } from '@/lib/function-errors';

/**
 * Data Principal rights for Reviyo account holders, under sections 11 and 12
 * of the Digital Personal Data Protection Act, 2023.
 */

export interface DataExport {
  exported_at: string;
  notice: string;
  account: Record<string, unknown> | null;
  businesses: unknown[];
  review_topics: unknown[];
  review_sessions: unknown[];
  private_feedback: unknown[];
  analytics_events: unknown[];
  subscriptions: unknown[];
  payment_orders: unknown[];
  shared_with: string[];
}

/** Right of access (s.11): everything we hold that is linked to this account. */
export async function exportMyData(): Promise<{ data?: DataExport; error?: string }> {
  const { data, error } = await supabase.rpc('export_my_data');

  if (error) {
    return { error: error.message || 'Could not prepare your data export.' };
  }
  if (!data) {
    return { error: 'Could not prepare your data export.' };
  }

  return { data: data as DataExport };
}

/** Triggers a browser download of the export as a JSON file. */
export function downloadDataExport(data: DataExport, businessSlug?: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  link.href = url;
  link.download = `reviyo-data-export-${businessSlug ?? 'account'}-${date}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** The exact phrase a user must type before erasure proceeds. */
export const DELETE_CONFIRMATION_PHRASE = 'DELETE MY ACCOUNT';

export interface DeleteAccountResult {
  deleted: boolean;
  deleted_at?: string;
  financial_records_retained?: number;
  error?: string;
}

/**
 * Right to erasure (s.12(3)). Permanently deletes the signed-in account and
 * every record attached to it. Paid-invoice records are retained separately
 * for the statutory bookkeeping period — this is disclosed in the Privacy
 * Policy retention table and in the confirmation dialog.
 */
export async function deleteMyAccount(confirmation: string): Promise<DeleteAccountResult> {
  if (confirmation !== DELETE_CONFIRMATION_PHRASE) {
    return { deleted: false, error: `Type "${DELETE_CONFIRMATION_PHRASE}" to confirm.` };
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (!accessToken) {
    return { deleted: false, error: 'Your session has expired. Please sign in again.' };
  }

  try {
    const { data, error } = await supabase.functions.invoke<DeleteAccountResult>(
      'delete-account',
      { body: { confirmation } }
    );

    if (error) {
      return {
        deleted: false,
        error: await readFunctionError(error, 'Could not delete your account. Please try again or contact support.'),
      };
    }
    if (!data?.deleted) {
      return { deleted: false, error: data?.error || 'Could not delete your account.' };
    }

    // The account no longer exists; clear the local session so the app does not
    // keep trying to use a token for a deleted user.
    await supabase.auth.signOut();

    return data;
  } catch (err) {
    return {
      deleted: false,
      error: err instanceof Error ? err.message : 'Could not delete your account.',
    };
  }
}
