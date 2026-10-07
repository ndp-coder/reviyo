import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { clearDashboardStatsCache } from '@/lib/dashboard-stats-cache';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (
    email: string,
    password: string,
    termsConsentVersion: string
  ) => Promise<{ error: string | null; needsConfirmation?: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  /** Emails a one-time sign-in code (from support@reviyo.in) to an existing account. */
  sendSignInCode: (email: string) => Promise<{ error: string | null }>;
  /** Signs in with the code from that email. */
  verifySignInCode: (email: string, code: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Sets a new password for the signed-in (or password-recovery) session. */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// The Supabase client (about 140 KB with its fetch polyfill) is loaded when it
// is first needed rather than with every page. Public pages only use this
// provider to swap "Start free trial" for "Go to dashboard", which can happen
// a moment after the page has appeared. Pages that need Supabase straight away
// (dashboard, sign-in, the review page) import it themselves.
const loadSupabase = () => import('@/lib/supabase').then((module) => module.supabase);

async function attemptAuth(
  action: () => Promise<{ error: string | null; needsConfirmation?: boolean }>,
  failure: string,
) {
  try { return await action(); }
  catch { return { error: failure }; }
}

/** Supabase's password errors, reworded for the person resetting their password. */
function describePasswordUpdateError(message: string): string {
  if (/should be different|same.*password/i.test(message)) return 'Choose a password different from your current one.';
  if (/weak|at least|characters|pwned|leaked/i.test(message)) return 'That password is too easy to guess. Use at least 8 characters, mixing letters and numbers.';
  if (/expired|invalid|session|jwt/i.test(message)) return 'Your reset link has expired. Request a new one from the sign-in page.';
  return 'We couldn’t save your new password. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // Held in a ref: this router hands out a new navigate function on every page
  // change, and the auth listener below must subscribe only once.
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionRef = useRef<Session | null>(null);
  const sessionRevision = useRef(0);
  const mounted = useRef(false);

  async function loadProfile(userId: string): Promise<Profile | null> {
    try {
      const supabase = await loadSupabase();
      const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      if (error) { console.error('Failed to load profile:', error); return null; }
      return data as Profile | null;
    } catch {
      console.error('Could not load the account profile.');
      return null;
    }
  }

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    mounted.current = true;
    sessionRevision.current++;

    async function applySession(nextSession: Session | null) {
      const revision = ++sessionRevision.current;
      const changedAccount = sessionRef.current?.user.id !== nextSession?.user.id;
      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession) { setProfile(null); setLoading(false); return; }
      if (changedAccount) { setProfile(null); setLoading(true); }
      const nextProfile = await loadProfile(nextSession.user.id);
      if (!cancelled && revision === sessionRevision.current) {
        setProfile(nextProfile);
        setLoading(false);
      }
    }

    loadSupabase()
      .then((supabase) => {
        if (cancelled) return;
        const startupRevision = sessionRevision.current;
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          if (cancelled) return;
          // A password-reset link signs the person in for recovery. Wherever it
          // lands, send them to set a new password rather than straight into the app.
          if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
            navigateRef.current('/reset-password', { replace: true });
          }
          // Cached dashboard numbers belong to whoever was signed in.
          if (event === 'SIGNED_OUT') clearDashboardStatsCache();
          // Do not await an Auth request inside the Supabase event callback.
          // The revision also invalidates profile reads belonging to old sessions.
          void applySession(session);
        });
        unsubscribe = () => authListener.subscription.unsubscribe();
        void supabase.auth.getSession().then(({ data: { session }, error }) => {
          if (cancelled || startupRevision !== sessionRevision.current) return;
          if (error) throw error;
          void applySession(session);
        }).catch(() => {
          if (!cancelled && startupRevision === sessionRevision.current) void applySession(null);
        });
      })
      .catch((err) => {
        // Without the client nobody can be signed in; public pages still work.
        console.error('Could not start sign-in:', err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      mounted.current = false;
      unsubscribe?.();
    };
  }, []);

  async function signUp(
    email: string,
    password: string,
    termsConsentVersion: string
  ) {
    // The consent version travels in the signup metadata and is written onto
    // the profile row by the handle_new_user() trigger, so the account carries
    // evidence of which Terms and Privacy Policy it accepted (DPDPA s.6(1)).
    const supabase = await loadSupabase();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // The confirmation email must bring the new owner straight into setup,
        // not back to the marketing homepage. This URL has to be listed under
        // Auth > URL Configuration > Redirect URLs.
        emailRedirectTo: `${window.location.origin}/onboarding`,
        data: {
          terms_consent_version: termsConsentVersion,
        },
      },
    });

    if (error) {
      return { error: error.message };
    }

    if (!data.session) {
      // The project requires email confirmation. This is the expected next
      // step, not a failure, so the page shows instructions instead of an error.
      return { error: null, needsConfirmation: true };
    }

    return { error: null };
  }

  async function signIn(email: string, password: string) {
    const supabase = await loadSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  async function sendSignInCode(email: string) {
    const supabase = await loadSupabase();
    // Existing accounts only: a new owner signs up, which records their
    // acceptance of the Terms. The email template shows {{ .Token }}.
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    if (error) {
      if (/signups not allowed|user not found/i.test(error.message)) {
        return { error: 'There’s no account with that email. Check it, or sign up.' };
      }
      if (/rate limit|seconds/i.test(error.message)) {
        return { error: 'A code was sent a moment ago. Wait a minute before asking for another.' };
      }
      return { error: 'We couldn’t send a code. Check the email address and try again.' };
    }
    return { error: null };
  }

  async function verifySignInCode(email: string, code: string) {
    const supabase = await loadSupabase();
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) {
      return {
        error: /expired/i.test(error.message)
          ? 'That code has expired. Ask for a new one.'
          : 'That code isn’t right. Check the latest email and try again.',
      };
    }
    return { error: null };
  }

  async function signOut() {
    try {
      const supabase = await loadSupabase();
      const { error } = await supabase.auth.signOut();
      if (error) console.error('Could not sign out:', error);
      // The SIGNED_OUT event clears the session. Do not change another account's
      // profile if a delayed sign-out request finishes after a newer sign-in.
    } catch { console.error('Could not sign out. Check your connection.'); }
  }

  async function resetPassword(email: string) {
    // The email link must land on the page that sets the new password. This
    // URL has to be listed under Auth > URL Configuration > Redirect URLs.
    const supabase = await loadSupabase();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  async function updatePassword(password: string) {
    const supabase = await loadSupabase();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error('Password update failed:', error.message);
      return { error: describePasswordUpdateError(error.message) };
    }
    return { error: null };
  }

  async function refreshProfile() {
    const userId = sessionRef.current?.user.id;
    const revision = sessionRevision.current;
    if (userId) {
      const nextProfile = await loadProfile(userId);
      if (mounted.current && revision === sessionRevision.current) setProfile(nextProfile);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp: (email, password, consent) => attemptAuth(() => signUp(email, password, consent), 'Could not create your account. Check your connection and try again.'),
        signIn: (email, password) => attemptAuth(() => signIn(email, password), 'Could not sign in. Check your connection and try again.'),
        sendSignInCode: email => attemptAuth(() => sendSignInCode(email.trim()), 'Could not send a sign-in code. Check your connection and try again.'),
        verifySignInCode: (email, code) => attemptAuth(() => verifySignInCode(email, code), 'Could not check your code. Check your connection and try again.'),
        signOut,
        resetPassword: email => attemptAuth(() => resetPassword(email.trim()), 'Could not send a reset link. Check your connection and try again.'),
        updatePassword: password => attemptAuth(() => updatePassword(password), 'Could not save your password. Check your connection and try again.'),
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
