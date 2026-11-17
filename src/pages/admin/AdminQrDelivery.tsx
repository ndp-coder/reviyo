import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Alert, Button, Card, Input } from '@/components/ui';
import { formatRupees, PLANS } from '@/config/plans';
import { deliveryAddressLines, hasControlCharacters, standArtwork, type AdminQrDelivery as Delivery } from '@/lib/qr-stand';
import { reviewUrlFor } from '@/lib/review-source';
import { supabase } from '@/lib/supabase';

export function AdminQrDelivery({ id, name, onSaved }: { id: string; name: string; onSaved: () => void }) {
  const [delivery, setDelivery] = useState<Delivery | null>(null);
  const [tracking, setTracking] = useState('');
  const [date, setDate] = useState('');
  const [request, setRequest] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void supabase.rpc('admin_qr_delivery_details', { p_setup: id }).then(({ data, error: problem }) => {
      if (cancelled) return;
      if (problem || !data) { setError('Could not load QR delivery. Refresh and try again.'); return; }
      setError('');
      setDelivery(data as Delivery);
      setTracking(data.tracking_reference ?? '');
    });
    return () => { cancelled = true; };
  }, [id, request]);

  async function update(deliveredOn?: string) {
    setBusy(true); setError('');
    try {
      const { error: problem } = await supabase.rpc('update_admin_qr_delivery', {
        p_setup: id, p_tracking: deliveredOn ? null : tracking.trim(), p_delivered_on: deliveredOn ?? null,
      });
      if (problem) throw new Error(problem.message);
      setRequest(value => value + 1);
      onSaved();
    } catch (problem) { setError(problem instanceof Error ? problem.message : 'Could not save the delivery update.'); }
    finally { setBusy(false); }
  }

  async function downloadStand() {
    if (!delivery?.slug) return;
    try {
      const qr = await QRCode.toString(reviewUrlFor(delivery.slug), { type: 'svg', margin: 4 });
      const printedName = Array.from(name).filter(character => !hasControlCharacters(character)).slice(0, 80).join('').trim();
      const artwork = standArtwork(printedName || 'Review us', qr);
      const url = URL.createObjectURL(new Blob([artwork], { type: 'image/svg+xml' }));
      const download = document.createElement('a');
      download.href = url;
      download.download = `${delivery.slug}-review-stand.svg`;
      download.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setError('Could not prepare the review QR artwork. Try again.'); }
  }

  return <Card className="mt-6 space-y-4 p-5">
    <h3 className="font-semibold">QR stand delivery for {name}</h3>
    {error && <Alert variant="error">{error}</Alert>}
    {!delivery && <Button variant="outline" onClick={() => setRequest(value => value + 1)}>Refresh delivery status</Button>}
    {delivery && <>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div><p className="font-medium">Deliver to {delivery.address.recipient}</p><p>{deliveryAddressLines(delivery.address).join(', ')}</p><p>{delivery.address.phone}</p></div>
        <div><p className="font-medium">{delivery.method === 'cash' && delivery.cash_plan
          ? `Cash collected · ${formatRupees(PLANS[delivery.cash_plan].price)}`
          : delivery.paid ? 'Razorpay payment received' : 'Awaiting Razorpay payment'}</p>
          <p>{delivery.delivered_on ? `Delivered ${delivery.delivered_on} · plan started` : delivery.dispatch_date ? 'Dispatched · awaiting delivery' : 'Awaiting dispatch'}</p>
          {delivery.tracking_reference && <p className="break-all">Tracking reference {delivery.tracking_reference}</p>}
        </div>
      </div>
      {delivery.paid && delivery.slug && <Button variant="outline" onClick={() => void downloadStand()}>Download review QR stand artwork</Button>}
      {!delivery.paid && <p className="text-sm text-gray-600">The artwork becomes available once payment is recorded.</p>}
      {delivery.paid && delivery.slug && !delivery.delivered_on && <>
        <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void update(); }}>
          <Input label="Courier tracking or dispatch reference" value={tracking} onChange={event => setTracking(event.target.value)} maxLength={160} required />
          <Button type="submit" loading={busy} disabled={!tracking.trim()}>{delivery.dispatch_date ? 'Update tracking' : 'Mark dispatched'}</Button>
        </form>
        {delivery.dispatch_date && <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); if (date) void update(date); }}>
          <Input label="Date the owner received the stand" type="date" value={date} min={delivery.dispatch_date} onChange={event => setDate(event.target.value)} required />
          <Button type="submit" loading={busy} disabled={!date}>Confirm delivery and start plan</Button>
        </form>}
      </>}
      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRequest(value => value + 1)}>Refresh delivery status</Button>
    </>}
  </Card>;
}
