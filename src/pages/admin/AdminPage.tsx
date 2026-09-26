import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, CreditCard, AlertTriangle, Sparkles, Users, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { BrandLogo } from '@/components/BrandLogo';
import { Alert, Button, Card, Skeleton, Badge, PageHeader } from '@/components/ui';

export function AdminPage() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    businessCount: 0,
    activeSubs: 0,
    expiredSubs: 0,
    aiGenerations: 0,
    totalUsers: 0,
    loading: true,
    error: null as string | null,
  });

  useEffect(() => {
    async function loadAdminStats() {
      try {
        const [businessesRes, subsRes, usersRes, aiRes] = await Promise.all([
          supabase.from('businesses').select('id', { count: 'exact', head: true }),
          supabase.from('subscriptions').select('status'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('ai_generation_log').select('id', { count: 'exact', head: true }),
        ]);

        const queryError = businessesRes.error ?? subsRes.error ?? usersRes.error ?? aiRes.error;
        if (queryError) throw queryError;

        const subs = subsRes.data ?? [];
        const active = subs.filter((s: { status: string }) => s.status === 'active' || s.status === 'trial').length;
        const expired = subs.filter((s: { status: string }) => s.status === 'expired').length;

        setStats({
          businessCount: businessesRes.count ?? 0,
          activeSubs: active,
          expiredSubs: expired,
          aiGenerations: aiRes.count ?? 0,
          totalUsers: usersRes.count ?? 0,
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
    { label: 'AI drafts written', value: stats.aiGenerations, icon: Sparkles },
    { label: 'Users', value: stats.totalUsers, icon: Users },
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
              <stat.icon className="h-5 w-5 text-blue-700" aria-hidden="true" />
              <p className="mt-3 text-2xl font-bold text-gray-900 tabular-nums">{stat.value}</p>
              <p className="mt-0.5 text-sm text-gray-600">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}
      </main>
    </div>
  );
}
