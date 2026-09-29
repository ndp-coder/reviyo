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

  async function loadProfile(userId: string) {
    const supabase = await loadSupabase();
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to load profile:', error);
      return;
    }
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    loadSupabase()
      .then((supabase) => {
        if (cancelled) return;
        supabase.auth.getSession().then(({ data: { session } }) => {
          setSession(session);
          setUser(session?.user ?? null);
          if (session?.user) {
            loadProfile(session.user.id).finally(() => setLoading(false));
          } else {
            setLoading(false);
          }
        });

        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
          // A password-reset link signs the person in for recovery. Wherever it
          // lands, send them to set a new password rather than straight into the app.
          if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/reset-password') {
            navigateRef.current('/reset-password', { replace: true });
          }
          // Cached dashboard numbers belong to whoever was signed in.
          if (event === 'SIGNED_OUT') clearDashboardStatsCache();
          (async () => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) {
              await loadProfile(session.user.id);
            } else {
              setProfile(null);
            }
            setLoading(false);
          })();
        });
        unsubscribe = () => authListener.subscription.unsubscribe();
      })
      .catch((err) => {
        // Without the client nobody can be signed in; public pages still work.
        console.error('Could not start sign-in:', err);
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
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
    const supabase = await loadSupabase();
    await supabase.auth.signOut();
    setProfile(null);
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
    if (user) {
      await loadProfile(user.id);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signUp,
        signIn,
        sendSignInCode,
        verifySignInCode,
        signOut,
        resetPassword,
        updatePassword,
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
