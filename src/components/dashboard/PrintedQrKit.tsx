import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Package, Truck } from 'lucide-react';
import { Alert, Badge, Button, Card, Input, Select, Skeleton } from '@/components/ui';
import { INDIAN_STATES, isIndianMobile, isIndianPincode, normalizeIndianMobile } from '@/config/india';
import { legal } from '@/config/legal';
import { printArtwork } from '@/lib/print-artwork';
import { loadPrintKit, saveDeliveryAddress, type AddressInput } from '@/lib/print-orders';
import type { Business, DeliveryAddress, QrPrintOrder, QrPrintOrderStatus } from '@/lib/types';

const STATUS_BADGE: Record<QrPrintOrderStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'info' }> = {
  awaiting_address: { label: 'Needs your address', variant: 'warning' },
  ready: { label: 'Going to the printer', variant: 'info' },
  sent_to_printer: { label: 'Being printed', variant: 'info' },
  shipped: { label: 'Shipped', variant: 'success' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

/** Once the printer has it, the address on the order can no longer change. */
const LOCKED: QrPrintOrderStatus[] = ['sent_to_printer', 'shipped', 'delivered'];

const emptyForm: AddressInput = {
  recipientName: '',
  phone: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  pincode: '',
};

const fromAddress = (a: DeliveryAddress): AddressInput => ({
  recipientName: a.recipient_name,
  phone: a.phone,
  addressLine1: a.address_line1,
  addressLine2: a.address_line2,
  city: a.city,
  state: a.state,
  pincode: a.pincode,
});

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

type Errors = Partial<Record<keyof AddressInput, string>>;

function validate(form: AddressInput): Errors {
  const errors: Errors = {};
  if (form.recipientName.trim().length < 2) errors.recipientName = 'Enter the name of the person who will receive it.';
  if (!isIndianMobile(normalizeIndianMobile(form.phone))) errors.phone = 'Enter a 10-digit Indian mobile number.';
  if (form.addressLine1.trim().length < 5) errors.addressLine1 = 'Enter the shop or building and street.';
  if (form.city.trim().length < 2) errors.city = 'Enter the city or town.';
  if (!form.state) errors.state = 'Choose the state.';
  if (!isIndianPincode(form.pincode)) errors.pincode = 'Enter a 6-digit PIN code.';
  return errors;
}

function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * The free printed QR kit on the QR code page: a preview of exactly what gets
 * printed, the delivery address, and where the order is.
 */
export function PrintedQrKit({ business }: { business: Business }) {
  const [order, setOrder] = useState<QrPrintOrder | null>(null);
  const [form, setForm] = useState<AddressInput>(emptyForm);
  const [hasSavedAddress, setHasSavedAddress] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const artwork = useMemo(() => printArtwork(business.name, business.slug), [business.name, business.slug]);

  useEffect(() => {
    let cancelled = false;
    loadPrintKit(business.id).then((state) => {
      if (cancelled) return;
      if (!state) {
        setLoadFailed(true);
      } else {
        setOrder(state.order);
        if (state.address) {
          setForm(fromAddress(state.address));
          setHasSavedAddress(true);
        }
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  const set = (key: keyof AddressInput) => (value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setSaved(false);
  };

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    setSaveError(null);
    const result = await saveDeliveryAddress(business.id, form);
    setSaving(false);
    if ('error' in result) {
      setSaveError(result.error);
      return;
    }
    setOrder(result.order);
    setHasSavedAddress(true);
    setSaved(true);
  }

  const locked = order !== null && LOCKED.includes(order.status);

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
          <Package className="h-4 w-4 text-brand-700" aria-hidden="true" /> Free printed QR stand and table card
        </h2>
        {order && <Badge variant={STATUS_BADGE[order.status].variant}>{STATUS_BADGE[order.status].label}</Badge>}
      </div>
      <p className="mt-1 text-sm text-gray-600">
        Your plan includes a QR table stand and a table tent card with your business name, printed and delivered free
        anywhere in India. It goes to the printer automatically after your first plan payment.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* Exactly what gets printed: the same template the printer receives. */}
        <div className="grid grid-cols-2 gap-3 self-start">
          <figure>
            <img
              src={svgDataUrl(artwork.stand)}
              alt={`Printed table stand: ${business.name}, "Scan to review us on Google", your QR code, and "by Reviyo"`}
              className="w-full rounded-lg border border-gray-200 bg-white shadow-sm"
            />
            <figcaption className="mt-1.5 text-center text-xs text-gray-600">Table stand, 4 × 6 in</figcaption>
          </figure>
          <figure>
            <img
              src={svgDataUrl(artwork.tentCard)}
              alt={`Printed table tent card for ${business.name}, shown flat before folding`}
              className="mx-auto h-full max-h-[22rem] w-auto rounded-lg border border-gray-200 bg-white shadow-sm"
            />
            <figcaption className="mt-1.5 text-center text-xs text-gray-600">Tent card, shown flat (folds in half)</figcaption>
          </figure>
        </div>

        <div>
          {loading ? (
            <div role="status" aria-label="Loading delivery details" className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-48" />
            </div>
          ) : loadFailed ? (
            <Alert variant="error">We couldn’t load your delivery details. Reload the page to try again.</Alert>
          ) : (
            <>
              <OrderStatus order={order} hasSavedAddress={hasSavedAddress} />
              {saved && (
                <Alert variant="success" className="mt-3">
                  {order?.status === 'sent_to_printer' ? 'Address saved and your order has gone to the printer.' : 'Address saved.'}
                </Alert>
              )}

              {locked && order ? (
                <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800">
                  <p className="flex items-center gap-1.5 font-medium text-gray-900">
                    <MapPin className="h-4 w-4" aria-hidden="true" /> Delivering to
                  </p>
                  <address className="mt-1.5 not-italic leading-6">
                    {order.recipient_name}
                    <br />
                    {order.address_line1}
                    {order.address_line2 ? (
                      <>
                        <br />
                        {order.address_line2}
                      </>
                    ) : null}
                    <br />
                    {order.city}, {order.state} {order.pincode}
                    <br />
                    Phone: {order.phone}
                  </address>
                  <p className="mt-3 text-xs text-gray-600">
                    Something wrong? Write to{' '}
                    <a className="font-medium text-brand-700 underline underline-offset-2" href={`mailto:${legal.supportEmail}`}>
                      {legal.supportEmail}
                    </a>{' '}
                    straight away and we&apos;ll fix it before it ships.
                  </p>
                </div>
              ) : order?.status === 'cancelled' ? null : (
                <form onSubmit={handleSubmit} noValidate className="mt-4 space-y-3">
                  <h3 className="text-sm font-semibold text-gray-900">Delivery address</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      label="Receiver’s name"
                      autoComplete="name"
                      maxLength={80}
                      value={form.recipientName}
                      onChange={(e) => set('recipientName')(e.target.value)}
                      error={errors.recipientName}
                    />
                    <Input
                      label="Mobile number"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      maxLength={20}
                      placeholder="98765 43210"
                      value={form.phone}
                      onChange={(e) => set('phone')(e.target.value)}
                      error={errors.phone}
                      hint="For the courier only."
                    />
                  </div>
                  <Input
                    label="Shop or building, street"
                    autoComplete="address-line1"
                    maxLength={120}
                    value={form.addressLine1}
                    onChange={(e) => set('addressLine1')(e.target.value)}
                    error={errors.addressLine1}
                  />
                  <Input
                    label="Area or landmark (optional)"
                    autoComplete="address-line2"
                    maxLength={120}
                    value={form.addressLine2}
                    onChange={(e) => set('addressLine2')(e.target.value)}
                  />
                  <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,0.8fr)]">
                    <Input
                      label="City or town"
                      autoComplete="address-level2"
                      maxLength={60}
                      value={form.city}
                      onChange={(e) => set('city')(e.target.value)}
                      error={errors.city}
                    />
                    <div>
                      <Select
                        label="State"
                        autoComplete="address-level1"
                        value={form.state}
                        onChange={(e) => set('state')(e.target.value)}
                        aria-invalid={errors.state ? true : undefined}
                      >
                        <option value="">Choose…</option>
                        {INDIAN_STATES.map((state) => (
                          <option key={state} value={state}>
                            {state}
                          </option>
                        ))}
                      </Select>
                      {errors.state && <p className="mt-1.5 text-xs font-medium text-red-700">{errors.state}</p>}
                    </div>
                    <Input
                      label="PIN code"
                      inputMode="numeric"
                      autoComplete="postal-code"
                      value={form.pincode}
                      // Digits only, then at most six, so a pasted "520 010" still fits.
                      onChange={(e) => set('pincode')(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      error={errors.pincode}
                    />
                  </div>

                  <p className="text-xs text-gray-600">
                    We share these details only with our print partner and courier, to deliver your kit. See our{' '}
                    <Link to="/privacy" className="font-medium text-brand-700 underline underline-offset-2">
                      Privacy Policy
                    </Link>{' '}
                    and{' '}
                    <Link to="/shipping" className="font-medium text-brand-700 underline underline-offset-2">
                      Shipping Policy
                    </Link>
                    .
                  </p>

                  {saveError && <Alert variant="error">{saveError}</Alert>}

                  <Button type="submit" loading={saving}>
                    <Truck className="h-4 w-4" aria-hidden="true" /> {hasSavedAddress ? 'Update address' : 'Save address'}
                  </Button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function OrderStatus({ order, hasSavedAddress }: { order: QrPrintOrder | null; hasSavedAddress: boolean }) {
  if (!order) {
    return (
      <Alert variant="info">
        {hasSavedAddress
          ? 'Your address is saved. Your stand and card go to the printer automatically after your first plan payment.'
          : 'Ships after your first plan payment (the ₹1 AutoPay check doesn’t count). Add your address now and it goes to the printer the moment you pay.'}
      </Alert>
    );
  }
  switch (order.status) {
    case 'awaiting_address':
      return <Alert variant="warning">Thanks for your payment! Add your delivery address below and we’ll send your stand and card to the printer.</Alert>;
    case 'ready':
      return <Alert variant="info">Address received. Your order goes to the printer automatically within a few hours.</Alert>;
    case 'sent_to_printer':
      return (
        <Alert variant="success">
          Sent to the printer
          {order.sent_to_printer_at ? ` on ${formatDate(order.sent_to_printer_at)}` : ''}. It usually arrives within{' '}
          {legal.printedKitDeliveryTime}. We’ll email you the tracking number when it ships.
        </Alert>
      );
    case 'shipped':
      return (
        <Alert variant="success">
          Shipped{order.shipped_at ? ` on ${formatDate(order.shipped_at)}` : ''} by {order.courier}. Tracking number:{' '}
          <span className="font-semibold">{order.tracking_number}</span>
        </Alert>
      );
    case 'delivered':
      return <Alert variant="success">Delivered{order.delivered_at ? ` on ${formatDate(order.delivered_at)}` : ''}. Put it where customers pay or wait.</Alert>;
    case 'cancelled':
      return (
        <Alert variant="info">
          This order was cancelled. Questions? Write to {legal.supportEmail}.
        </Alert>
      );
  }
}
