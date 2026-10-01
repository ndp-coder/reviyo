import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Alert, Badge, Button, Card, EmptyState, Input, Select, Skeleton, Textarea } from '@/components/ui';
import { PLANS } from '@/config/plans';
import type { SubscriptionPlan } from '@/lib/types';
import { developerDate } from '@/pages/admin/developer-types';

interface BusinessRow {
  id: string; name: string; slug: string; category: string; is_active: boolean;
  created_at: string; email: string | null; full_name: string | null;
  plan: SubscriptionPlan | null; expires_at: string | null; access: string;
}
interface Directory { total: number; rows: BusinessRow[] }

export function BusinessDirectory({ refresh, onChange }: { refresh: number; onChange: () => void }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [offset, setOffset] = useState(0);
  const [directory, setDirectory] = useState<Directory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<BusinessRow | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null); setSelected(null); setReason('');
    void supabase.rpc('developer_businesses', { p_search: search, p_filter: filter, p_offset: offset }).then(({ data, error: problem }) => {
      if (cancelled) return;
      if (problem || !data) setError('Could not load businesses. Refresh and try again.');
      else setDirectory(data as Directory);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [search, filter, offset, refresh]);

  async function changeAccess(event: FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    const active = !selected.is_active;
    const businessName = selected.name;
    setSaving(true); setError(null); setNotice(null);
    const { error: problem } = await supabase.rpc('developer_set_business_access', { p_id: selected.id, p_active: active, p_expected_active: selected.is_active, p_reason: reason.trim() });
    if (problem) setError(problem.message);
    else { setNotice(`${businessName}: review page ${active ? 'restored' : 'paused'}. The change was recorded.`); setSelected(null); setReason(''); onChange(); }
    setSaving(false);
  }

  return <section aria-labelledby="business-directory-heading" className="mt-6 space-y-4">
    <h2 id="business-directory-heading" className="text-lg font-semibold">Business directory</h2>
    <Card className="p-4 sm:p-5"><form className="flex flex-col gap-3 sm:flex-row sm:items-end" onSubmit={(event) => { event.preventDefault(); setOffset(0); setSearch(input.trim()); }}>
      <Input label="Search businesses or owner emails" type="search" maxLength={200} value={input} onChange={(e) => setInput(e.target.value)} />
      <Select label="Access" value={filter} onChange={(e) => { setFilter(e.target.value); setOffset(0); }}><option value="all">All businesses</option><option value="active">Paid access</option><option value="trial">Live trial</option><option value="unpaid">No subscription yet</option><option value="expired">No current access</option><option value="paused">Review page paused</option></Select>
      <Button type="submit" disabled={saving} className="shrink-0">Search</Button>
    </form></Card>
    {error && <Alert variant="error">{error}</Alert>}
    {notice && <Alert variant="success">{notice}</Alert>}
    {loading ? <div role="status" aria-label="Loading businesses" className="space-y-3">{[0,1,2].map((i) => <Skeleton key={i} className="h-28" />)}</div> : directory && <>
      <p className="text-sm text-gray-600">{directory.total.toLocaleString('en-IN')} matching businesses{directory.rows.length > 0 && ` · showing ${offset + 1}–${offset + directory.rows.length}`}</p>
      {!directory.rows.length && <Card><EmptyState title="No matching businesses" description="Try another name, email or access filter." /></Card>}
      <ul className="space-y-3">{directory.rows.map((b) => <li key={b.id}><Card className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words font-semibold">{b.name}</h3><p className="break-all text-sm text-gray-600">{b.full_name || 'Business owner'} · {b.email || 'Email unavailable'}</p></div><Badge variant={b.access === 'active' ? 'success' : b.access === 'paused' ? 'error' : 'default'}>{({ active: 'Paid access', trial: 'Live trial', unpaid: 'No subscription', expired: 'No current access', paused: 'Review page paused' } as Record<string,string>)[b.access]}</Badge></div>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-xs text-gray-600">Business type</dt><dd>{b.category}</dd></div><div><dt className="text-xs text-gray-600">Plan / expiry</dt><dd>{b.plan ? PLANS[b.plan].label : 'Not started'}{b.expires_at && ` · ${developerDate(b.expires_at)}`}</dd></div><div><dt className="text-xs text-gray-600">Joined</dt><dd>{developerDate(b.created_at)}</dd></div></dl>
        <div className="mt-4 flex flex-wrap items-center gap-3"><Link to={`/r/${b.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-brand-700 underline">Open public review page</Link><Button size="sm" variant="outline" disabled={saving} onClick={() => { setSelected(b); setReason(''); setError(null); }}>{b.is_active ? 'Pause review page' : 'Restore review page'}</Button></div>
        {selected?.id === b.id && <form className="mt-4 space-y-3 border-t border-gray-200 pt-4" onSubmit={(event) => void changeAccess(event)}>
          <Alert variant="warning">{b.is_active ? 'Customers will no longer be able to start reviews on this business’s QR page.' : 'The QR page will become available again if the business has current subscription access.'} Existing payment mandates and billing are unaffected.</Alert>
          <Textarea label="Reason for this change" required minLength={5} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex flex-wrap gap-2"><Button type="submit" loading={saving} disabled={reason.trim().length < 5}>Confirm {b.is_active ? 'pause' : 'restore'}</Button><Button type="button" variant="ghost" disabled={saving} onClick={() => setSelected(null)}>Cancel</Button></div>
        </form>}
      </Card></li>)}</ul>
      <div className="flex items-center justify-between gap-3"><Button variant="outline" disabled={!offset || saving} onClick={() => setOffset(Math.max(0,offset-20))}>Previous</Button><span className="text-sm text-gray-600">Page {Math.floor(offset/20)+1}</span><Button variant="outline" disabled={offset+20>=directory.total || saving} onClick={() => setOffset(offset+20)}>Next</Button></div>
    </>}
  </section>;
}
