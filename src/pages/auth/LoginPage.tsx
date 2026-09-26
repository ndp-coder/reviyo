import { useState, type FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { branding } from '@/config/branding';
import { AuthLayout } from './AuthLayout';
import { Alert, Button, Input } from '@/components/ui';

export function LoginPage() {
  const { signIn, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user && !loading) return <Navigate to="/onboarding" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      setError(error === 'Invalid login credentials' ? 'Incorrect email or password.' : error);
    } else {
      navigate('/onboarding');
    }
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1.5 text-sm text-gray-600">Sign in to your {branding.name} dashboard.</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
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
