import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { AuthLayout } from './AuthLayout';
import { Alert, Button, Input } from '@/components/ui';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const { error } = await resetPassword(email);
    setSubmitting(false);
    if (error) {
      setError(error);
    } else {
      setSent(true);
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm animate-slide-up">
        {sent ? (
          <>
            <div className="flex justify-center mb-4" role="status" aria-live="polite">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-7 w-7 text-green-700" aria-hidden="true" />
              </div>
            </div>
            <h1 className="font-semiwide text-2xl font-bold tracking-[-0.01em] text-ink text-center">Check your email</h1>
            <p className="mt-2 text-sm text-gray-600 text-center">
              If an account exists for {email}, we've sent a password reset link.
            </p>
            <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-blue-700 hover:text-blue-800 font-medium underline underline-offset-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="font-semiwide text-2xl font-bold tracking-[-0.01em] text-ink">Reset password</h1>
            <p className="mt-1.5 text-sm text-gray-600">
              Enter your email and we'll send you a reset link.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-4">
              <Input
                id="reset-email"
                label="Email"
                icon={Mail}
                name="email"
                type="email"
                inputMode="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />

              {error && <Alert variant="error">{error}</Alert>}

              <Button type="submit" size="lg" loading={submitting} className="w-full">
                Send reset link
              </Button>
            </form>

            <Link to="/login" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-blue-700 hover:text-blue-800 font-medium underline underline-offset-2">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to sign in
            </Link>
          </>
        )}
      </div>
    </AuthLayout>
  );
}
