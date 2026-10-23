import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Button, Card, Input } from '@/components/ui';
import { ReviewCounterCard } from '@/components/ReviewCounterCard';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { supabase } from '@/lib/supabase';
import { DELIVERY_CONSENT_VERSION, DELIVERY_FIELDS, EMPTY_DELIVERY_ADDRESS, standArtwork, validateDelivery, validatePrintedName, type DeliveryAddress } from '@/lib/qr-stand';
import type { Business } from '@/lib/types';

interface StandOrder { id: string; status: string; printed_name: string; }
interface Offer { enabled: boolean; supplier?: string; }

export function QrStandSetup({ business, qrDataUrl, qrSvg }: { business: Business; qrDataUrl?: string; qrSvg?: string }) {
  const [name, setName] = useState(business.name);
  const [address, setAddress] = useState<DeliveryAddress>({ ...EMPTY_DELIVERY_ADDRESS });
  const [consent, setConsent] = useState(false);
  const [offer, setOffer] = useState<Offer | null>(null);
  const [order, setOrder] = useState<StandOrder | null>(null);
  const [paid, setPaid] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    async function load() {
      const [offerRes, prefs, orders, payments] = await Promise.all([
        supabase.rpc('qr_stand_offer'),
        supabase.from('stand_preferences').select('printed_name, delivery_address').eq('business_id', business.id).maybeSingle(),
        supabase.from('stand_orders').select('id,status,printed_name').eq('business_id', business.id).maybeSingle(),
        supabase.from('payment_orders').select('id').eq('business_id', business.id).eq('status', 'paid').limit(1),
      ]);
      if (cancelled) return;
      if (offerRes.error || prefs.error || orders.error || payments.error) throw new Error('Stand details could not be loaded. Try again before saving.');
      setOffer(offerRes.data as Offer);
      setOrder(orders.data as StandOrder | null);
      setPaid(Boolean(payments.data.length));
      setName(prefs.data?.printed_name ?? business.name);
      setAddress({ ...EMPTY_DELIVERY_ADDRESS, ...prefs.data?.delivery_address });
      setLoading(false);
    }
    void load().catch(() => { if (!cancelled) { setError('Stand details could not be loaded. Try again before saving.'); setLoading(false); } });
    return () => { cancelled = true; };
  }, [business.id, business.name, retry]);
  const deliveryAvailable = Boolean(offer?.enabled && !paid && !order);
  async function save() {
    if (saving || loading || !offer) return;
    setError(null); setNotice(null);
    const nameProblem = validatePrintedName(name);
    if (nameProblem) { setError(nameProblem); return; }
    if (deliveryAvailable) {
      const problem = validateDelivery(address);
      if (problem) { setError(problem); return; }
      if (!consent) { setError('Accept the delivery privacy notice to save your address.'); return; }
    }
    setSaving(true);
    try {
      const { error: saveError } = await supabase.rpc('save_stand_preferences', {
        p_business_id: business.id, p_printed_name: name.trim(),
        p_address: deliveryAvailable ? { ...Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])), country: 'IN' } : null,
        p_consent_version: deliveryAvailable ? DELIVERY_CONSENT_VERSION : null,
      });
      if (saveError) throw saveError;
      setNotice(deliveryAvailable ? 'Design and delivery details saved. The first confirmed plan payment will queue one stand.' : 'Counter card name saved.');
      setConsent(false);
    } catch { setError('Could not save your details. Check your connection and try again before paying.'); }
    finally { setSaving(false); }
  }
  function downloadArtwork() {
    if (!qrSvg) return;
    const nameProblem = validatePrintedName(name);
    if (nameProblem) { setError(nameProblem); return; }
    const blob = new Blob([standArtwork(name.trim(), qrSvg)], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `${business.slug}-stand-sample.svg`; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <Card className="p-5 sm:p-8">
    <h2 className="text-base font-semibold text-gray-900">Customize your QR stand</h2>
    <p className="mt-2 text-sm text-gray-600">Your business name above the QR, with a small “QR by Reviyo” line below it. Your review link stays the same.</p>
    {loading ? <p role="status" className="mt-4 text-sm">Loading stand details…</p> : <div className="mt-4 space-y-4">
      {error && <Alert variant="error" action={!offer ? <Button variant="outline" onClick={() => setRetry(n => n + 1)}>Try again</Button> : undefined}>{error}</Alert>}
      <Input label="Business name on the card" value={name} maxLength={80} onChange={e => { setName(e.target.value); setNotice(null); }} disabled={!offer || saving} />
      {qrDataUrl && <><ReviewCounterCard businessName={name.trim() || business.name} qrImage={qrDataUrl} logoUrl={business.logo_url} /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => window.print()}>Print card</Button><Button variant="outline" disabled={!qrSvg || !name.trim()} onClick={downloadArtwork}>Download stand sample</Button></div><p className="text-xs text-gray-600">4 × 6 inch artwork preview. The supplier’s final print specification must be checked before production.</p></>}
      {order ? <p className="rounded-lg bg-brand-50 p-3 text-sm text-brand-950">Stand order for <strong>{order.printed_name}</strong>: {({ queued: 'Queued for the printing partner', submitting: 'Being submitted to the printing partner', submitted: 'Accepted by the printing partner', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', needs_attention: 'Delivery needs attention; contact support' } as Record<string, string>)[order.status] ?? 'Status unavailable'}. Renewals do not include another stand.</p>
        : deliveryAvailable ? <fieldset className="space-y-3"><legend className="font-semibold">One stand with your first paid plan</legend><p className="text-sm text-gray-600">Delivery within India. Check your name and address before paying; confirmed orders use the details saved at checkout.</p><div className="grid gap-3 sm:grid-cols-2">{DELIVERY_FIELDS.map(field => <Input key={field.key} label={field.label} value={address[field.key]} maxLength={field.max} autoComplete={field.autoComplete} inputMode={field.key === 'phone' || field.key === 'pincode' ? 'numeric' : 'text'} onChange={e => { setAddress(current => ({ ...current, [field.key]: e.target.value })); setNotice(null); }} disabled={saving} />)}</div><ConsentCheckbox checked={consent} onChange={setConsent}>I agree to share these delivery details with {offer?.supplier || 'the printing partner'} and its courier to print and deliver my stand. I have checked the details and read the <Link to="/privacy" target="_blank" className="underline">Privacy notice</Link>.</ConsentCheckbox></fieldset>
          : <p className="text-sm text-gray-600">{offer?.enabled && paid ? 'A stand is included only with the first paid purchase when the delivery offer is available. Existing purchases and renewals do not create a new stand order.' : 'Printed stand delivery is coming soon and is not included in payments made now. The planned offer is one stand with the first purchase of any plan once delivery opens. You can customize, download and print your card now.'}</p>}
      <Button loading={saving} disabled={!offer} onClick={() => void save()}>{deliveryAvailable ? 'Save design and delivery details' : 'Save customization'}</Button>
      {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
    </div>}
  </Card>;
}
