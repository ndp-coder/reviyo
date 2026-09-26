import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CheckCircle, Lock } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AuthLayout } from './AuthLayout';
import { Button, Input, Spinner } from '@/components/ui';

/**
 * Where the password-reset email lands. Supabase signs the person in from the
 * link (a short-lived recovery session); this page then sets the new password.
 * Without a session the link has expired or was already used.
 */
export function ResetPasswordPage() {
  const { user, loading, updatePassword } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (password.length < 8) {
      setError('Use at least 8 characters.');
      return;
    }
    setError(null);
    setSubmitting(true);
    const { error: updateError } = await updatePassword(password);
    setSubmitting(false);
    if (updateError) {
      setError(updateError);
      return;
    }
    setDone(true);
  }

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex justify-center py-12" role="status">
          <Spinner className="text-brand-600" />
          <span className="sr-only">Checking your reset link</span>
        </div>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center" role="status">
          <div className="mb-4 flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-7 w-7 text-green-700" aria-hidden="true" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Password changed</h1>
          <p className="mt-2 text-sm text-gray-600">Use your new password next time you sign in.</p>
          <Button size="lg" className="mt-6 w-full" onClick={() => navigate('/dashboard', { replace: true })}>
            Go to your dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </AuthLayout>
    );
  }

  if (!user) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900">This link has expired</h1>
          <p className="mt-2 text-sm text-gray-600">
            Password reset links work once and only for a short time. Request a new one and use it straight away.
          </p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-brand-900 px-5 text-sm font-medium text-white hover:bg-brand-800"
          >
            Send a new reset link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Set a new password</h1>
        <p className="mt-1.5 text-sm text-gray-600">
          For <strong className="font-medium text-gray-800">{user.email}</strong>
        </p>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4" noValidate>
          <Input
            id="new-password"
            label="New password"
            icon={Lock}
            name="new-password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            autoFocus
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (error) setError(null);
            }}
            revealable
            hint={error ? undefined : 'At least 8 characters.'}
            error={error ?? undefined}
          />
          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Save new password
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
