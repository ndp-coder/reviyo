import { Building2, CircleDollarSign, CreditCard, PenLine, Users } from 'lucide-react';
import { Button, Card } from '@/components/ui';
import { formatRupees } from '@/config/plans';
import { SiteTrafficCard } from '@/pages/admin/SiteTrafficCard';
import type { DeveloperSection, DeveloperSummary } from '@/pages/admin/developer-types';

export function DeveloperOverview({ summary: s, refresh, open }: { summary: DeveloperSummary; refresh: number; open: (section: DeveloperSection) => void }) {
  const metrics = [
    { label: 'Businesses', value: s.businesses.toLocaleString('en-IN'), detail: `${s.paused} review pages paused`, icon: Building2 },
    { label: 'Paying businesses', value: s.paying.toLocaleString('en-IN'), detail: `${s.trials} live trials · ${s.expired} without current access`, icon: CreditCard },
    { label: 'Paid orders · last 30 days', value: formatRupees(s.paid30Days/100), detail: `${formatRupees(s.paidTotal/100)} all time`, icon: CircleDollarSign },
    { label: 'Accounts', value: s.users.toLocaleString('en-IN'), detail: 'Includes developer accounts', icon: Users },
    { label: 'AI drafts written', value: s.aiDrafts.toLocaleString('en-IN'), detail: 'Draft generation log · all time', icon: PenLine },
  ];
  const attention = [
    { label: 'Failed payment orders · last 7 days', value: s.failedPayments, section: 'payments' as const },
    { label: 'AutoPay mandates to inspect', value: s.mandatesAttention, section: 'payments' as const },
    { label: 'Commission transfers needing review', value: s.payoutsAttention, section: 'partners' as const },
  ];
  const funnel = [ ['Accounts created',s.users], ['Businesses prepared',s.businesses], ['Trial or subscription started',s.started], ['Paying businesses now',s.paying] ] as const;
  return <div className="mt-6 space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map((m) => <Card key={m.label} className="p-4"><m.icon className="h-5 w-5 text-brand-700" aria-hidden="true" /><p className="mt-3 text-xs font-medium text-gray-600">{m.label}</p><p className="mt-1 break-words text-2xl font-semibold tabular-nums">{m.value}</p><p className="mt-2 text-xs text-gray-600">{m.detail}</p></Card>)}</div>
    <p className="text-xs text-gray-600">Paid-order totals are recorded payments in INR before refunds, disputes, gateway fees or partner commissions. They are not bank settlement totals.</p>
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5"><h2 className="font-semibold">Needs attention</h2><p className="mt-1 text-sm text-gray-600">Open a section to investigate these records.</p><ul className="mt-3 divide-y divide-gray-200">{attention.map((a) => <li key={a.label} className="flex items-center justify-between gap-3 py-3"><div><p className="text-sm">{a.label}</p><p className={`text-xl font-semibold tabular-nums ${a.value ? 'text-amber-800' : 'text-gray-900'}`}>{a.value}</p></div><Button variant="outline" size="sm" onClick={() => open(a.section)}>Inspect</Button></li>)}</ul><p className="mt-3 text-sm text-gray-600">Pending partner transfers: <span className="font-semibold text-gray-900">{formatRupees(s.pendingPayouts/100)}</span></p></Card>
      <Card className="p-5"><h2 className="font-semibold">Account and business progress</h2><p className="mt-1 text-sm text-gray-600">Unique businesses at each stage. Current paying access can fall after a plan expires.</p><ol className="mt-4 space-y-4">{funnel.map(([label,value],i) => <li key={label}><div className="flex justify-between gap-3 text-sm"><span>{label}</span><span className="font-semibold tabular-nums">{value}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><div className="h-full bg-brand-700" style={{ width: `${s.users ? Math.min(100,value/s.users*100) : 0}%` }} /></div>{i>0 && <p className="mt-1 text-xs text-gray-600">{funnel[i-1][1] ? Math.round(value/funnel[i-1][1]*100) : 0}% of the preceding stage</p>}</li>)}</ol><Button className="mt-5" variant="outline" size="sm" onClick={() => open('businesses')}>Explore businesses</Button></Card>
    </div>
    <SiteTrafficCard key={refresh} />
  </div>;
}
