import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { clearDashboardStatsCache } from '@/lib/use-dashboard-stats';
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
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  /** Sets a new password for the signed-in (or password-recovery) session. */
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

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

    return () => {
      authListener.subscription.unsubscribe();
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
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  async function resetPassword(email: string) {
    // The email link must land on the page that sets the new password. This
    // URL has to be listed under Auth > URL Configuration > Redirect URLs.
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) {
      return { error: error.message };
    }
    return { error: null };
  }

  async function updatePassword(password: string) {
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
      value={{ user, session, profile, loading, signUp, signIn, signOut, resetPassword, updatePassword, refreshProfile }}
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
