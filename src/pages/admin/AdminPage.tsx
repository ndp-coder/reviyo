import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Building2, CreditCard, LayoutDashboard, LogOut, RefreshCw, Settings, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { BrandLogo } from '@/components/BrandLogo';
import { SkipLink } from '@/components/SkipLink';
import { Alert, Badge, Button, PageHeader, Skeleton } from '@/components/ui';
import { CommissionDashboard } from '@/pages/partners/CommissionDashboard';
import { BusinessDirectory } from '@/pages/admin/BusinessDirectory';
import { DeveloperOverview } from '@/pages/admin/DeveloperOverview';
import { DeveloperPayments } from '@/pages/admin/DeveloperPayments';
import { DeveloperActivity } from '@/pages/admin/DeveloperActivity';
import { DeveloperSetup } from '@/pages/admin/DeveloperSetup';
import { developerDate, type DeveloperOperations, type DeveloperSection, type DeveloperSetup as Setup, type DeveloperSummary } from '@/pages/admin/developer-types';

const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'businesses', label: 'Businesses', icon: Building2 },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'partners', label: 'Partners', icon: Users },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'setup', label: 'Setup', icon: Settings },
] as const;

export function AdminPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [section, setSection] = useState<DeveloperSection>('overview');
  const [summary, setSummary] = useState<DeveloperSummary | null>(null);
  const [operations, setOperations] = useState<DeveloperOperations | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const request = useRef(0);

  const load = useCallback(async () => {
    const current = ++request.current;
    setLoading(true); setError(null);
    try {
      const [totals, records, config] = await Promise.all([
        supabase.rpc('developer_summary'), supabase.rpc('developer_operations'),
        supabase.functions.invoke('commission-access', { body: { action: 'setup' } }),
      ]);
      if (current !== request.current) return;
      if (totals.error || records.error || !totals.data || !records.data) throw new Error('Could not load developer records. Refresh and try again.');
      setSummary(totals.data as DeveloperSummary); setOperations(records.data as DeveloperOperations);
      setSetup(config.error ? null : config.data as Setup); setUpdated(new Date().toISOString());
    } catch { if (current === request.current) setError('Could not load developer records. Refresh and try again.'); }
    finally { if (current === request.current) setLoading(false); }
  }, []);
  const invalidateRequests = useCallback(() => { request.current++; }, []);
  useEffect(() => { void load(); return invalidateRequests; }, [load, invalidateRequests]);

  function refreshAll() { setRefresh((value) => value+1); void load(); }
  const navigation = <nav aria-label="Developer dashboard sections" className="mt-6 flex flex-wrap gap-2 border-b border-gray-200 pb-4">{sections.map(({id,label,icon:Icon}) => <Button key={id} variant={section === id ? 'primary' : 'outline'} size="sm" aria-pressed={section === id} onClick={() => setSection(id)}><Icon className="h-4 w-4" aria-hidden="true" />{label}</Button>)}</nav>;

  return <div className="min-h-screen bg-gray-50"><SkipLink /><header className="border-b border-gray-200 bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6"><div className="flex items-center gap-3"><BrandLogo className="h-9 w-auto" /><Badge variant="info">Developer</Badge></div><Button variant="ghost" size="sm" onClick={() => void signOut().then(() => navigate('/'))}><LogOut className="h-4 w-4" aria-hidden="true" />Sign out</Button></div></header>
    <main id="main-content" tabIndex={-1} className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8"><PageHeader title="Developer dashboard" description="Manage businesses, inspect payments and run your private partner programme." actions={<Button variant="outline" loading={loading} onClick={refreshAll}><RefreshCw className="h-4 w-4" aria-hidden="true" />Refresh dashboard</Button>} />
      {updated && <p className="mt-2 text-xs text-gray-600" role="status">Last refreshed {developerDate(updated)}</p>}
      {navigation}
      {error && <Alert variant="error" className="mt-4">{error}</Alert>}
      {section === 'businesses' ? <BusinessDirectory refresh={refresh} onChange={refreshAll} /> : section === 'partners' ? <CommissionDashboard key={refresh} developer /> : loading ? <div role="status" aria-label="Loading developer records" className="mt-6 grid gap-4 sm:grid-cols-2">{[0,1,2,3].map((i) => <Skeleton key={i} className="h-28" />)}</div> : <>
        {section === 'overview' && summary && <DeveloperOverview summary={summary} refresh={refresh} open={setSection} />}
        {section === 'payments' && operations && <DeveloperPayments operations={operations} />}
        {section === 'activity' && operations && <DeveloperActivity rows={operations.activity} />}
        {section === 'setup' && <DeveloperSetup setup={setup} />}
      </>}
    </main></div>;
}
