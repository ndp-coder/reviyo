import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, Plus, X } from 'lucide-react';
import QRCode from 'qrcode';
import { Button, Card, IconButton, Input } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button-styles';
import { reviewUrlFor, toSourceId, WHATSAPP_SOURCE } from '@/lib/review-source';
import type { Business } from '@/lib/types';

interface PlacedCode {
  id: string;
  label: string;
}

const MAX_CODES = 20;
const storageKey = (businessId: string) => `reviyo:qr-codes:${businessId}`;

function loadCodes(businessId: string): PlacedCode[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey(businessId)) ?? '[]');
    return Array.isArray(parsed)
      ? parsed.filter((c): c is PlacedCode => typeof c?.id === 'string' && typeof c?.label === 'string')
      : [];
  } catch {
    return [];
  }
}

/**
 * Applies one change to the list as it is saved right now — not to this tab's
 * possibly stale copy — so two open tabs can never wipe out each other's codes.
 */
function updateSavedCodes(businessId: string, change: (codes: PlacedCode[]) => PlacedCode[]): PlacedCode[] {
  const next = change(loadCodes(businessId));
  try {
    localStorage.setItem(storageKey(businessId), JSON.stringify(next));
  } catch {
    // Storage unavailable: codes still work, the list just isn't remembered.
  }
  return next;
}

function CodeRow({ business, code, onRemove }: { business: Business; code: PlacedCode; onRemove: () => void }) {
  const url = reviewUrlFor(window.location.origin, business.slug, code.id);
  const [dataUrl, setDataUrl] = useState('');

  useEffect(() => {
    QRCode.toDataURL(url, { width: 600, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
      .then(setDataUrl)
      .catch(console.error);
  }, [url]);

  return (
    <li className="flex items-center gap-3 py-3">
      {dataUrl ? (
        <img src={dataUrl} alt={`QR code for ${code.label}`} className="h-16 w-16 flex-shrink-0 rounded-lg border border-gray-200" />
      ) : (
        <div className="h-16 w-16 flex-shrink-0 animate-pulse rounded-lg bg-gray-100" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-gray-900">{code.label}</p>
        <p className="truncate font-mono text-xs text-gray-600">?src={code.id}</p>
      </div>
      {dataUrl && (
        <a href={dataUrl} download={`${business.slug}-qr-${code.id}.png`} className={buttonClasses({ variant: 'outline', size: 'sm' })}>
          <Download className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Download</span>
          <span className="sr-only sm:hidden">Download QR code for {code.label}</span>
        </a>
      )}
      <IconButton tone="danger" onClick={onRemove} aria-label={`Remove ${code.label} from this list`}>
        <X className="h-4 w-4" aria-hidden="true" />
      </IconButton>
    </li>
  );
}

/**
 * Separate QR codes for different spots — a table, the front desk, one
 * doctor's room. They all open the same review page; each one's scans and
 * Google hand-offs are counted separately in Analytics.
 */
export function ExtraQrCodes({ business }: { business: Business }) {
  const [codes, setCodes] = useState<PlacedCode[]>(() => loadCodes(business.id));
  const [label, setLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Pick up codes created or removed in another tab.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(business.id)) setCodes(loadCodes(business.id));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [business.id]);

  function addCode(event: FormEvent) {
    event.preventDefault();
    const trimmed = label.trim();
    const id = toSourceId(trimmed);
    if (!id) {
      setError('Use letters or numbers, like “Table 4” or “Front desk”.');
      return;
    }
    if (id === WHATSAPP_SOURCE) {
      setError('“WhatsApp” is taken by the WhatsApp message link. Pick another name.');
      return;
    }
    const saved = loadCodes(business.id);
    if (saved.some((c) => c.id === id)) {
      setError('You already have a QR code with that name.');
      return;
    }
    if (saved.length >= MAX_CODES) {
      setError(`You can keep up to ${MAX_CODES} extra QR codes here.`);
      return;
    }
    setCodes(updateSavedCodes(business.id, (current) => [...current, { id, label: trimmed }]));
    setLabel('');
    setError(null);
  }

  return (
    <Card className="p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-900">More QR codes</h2>
      <p className="mt-0.5 text-sm text-gray-600">
        Make one for each spot — a table, the front desk, a staff member — and{' '}
        <Link to="/dashboard/analytics" className="font-medium text-brand-700 underline underline-offset-2">
          Analytics
        </Link>{' '}
        shows which one brings in the most reviews. They all open the same review page.
      </p>

      <form onSubmit={addCode} className="mt-4 flex gap-2" noValidate>
        <div className="flex-1">
          <Input
            aria-label="Where will this QR code go?"
            placeholder="e.g. Table 4, Front desk, Dr. Rao"
            value={label}
            maxLength={60}
            error={error ?? undefined}
            onChange={(e) => {
              setLabel(e.target.value);
              if (error) setError(null);
            }}
          />
        </div>
        <Button type="submit" variant="outline" disabled={!label.trim()}>
          <Plus className="h-4 w-4" aria-hidden="true" /> Create
        </Button>
      </form>

      {codes.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100">
          {codes.map((code) => (
            <CodeRow
              key={code.id}
              business={business}
              code={code}
              onRemove={() => setCodes(updateSavedCodes(business.id, (current) => current.filter((c) => c.id !== code.id)))}
            />
          ))}
        </ul>
      )}

      <p className="mt-3 text-xs text-gray-600">
        This list is kept in this browser. Removing a code here doesn&apos;t stop a printed copy from working, and
        its scans stay in Analytics.
      </p>
    </Card>
  );
}
