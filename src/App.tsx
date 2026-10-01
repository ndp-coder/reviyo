import { lazy, Suspense, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { Spinner } from '@/components/ui';
import { RouteMeta } from '@/components/RouteMeta';
import { ScrollToTop } from '@/components/ScrollToTop';
import { PageViewCounter } from '@/components/PageViewCounter';
import { TOOL_PATH } from '@/config/seo';

// Public marketing and policy pages are prerendered to static HTML for search
// engines and link previews (scripts/prerender.mjs). They are imported eagerly:
// the static renderer cannot wait for a lazy page and would output only the
// loading spinner. Everything else is for signed-in owners or customers
// scanning a QR code, and loads on demand.
import { LandingPage } from '@/pages/LandingPage';
import { PricingPage } from '@/pages/PricingPage';
import { PrivacyPolicyPage } from '@/pages/legal/PrivacyPolicyPage';
import { TermsPage } from '@/pages/legal/TermsPage';
import { CookiePolicyPage } from '@/pages/legal/CookiePolicyPage';
import { RefundPolicyPage } from '@/pages/legal/RefundPolicyPage';
import { ContactPage } from '@/pages/legal/ContactPage';
import { IndustriesPage } from '@/pages/marketing/IndustriesPage';
import { IndustryPage } from '@/pages/marketing/IndustryPage';
import { ReviewLinkGeneratorPage } from '@/pages/marketing/ReviewLinkGeneratorPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

const LoginPage = lazy(() => import('@/pages/auth/LoginPage').then((module) => ({ default: module.LoginPage })));
const SignupPage = lazy(() => import('@/pages/auth/SignupPage').then((module) => ({ default: module.SignupPage })));
const ResetPasswordPage = lazy(() => import('@/pages/auth/ResetPasswordPage').then((module) => ({ default: module.ResetPasswordPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/auth/ForgotPasswordPage').then((module) => ({ default: module.ForgotPasswordPage })));
const OnboardingPage = lazy(() => import('@/pages/onboarding/OnboardingPage').then((module) => ({ default: module.OnboardingPage })));
const DashboardLayout = lazy(() => import('@/pages/dashboard/DashboardLayout').then((module) => ({ default: module.DashboardLayout })));
const DashboardOverview = lazy(() => import('@/pages/dashboard/DashboardOverview').then((module) => ({ default: module.DashboardOverview })));
const AnalyticsPage = lazy(() => import('@/pages/dashboard/AnalyticsPage').then((module) => ({ default: module.AnalyticsPage })));
const PrivateFeedbackPage = lazy(() => import('@/pages/dashboard/PrivateFeedbackPage').then((module) => ({ default: module.PrivateFeedbackPage })));
const QRManagementPage = lazy(() => import('@/pages/dashboard/QRManagementPage').then((module) => ({ default: module.QRManagementPage })));
const SettingsPage = lazy(() => import('@/pages/dashboard/SettingsPage').then((module) => ({ default: module.SettingsPage })));
const BillingPage = lazy(() => import('@/pages/dashboard/BillingPage').then((module) => ({ default: module.BillingPage })));
const AdminPage = lazy(() => import('@/pages/admin/AdminPage').then((module) => ({ default: module.AdminPage })));
const CommissionDashboard = lazy(() => import('@/pages/partners/CommissionDashboard').then((module) => ({ default: module.CommissionDashboard })));
const CustomerReviewPage = lazy(() => import('@/pages/customer/CustomerReviewPage').then((module) => ({ default: module.CustomerReviewPage })));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center" role="status">
      <Spinner className="text-brand-600" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user || profile?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function OnboardingRoute({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace />;
  if (profile?.role === 'admin') return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <>
    <RouteMeta />
    <ScrollToTop />
    <PageViewCounter />
    <Suspense fallback={<PageLoader />}>
      <Routes>
      {/* Public marketing routes */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/for" element={<IndustriesPage />} />
      <Route path="/for/:slug" element={<IndustryPage />} />
      <Route path={TOOL_PATH} element={<ReviewLinkGeneratorPage />} />

      {/* Legal & policy routes. These must stay publicly reachable without auth:
          Razorpay merchant terms and the Consumer Protection (E-Commerce) Rules,
          2020 both require them to be accessible to anyone. */}
      <Route path="/privacy" element={<PrivacyPolicyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/cookies" element={<CookiePolicyPage />} />
      <Route path="/refunds" element={<RefundPolicyPage />} />
      <Route path="/contact" element={<ContactPage />} />

      {/* Auth routes */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {/* Customer review flow */}
      <Route path="/r/:slug" element={<CustomerReviewPage />} />

      {/* Onboarding */}
      <Route path="/onboarding" element={
        <OnboardingRoute><OnboardingPage /></OnboardingRoute>
      } />

      {/* Dashboard */}
      <Route path="/dashboard" element={
        <ProtectedRoute><DashboardLayout /></ProtectedRoute>
      }>
        <Route index element={<DashboardOverview />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="feedback" element={<PrivateFeedbackPage />} />
        <Route path="qr" element={<QRManagementPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="billing" element={<BillingPage />} />
      </Route>

      {/* Admin */}
      <Route path="/partners" element={<CommissionDashboard />} />
      <Route path="/admin" element={
        <AdminRoute><AdminPage /></AdminRoute>
      } />

      {/* Anything else is a real "page not found", never a silent redirect. */}
      <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
    </>
  );
}

export default App;
