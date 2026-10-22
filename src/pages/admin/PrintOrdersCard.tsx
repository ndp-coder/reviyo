import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, Input, Skeleton } from '@/components/ui';
import { printArtwork } from '@/lib/print-artwork';
import type { QrPrintOrder, QrPrintOrderStatus } from '@/lib/types';

type AdminPrintOrder = QrPrintOrder & { businesses: { name: string; slug: string } | { name: string; slug: string }[] | null };

const STATUS: Record<QrPrintOrderStatus, { label: string; variant: 'default' | 'success' | 'warning' | 'info' | 'error' }> = {
  awaiting_address: { label: 'Waiting for address', variant: 'warning' },
  ready: { label: 'Ready for printer', variant: 'info' },
  sent_to_printer: { label: 'With printer', variant: 'info' },
  shipped: { label: 'Shipped', variant: 'success' },
  delivered: { label: 'Delivered', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const business = (o: AdminPrintOrder) => (Array.isArray(o.businesses) ? o.businesses[0] : o.businesses) ?? null;

function download(filename: string, svg: string) {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Printed QR kits: orders go to the printer by email automatically; here an
 * admin records shipping (courier + tracking), delivery, or a cancellation,
 * and can re-download the print files.
 */
export function PrintOrdersCard() {
  const [orders, setOrders] = useState<AdminPrintOrder[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tracking, setTracking] = useState<Record<string, { courier: string; number: string }>>({});

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('qr_print_orders')
      .select('*, businesses(name, slug)')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) setFailed(true);
    else setOrders((data as AdminPrintOrder[]) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function update(
    order: AdminPrintOrder,
    status: 'shipped' | 'delivered' | 'cancelled',
    shipping?: { courier: string; number: string },
  ) {
    if (status === 'cancelled' && !window.confirm(`Cancel the printed QR kit for ${business(order)?.name ?? 'this business'}?`)) return;
    setBusy(order.id);
    setMessage(null);
    const { error } = await supabase.rpc('admin_update_print_order', {
      p_order_id: order.id,
      p_status: status,
      p_courier: status === 'shipped' ? shipping?.courier ?? '' : null,
      p_tracking_number: status === 'shipped' ? shipping?.number ?? '' : null,
    });
    setBusy(null);
    if (error) {
      setMessage({ type: 'error', text: error.code === 'P0001' ? error.message : 'Could not update the order.' });
      return;
    }
    setMessage({
      type: 'success',
      text:
        status === 'shipped'
          ? 'Marked shipped. The owner gets the tracking number by email on the next scheduled run.'
          : status === 'delivered'
            ? 'Marked delivered.'
            : 'Order cancelled.',
    });
    await load();
  }

  const waiting = orders?.filter((o) => o.status === 'awaiting_address').length ?? 0;

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-900">Printed QR kits</h2>
      <p className="mt-0.5 text-xs text-gray-600">
        Each paid business gets one table stand and tent card. Orders with an address are emailed to the printer
        automatically; record the courier and tracking number here when they ship.
        {waiting > 0 ? ` ${waiting} waiting for the owner's address.` : ''}
      </p>

      {message && (
        <Alert variant={message.type} className="mt-4">
          {message.text}
        </Alert>
      )}

      {failed ? (
        <Alert variant="info" className="mt-4">
          Printed QR orders aren&apos;t available yet. They start once the latest database update is applied
          (<code>supabase db push</code>).
        </Alert>
      ) : !orders ? (
        <div role="status" aria-label="Loading printed QR orders" className="mt-4 space-y-2">
          <Skeleton className="h-20" />
          <Skeleton className="h-20" />
        </div>
      ) : orders.length === 0 ? (
        <p className="mt-4 text-sm text-gray-600">No printed QR orders yet. One appears when a business makes its first payment.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {orders.map((order) => {
            const biz = business(order);
            const t = tracking[order.id] ?? { courier: order.courier ?? '', number: order.tracking_number ?? '' };
            const canShip = order.status === 'ready' || order.status === 'sent_to_printer' || order.status === 'shipped';
            return (
              <li key={order.id} className="py-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">{order.business_name ?? biz?.name ?? 'Business'}</span>
                  <Badge variant={STATUS[order.status].variant}>{STATUS[order.status].label}</Badge>
                  <span className="text-xs text-gray-600">Paid {formatDate(order.created_at)}</span>
                </div>
                {order.recipient_name ? (
                  <p className="mt-1 text-gray-700">
                    {order.recipient_name}, {order.address_line1}
                    {order.address_line2 ? `, ${order.address_line2}` : ''}, {order.city}, {order.state} {order.pincode} · {order.phone}
                  </p>
                ) : (
                  <p className="mt-1 text-gray-600">No address yet. The owner has been emailed for it.</p>
                )}
                {order.status === 'shipped' && (
                  <p className="mt-1 text-gray-700">
                    {order.courier} · {order.tracking_number}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-end gap-2">
                  {biz && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const files = printArtwork(order.business_name ?? biz.name, biz.slug);
                        download(`${biz.slug}-table-stand-4x6in.svg`, files.stand);
                        download(`${biz.slug}-table-tent-card-105x296mm.svg`, files.tentCard);
                      }}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" /> Print files
                    </Button>
                  )}
                  {canShip && (
                    <>
                      <div className="w-36">
                        <Input
                          aria-label="Courier"
                          placeholder="Courier"
                          value={t.courier}
                          onChange={(e) => setTracking((all) => ({ ...all, [order.id]: { ...t, courier: e.target.value } }))}
                        />
                      </div>
                      <div className="w-44">
                        <Input
                          aria-label="Tracking number"
                          placeholder="Tracking number"
                          value={t.number}
                          onChange={(e) => setTracking((all) => ({ ...all, [order.id]: { ...t, number: e.target.value } }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        loading={busy === order.id}
                        disabled={busy !== null || t.courier.trim().length < 2 || t.number.trim().length < 3}
                        onClick={() => void update(order, 'shipped', t)}
                      >
                        {order.status === 'shipped' ? 'Update tracking' : 'Mark shipped'}
                      </Button>
                    </>
                  )}
                  {order.status === 'shipped' && (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void update(order, 'delivered')}>
                      Mark delivered
                    </Button>
                  )}
                  {order.status !== 'delivered' && order.status !== 'cancelled' && (
                    <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => void update(order, 'cancelled')}>
                      Cancel
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
