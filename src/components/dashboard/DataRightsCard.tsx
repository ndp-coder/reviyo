import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Download, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { legal, displayValue } from '@/config/legal';
import { Card, Button, Input } from '@/components/ui';
import {
  exportMyData,
  downloadDataExport,
  deleteMyAccount,
  DELETE_CONFIRMATION_PHRASE,
} from '@/lib/data-rights';

/**
 * Self-service Data Principal rights for the signed-in account holder.
 *
 * DPDPA s.11 (access) and s.12 (correction and erasure) both require these to
 * be available, and s.6(4) requires withdrawing consent to be as easy as
 * giving it. Making the owner email support for them would not meet that bar,
 * so both actions run here, immediately, with no ticket and no fee.
 */
export function DataRightsCard({ businessSlug }: { businessSlug?: string }) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [exported, setExported] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    setExported(false);

    const { data, error } = await exportMyData();
    setExporting(false);

    if (error || !data) {
      setExportError(error ?? 'Could not prepare your data export.');
      return;
    }

    downloadDataExport(data, businessSlug);
    setExported(true);
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);

    const result = await deleteMyAccount(confirmText.trim());
    setDeleting(false);

    if (!result.deleted) {
      setDeleteError(result.error ?? 'Could not delete your account.');
      return;
    }

    navigate('/', { replace: true });
  }

  const confirmationMatches = confirmText.trim() === DELETE_CONFIRMATION_PHRASE;

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <ShieldCheck className="h-4 w-4 text-gray-600" aria-hidden="true" />
          Your data
        </h2>
        <p className="mt-1.5 text-sm text-gray-600">
          Under the Digital Personal Data Protection Act, 2023 you can get a copy of everything we
          hold about you, and you can have it erased. Both are free and take effect immediately.
        </p>

        <div className="mt-5 rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900">Download a copy of your data</h3>
          <p className="mt-1 text-sm text-gray-600">
            A JSON file with your account, business profile, review topics, customer review sessions,
            private feedback, analytics, subscriptions, and payment records — plus the list of
            processors we share data with.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={handleExport} loading={exporting}>
              <Download className="h-4 w-4" aria-hidden="true" /> Download my data
            </Button>
            {exported && (
              <span role="status" aria-live="polite" className="text-sm font-medium text-green-700">
                Downloaded.
              </span>
            )}
          </div>
          {exportError && (
            <p role="alert" className="mt-2 text-sm font-medium text-red-700">
              {exportError}
            </p>
          )}
        </div>
      </Card>

      <Card className="border-red-300 p-6">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-red-800">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          Delete your account
        </h2>
        <p className="mt-1.5 text-sm text-gray-700">
          This permanently deletes your account, your business profile, your QR code and review page,
          your review topics, all customer review sessions, all private feedback, and your analytics.
          Your review page will stop working immediately and any printed QR code will go dead.
        </p>
        <p className="mt-2 text-sm text-gray-700">
          <strong>It cannot be undone,</strong> and it does not by itself refund anything — if you
          want a refund too, request it{' '}
          <Link to="/refunds" className="text-brand-700 underline underline-offset-2">
            first
          </Link>
          , while we can still find your records.
        </p>
        <p className="mt-2 text-sm text-gray-700">
          One thing is kept: records of payments you actually made — the order reference, amount, and
          date — are retained for 8 years because tax and company law requires it. Nothing else
          survives. This is set out in clause 7 of the{' '}
          <Link to="/privacy" className="text-brand-700 underline underline-offset-2">
            Privacy Policy
          </Link>
          .
        </p>

        {!confirmOpen ? (
          <Button variant="danger" className="mt-5" onClick={() => setConfirmOpen(true)}>
            <Trash2 className="h-4 w-4" aria-hidden="true" /> Delete my account and all data
          </Button>
        ) : (
          <div className="mt-5 rounded-lg border border-red-300 bg-red-50 p-4">
            <label
              htmlFor="delete-confirm"
              className="block text-sm font-medium text-red-900"
            >
              Type <span className="font-mono">{DELETE_CONFIRMATION_PHRASE}</span> to confirm
            </label>
            <div className="mt-2">
              <Input
                id="delete-confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                autoComplete="off"
                aria-describedby="delete-confirm-hint"
                placeholder={DELETE_CONFIRMATION_PHRASE}
              />
            </div>
            <p id="delete-confirm-hint" className="mt-1.5 text-xs text-red-900">
              Exact match required, including capitals.
            </p>

            {deleteError && (
              <p role="alert" className="mt-2 text-sm font-medium text-red-800">
                {deleteError}
              </p>
            )}

            <div className="mt-4 flex flex-wrap gap-3">
              <Button
                variant="danger"
                disabled={!confirmationMatches}
                loading={deleting}
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Permanently delete everything
              </Button>
              <Button
                variant="ghost"
                disabled={deleting}
                onClick={() => {
                  setConfirmOpen(false);
                  setConfirmText('');
                  setDeleteError(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-gray-900">Questions, or a complaint</h2>
        <p className="mt-1.5 text-sm text-gray-600">
          For anything about your personal data, email{' '}
          <a
            href={`mailto:${legal.privacyEmail}`}
            className="text-brand-700 underline underline-offset-2"
          >
            {displayValue(legal.privacyEmail)}
          </a>
          . If you are not satisfied with our answer, our grievance officer under section 13 of the
          DPDPA is{' '}
          <a
            href={`mailto:${legal.grievanceEmail}`}
            className="text-brand-700 underline underline-offset-2"
          >
            {displayValue(legal.grievanceEmail)}
          </a>
          , and you can escalate beyond that to the Data Protection Board of India. Full details are
          on our{' '}
          <Link to="/contact" className="text-brand-700 underline underline-offset-2">
            Contact page
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
