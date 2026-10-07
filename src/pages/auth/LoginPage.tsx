import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight, KeyRound } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { branding } from '@/config/branding';
import { legal } from '@/config/legal';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { Alert, Button, Input } from '@/components/ui';
import { AccountRedirect } from '@/components/AccountRedirect';

type Mode = 'password' | 'code';

export function LoginPage() {
  const { signIn, sendSignInCode, verifySignInCode, user } = useAuth();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  // The address a code was sent to; the code field appears once it is set.
  const [codeSentTo, setCodeSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <AccountRedirect />;

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setCode('');
    setCodeSentTo(null);
  }

  async function handlePassword(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError(error === 'Invalid login credentials' ? 'Incorrect email or password.' : error);
    }
  }

  async function handleSendCode(e?: FormEvent) {
    e?.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const address = email.trim();
    const { error } = await sendSignInCode(address);
    setSubmitting(false);
    if (error) {
      setError(error);
    } else {
      setCodeSentTo(address);
      setCode('');
    }
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault();
    if (submitting || !codeSentTo) return;
    setError(null);
    setSubmitting(true);
    const { error } = await verifySignInCode(codeSentTo, code.trim());
    setSubmitting(false);
    if (error) {
      setError(error);
    }
  }

  const emailField = (
    <Input
      id="login-email"
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
  );

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-gray-600">Sign in to your {branding.name} dashboard.</p>

        {mode === 'password' ? (
          <form onSubmit={handlePassword} className="mt-8 space-y-4">
            {emailField}
            <Input
              id="login-password"
              label="Password"
              icon={Lock}
              name="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              revealable
            />

            {error && <Alert variant="error">{error}</Alert>}

            <Button type="submit" size="lg" loading={submitting} className="w-full">
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        ) : !codeSentTo ? (
          <form onSubmit={handleSendCode} className="mt-8 space-y-4">
            {emailField}
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" size="lg" loading={submitting} className="w-full">
              Email me a sign-in code <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </form>
        ) : (
          <form onSubmit={handleVerifyCode} className="mt-8 space-y-4">
            <Alert variant="success">
              We sent a code to <strong>{codeSentTo}</strong> from {legal.supportEmail}. It works once and expires
              soon. Not there? Check spam.
            </Alert>
            <Input
              id="login-code"
              label="Sign-in code"
              icon={KeyRound}
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              maxLength={10}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
            />
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" size="lg" loading={submitting} disabled={code.length < 6} className="w-full">
              Sign in <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <div className="flex flex-wrap justify-between gap-3 text-sm">
              <button
                type="button"
                onClick={() => void handleSendCode()}
                disabled={submitting}
                className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                Send a new code
              </button>
              <button
                type="button"
                onClick={() => setCodeSentTo(null)}
                className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
              >
                Use a different email
              </button>
            </div>
          </form>
        )}

        <button
          type="button"
          onClick={() => switchMode(mode === 'password' ? 'code' : 'password')}
          className="mt-4 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
        >
          {mode === 'password' ? 'Sign in with an email code instead' : 'Sign in with your password instead'}
        </button>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link to="/forgot-password" className="text-brand-700 hover:text-brand-800 font-medium underline underline-offset-2">
            Forgot password?
          </Link>
          <span className="text-gray-600">
            No account? <Link to="/signup" className="text-brand-700 hover:text-brand-800 font-medium underline underline-offset-2">Sign up</Link>
          </span>
        </div>
      </div>
    </AuthLayout>
  );
}
