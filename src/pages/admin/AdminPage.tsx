import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CreditCard, AlertTriangle, PenLine, Users, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { BrandLogo } from '@/components/BrandLogo';
import { Alert, Button, Card, Skeleton, Badge, PageHeader } from '@/components/ui';
import { SiteTrafficCard } from './SiteTrafficCard';

export function AdminPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    businessCount: 0,
    activeSubs: 0,
    expiredSubs: 0,
    aiGenerations: 0,
    totalUsers: 0,
    subscriptionsStarted: 0,
    payingNow: 0,
    loading: true,
    error: null as string | null,
  });

  useEffect(() => {
    async function loadAdminStats() {
      try {
        // Counted by the database. Fetching the rows and counting them here
        // stopped at 1,000, the most Supabase returns in one request.
        const countRows = (table: string) => supabase.from(table).select('*', { count: 'exact', head: true });
        const [businessesRes, usersRes, aiRes, subsRes, activeRes, expiredRes, payingRes] = await Promise.all([
          countRows('businesses'),
          countRows('profiles'),
          countRows('ai_generation_log'),
          countRows('subscriptions'),
          countRows('subscriptions').in('status', ['active', 'trial']),
          countRows('subscriptions').eq('status', 'expired'),
          countRows('subscriptions').eq('status', 'active').gt('expires_at', new Date().toISOString()),
        ]);

        const queryError =
          businessesRes.error ?? usersRes.error ?? aiRes.error ?? subsRes.error ??
          activeRes.error ?? expiredRes.error ?? payingRes.error;
        if (queryError) throw queryError;

        setStats({
          businessCount: businessesRes.count ?? 0,
          activeSubs: activeRes.count ?? 0,
          expiredSubs: expiredRes.count ?? 0,
          aiGenerations: aiRes.count ?? 0,
          totalUsers: usersRes.count ?? 0,
          // A subscription row exists once a business starts its AutoPay trial
          // or pays once, so every row is a business past the payment step.
          subscriptionsStarted: subsRes.count ?? 0,
          payingNow: payingRes.count ?? 0,
          loading: false,
          error: null,
        });
      } catch {
        setStats((prev) => ({ ...prev, loading: false, error: 'Could not load admin statistics.' }));
      }
    }
    loadAdminStats();
  }, []);

  const statCards = [
    { label: 'Businesses', value: stats.businessCount, icon: Building2 },
    { label: 'Trial or active subscriptions', value: stats.activeSubs, icon: CreditCard },
    { label: 'Expired subscriptions', value: stats.expiredSubs, icon: AlertTriangle },
    { label: 'AI drafts written', value: stats.aiGenerations, icon: PenLine },
    { label: 'Users', value: stats.totalUsers, icon: Users },
  ];

  // Where new owners drop off, from data the database already holds: no extra
  // tracking. Each stage is a subset of the one before it.
  const funnel = [
    { label: 'Created an account', value: stats.totalUsers },
    { label: 'Set up a business', value: stats.businessCount },
    { label: 'Started a trial or paid', value: stats.subscriptionsStarted },
    { label: 'Paying now', value: stats.payingNow },
  ];

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <BrandLogo className="h-9 w-auto" />
            <Badge variant="info">Admin</Badge>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </Button>
        </div>
      </header>
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <PageHeader title="Admin dashboard" description="System overview and usage statistics." />

      {stats.loading ? (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : stats.error ? (
        <Alert variant="error" className="mt-6">{stats.error}</Alert>
      ) : (
        <div className="mt-6 grid grid-cols-2 lg:grid-cols-3 gap-4">
          {statCards.map((stat) => (
            <Card key={stat.label} className="p-4 sm:p-5">
              <stat.icon className="h-5 w-5 text-brand-700" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
              <p className="mt-0.5 text-sm text-gray-600">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {!stats.loading && !stats.error && (
        <Card className="mt-6 p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-900">Owner signup funnel</h2>
          <p className="mt-0.5 text-xs text-gray-600">All time. The biggest drop between two stages is where owners give up.</p>
          <ol className="mt-4 space-y-3">
            {funnel.map((stage, i) => {
              const previous = i > 0 ? funnel[i - 1].value : null;
              return (
                <li key={stage.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-gray-700">{stage.label}</span>
                  <span className="flex items-baseline gap-2">
                    {previous !== null && previous > 0 && (
                      <span className="text-xs text-gray-600">{Math.round((stage.value / previous) * 100)}% of previous</span>
                    )}
                    <span className="font-semibold tabular-nums text-gray-900">{stage.value}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      <SiteTrafficCard />
      </main>
    </div>
  );
}
