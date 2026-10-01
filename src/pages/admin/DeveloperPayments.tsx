import { useState } from 'react';
import { Alert, Badge, Card, EmptyState, Input, Select } from '@/components/ui';
import { formatRupees, PLANS } from '@/config/plans';
import { developerDate, type DeveloperOperations } from '@/pages/admin/developer-types';

export function DeveloperPayments({ operations }: { operations: DeveloperOperations }) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const rows = operations.payments.filter((p) => (status === 'all' || p.status === status) && `${p.business_name} ${p.email ?? ''} ${p.order_id} ${p.payment_id ?? ''}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <section className="mt-6 space-y-4" aria-labelledby="developer-payments-heading">
    <h2 id="developer-payments-heading" className="text-lg font-semibold">Payment orders</h2>
    <Alert variant="info">The latest 50 orders are shown. A recorded payment is not a bank settlement; check Razorpay for refunds, disputes and settlement details.</Alert>
    <Card className="grid gap-3 p-4 sm:grid-cols-2"><Input label="Find a business, email or payment reference" type="search" value={search} onChange={(e) => setSearch(e.target.value)} /><Select label="Order status" value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All recent orders</option><option value="paid">Paid</option><option value="failed">Failed</option><option value="created">Created</option><option value="attempted">Attempted</option></Select></Card>
    {!rows.length && <Card><EmptyState title="No matching recent orders" description="Try another reference or status." /></Card>}
    <ul className="space-y-3">{rows.map((p) => <li key={p.id}><Card className="p-4"><div className="flex flex-wrap justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{p.business_name}</h3><p className="break-all text-sm text-gray-600">{p.email || 'Owner email unavailable'}</p></div><div className="flex items-center gap-2"><span className="font-semibold">{p.currency === 'INR' ? formatRupees(p.amount/100) : `${p.currency} ${(p.amount/100).toFixed(2)}`}</span><Badge variant={p.status === 'paid' ? 'success' : p.status === 'failed' ? 'error' : 'default'}>{p.status}</Badge></div></div><p className="mt-2 text-sm text-gray-600">{PLANS[p.plan].label} · {p.kind === 'autopay' ? 'AutoPay' : 'One-time checkout'} · {developerDate(p.created_at)}</p><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2"><div><dt className="text-gray-600">Razorpay order</dt><dd className="break-all font-mono">{p.order_id}</dd></div><div><dt className="text-gray-600">Payment reference</dt><dd className="break-all font-mono">{p.payment_id || 'Not captured in this record'}</dd></div></dl></Card></li>)}</ul>
    <Card className="p-5"><h2 className="font-semibold">AutoPay mandates to inspect</h2><p className="mt-1 text-sm text-gray-600">Latest 20 paused, rejected or failed mandates. Inspect the original mandate in Razorpay before making changes.</p>{!operations.mandates.length ? <EmptyState title="No AutoPay issues recorded" /> : <ul className="mt-3 divide-y divide-gray-200">{operations.mandates.map((m) => <li key={m.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{m.business_name}</p><p className="text-xs text-gray-600">{m.failed_attempts} failed attempts · {developerDate(m.updated_at)}</p></div><Badge variant="warning">{m.status}</Badge></li>)}</ul>}</Card>
  </section>;
}
