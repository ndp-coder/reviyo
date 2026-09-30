import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, BarChart3, MessageSquare, QrCode, Settings, CreditCard, LogOut, Menu, X, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { BrandLogo } from '@/components/BrandLogo';
import { SkipLink } from '@/components/SkipLink';
import { legal, displayValue } from '@/config/legal';
import { Alert, Button, Skeleton } from '@/components/ui';
import { getCategoryLabel } from '@/config/categories';
import { hasSubscriptionAccess, PATHS_OPEN_WITHOUT_SUBSCRIPTION } from '@/lib/subscription';
import { paymentGate, type PaymentGate } from '@/lib/payment-gate';
import type { AutopayMandate, Business, Subscription } from '@/lib/types';

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessError, setBusinessError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // undefined = still loading, null = no subscription row at all.
  const [subscription, setSubscription] = useState<Subscription | null | undefined>(undefined);
  const [subscriptionCheckFailed, setSubscriptionCheckFailed] = useState(false);
  // Whether this business has ever paid; see paymentGate.
  const [gate, setGate] = useState<PaymentGate | undefined>(undefined);
  // Latest AutoPay setup, so Overview can say whether a charge is coming.
  const [mandate, setMandate] = useState<Pick<AutopayMandate, 'status' | 'plan' | 'method'> | null>(null);
  // Unread private feedback, shown next to the nav item: it is the one thing an
  // owner usually needs to act on.
  const [newFeedbackCount, setNewFeedbackCount] = useState(0);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadBusiness() {
      if (!user) return;
      setBusinessError(false);
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      // A failed request is not the same as "no business": sending an existing
      // owner to onboarding on a network blip would be wrong.
      if (error) {
        setBusinessError(true);
        return;
      }
      if (!data) {
        navigate('/onboarding', { replace: true });
        return;
      }
      setBusiness(data as Business);
    }
    loadBusiness();
    return () => {
      cancelled = true;
    };
  }, [user, navigate, reloadKey]);

  // Close the mobile menu on navigation and with the Escape key.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Opening the mobile menu moves focus into it; Escape closes it and returns
  // focus to the menu button, so keyboard users are never stranded.
  useEffect(() => {
    if (!sidebarOpen) return;
    sidebarRef.current?.querySelector<HTMLElement>('nav a, nav button')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false);
        menuButtonRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarOpen]);

  // Refreshed on every page change, and by the feedback page itself whenever
  // it changes a status, so the badge never disagrees with the list.
  const refreshFeedbackCount = useCallback(async () => {
    if (!business) return;
    const { count } = await supabase
      .from('private_feedback')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .eq('status', 'new');
    setNewFeedbackCount(count ?? 0);
  }, [business]);

  useEffect(() => {
    void refreshFeedbackCount();
  }, [refreshFeedbackCount, location.pathname]);

  const refreshSubscription = useCallback(async () => {
    if (!business) return;
    const [{ data, error }, mandateRes, paid] = await Promise.all([
      supabase
        .from('subscriptions')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('autopay_mandates')
        .select('status, plan, method')
        .eq('business_id', business.id)
        .neq('status', 'created')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      paymentGate(business.id),
    ]);
    // A failed lookup must not lock out a paying owner. The database enforces
    // access regardless, so the UI stays open and lets that decide.
    setSubscriptionCheckFailed(Boolean(error || mandateRes.error));
    setSubscription((data as Subscription | null) ?? null);
    setMandate((mandateRes.data as Pick<AutopayMandate, 'status' | 'plan' | 'method'> | null) ?? null);
    setGate(paid);
  }, [business]);

  // Owners who have never paid (the ₹1 AutoPay check or a plan) belong on
  // onboarding's payment step, not in the app: a new owner who refreshed or
  // left during payment, or an existing owner on the old sign-up-only free
  // trial. Settings stays reachable for account deletion.
  const notPaid = gate === 'not_paid';

  useEffect(() => {
    refreshSubscription();
  }, [refreshSubscription]);

  const subscriptionLoaded = subscription !== undefined;
  const hasAccess = subscriptionLoaded && (subscriptionCheckFailed || hasSubscriptionAccess(subscription));
  const isOpenPath = (path: string) =>
    PATHS_OPEN_WITHOUT_SUBSCRIPTION.some((open) => path === open || path.startsWith(`${open}/`));

  const navItems = [
    { to: '/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
    { to: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
    { to: '/dashboard/feedback', label: 'Private feedback', icon: MessageSquare, badge: newFeedbackCount },
    { to: '/dashboard/qr', label: 'QR code', icon: QrCode },
    { to: '/dashboard/billing', label: 'Billing', icon: CreditCard },
    { to: '/dashboard/settings', label: 'Settings', icon: Settings },
  ];

  const currentItem = [...navItems].reverse().find((item) =>
    item.end ? location.pathname === item.to : location.pathname.startsWith(item.to)
  );

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SkipLink />
      {/* Mobile header */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="flex min-w-0 items-center gap-3">
          <BrandLogo className="h-8 w-auto flex-shrink-0" />
          {currentItem && (
            <span className="truncate border-l border-gray-200 pl-3 text-sm font-medium text-gray-800">
              {currentItem.label}
            </span>
          )}
        </div>
        {/* The toggle was an unnamed icon button. aria-expanded and aria-controls
            let assistive tech report whether the menu is open and what it opens. */}
        <button
          ref={menuButtonRef}
          type="button"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-expanded={sidebarOpen}
          aria-controls="dashboard-sidebar"
          aria-label={sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
          className="-mr-1 flex h-11 w-11 items-center justify-center rounded-lg hover:bg-gray-100"
        >
          {sidebarOpen ? (
            <X className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Menu className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        id="dashboard-sidebar"
        aria-label="Dashboard"
        className={`fixed top-0 left-0 z-40 flex h-full w-64 flex-col border-r border-gray-200 bg-white transition-[transform,visibility] duration-200 lg:visible lg:translate-x-0 ${
          // `invisible` takes the closed mobile menu out of the tab order, so
          // keyboard users don't tab through links they can't see.
          sidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full'
        }`}
      >
        <div className="flex items-center px-5 py-4 border-b border-gray-100">
          <BrandLogo className="h-11 w-auto max-w-full" />
        </div>

        {business && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              {business.logo_url ? (
                <img
                  src={business.logo_url}
                  alt={`${business.name} logo`}
                  className="h-9 w-9 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-200 text-gray-700 text-sm font-medium">
                  {business.name.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{business.name}</p>
                <p className="text-xs text-gray-600 truncate">{getCategoryLabel(business.category)}</p>
              </div>
            </div>
          </div>
        )}

        <nav aria-label="Dashboard sections" className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {navItems.map((item) => {
            if (subscriptionLoaded && !hasAccess && !isOpenPath(item.to)) {
              return (
                <span
                  key={item.to}
                  aria-disabled="true"
                  title="Renew your plan to use this"
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-500 cursor-not-allowed"
                >
                  <item.icon className="h-4 w-4" aria-hidden="true" />
                  {item.label}
                  <Lock className="ml-auto h-3.5 w-3.5" aria-label="Locked" />
                </span>
              );
            }
            return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-gray-700 hover:bg-gray-100'
                }`
              }
            >
              <item.icon className="h-4 w-4" aria-hidden="true" />
              {item.label}
              {item.badge ? (
                <span className="ml-auto rounded-full bg-brand-900 px-2 py-0.5 text-xs font-semibold tabular-nums text-white">
                  {item.badge}
                  <span className="sr-only"> new</span>
                </span>
              ) : null}
            </NavLink>
            );
          })}
        </nav>

        <div className="border-t border-gray-100 p-3">
          <button
            type="button"
            onClick={handleSignOut}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 w-full"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/30 animate-fade-in lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <main id="main-content" tabIndex={-1} className="lg:ml-64 min-h-screen flex flex-col">
        <div className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full">
          {subscriptionLoaded && !hasAccess && (
            <Alert variant="error" className="mb-6">
              {subscription ? (
                <>
                  Your {subscription.status === 'trial' ? 'free trial' : 'plan'} has ended. Your QR code now sends
                  customers straight to Google; AI review drafting and your dashboard are paused until you{' '}
                  <Link to="/dashboard/billing" className="font-medium underline underline-offset-2">renew</Link>.
                </>
              ) : (
                <>
                  Start your free trial to switch on AI review drafting and your dashboard.{' '}
                  <Link to="/dashboard/billing" className="font-medium underline underline-offset-2">Set it up</Link>.
                </>
              )}
            </Alert>
          )}
          {businessError ? (
            <div className="mx-auto max-w-md py-16">
              <Alert variant="error" title="We couldn’t load your business">
                Check your connection and try again.
              </Alert>
              <Button className="mt-4" onClick={() => setReloadKey((key) => key + 1)}>
                Try again
              </Button>
            </div>
          ) : !business || !subscriptionLoaded ? (
            // Placeholder in the shape of a page, so nothing jumps when it loads.
            <div role="status" aria-label="Loading your dashboard">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="mt-2 h-4 w-72 max-w-full" />
              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
              <Skeleton className="mt-6 h-64" />
            </div>
          ) : notPaid && location.pathname !== '/dashboard/settings' ? (
            <Navigate to="/onboarding" replace />
          ) : !hasAccess && !isOpenPath(location.pathname) ? (
            <Navigate to="/dashboard/billing" replace />
          ) : (
            <Outlet context={{ business, setBusiness, subscription, mandate, refreshSubscription, refreshFeedbackCount }} />
          )}
        </div>

        <footer className="border-t border-gray-200 px-6 py-5 lg:px-8">
          <nav aria-label="Legal and policies" className="max-w-6xl mx-auto">
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[
                { to: '/terms', label: 'Terms' },
                { to: '/privacy', label: 'Privacy' },
                { to: '/cookies', label: 'Cookies' },
                { to: '/refunds', label: 'Refunds' },
                { to: '/contact', label: 'Contact' },
              ].map((link) => (
                <li key={link.to}>
                  <Link
                    to={link.to}
                    className="text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li className="text-xs text-gray-600">
                Support:{' '}
                <a
                  href={`mailto:${legal.supportEmail}`}
                  className="underline underline-offset-2 hover:text-gray-900"
                >
                  {displayValue(legal.supportEmail)}
                </a>
              </li>
            </ul>
          </nav>
        </footer>
      </main>
    </div>
  );
}
