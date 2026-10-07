import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Alert, Button, Spinner } from '@/components/ui';

type Destination = {
  userId: string;
  path: '/partners' | '/onboarding' | null;
  failed: boolean;
};

/** Resolve the signed-in account using server access, never signup metadata.
 * Keep explicit owner invitation links on /onboarding; only generic auth pages
 * use this redirect, so an owner can still open their prepared business setup.
 */
export function AccountRedirect() {
  const { user, profile, loading, signOut } = useAuth();
  const [destination, setDestination] = useState<Destination | null>(null);
  const [attempt, setAttempt] = useState(0);
  const userId = user?.id;
  const admin = profile?.id === userId && profile?.role === 'admin';

  useEffect(() => {
    if (loading || !userId || admin) return;
    const accountId = userId;
    let cancelled = false;
    setDestination({ userId, path: null, failed: false });
    async function resolve() {
      try {
        const { data, error } = await supabase.rpc('my_partner_access');
        if (error || typeof data?.invited !== 'boolean') throw new Error('Could not check account access.');
        if (!cancelled) setDestination({ userId: accountId, path: data.invited ? '/partners' : '/onboarding', failed: false });
      } catch {
        // A failed lookup must not send a partner into owner signup or payment.
        if (!cancelled) setDestination({ userId: accountId, path: null, failed: true });
      }
    }
    void resolve();
    return () => { cancelled = true; };
  }, [userId, admin, loading, attempt]);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && admin) return <Navigate to="/admin" replace />;
  if (!loading && destination && destination.userId === userId) {
    if (destination.path) return <Navigate to={destination.path} replace />;
    if (destination.failed) return <main id="main-content" className="mx-auto max-w-md space-y-4 px-5 py-12">
      <Alert variant="error">You are signed in, but we could not find your dashboard. Check your connection and try again.</Alert>
      <div className="flex flex-wrap gap-3">
        <Button onClick={() => { setDestination(null); setAttempt(value => value + 1); }}>Try again</Button>
        <Button variant="ghost" onClick={() => void signOut()}>Sign out</Button>
      </div>
    </main>;
  }
  return <div className="flex min-h-screen items-center justify-center gap-3 px-5" role="status">
    <Spinner /><p className="text-sm text-gray-600">Opening your dashboard…</p>
  </div>;
}
