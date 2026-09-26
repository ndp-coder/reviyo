import { useState, type FormEvent } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { Mail, Lock, User, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { branding } from '@/config/branding';
import { legal } from '@/config/legal';
import { AuthLayout } from './AuthLayout';
import { Alert, Button, Input } from '@/components/ui';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';

export function SignupPage() {
  const { signUp, user, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Problems with individual fields, shown under the field they belong to.
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; email?: string; password?: string }>({});
  // Shown instead of the form when the project requires email confirmation.
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Never pre-ticked. DPDPA s.6(1) requires a clear affirmative action, and a
  // pre-selected box is treated as a dark pattern under the CCPA's 2023
  // guidelines.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  if (user && !loading) return <Navigate to="/onboarding" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);

    // Check everything at once, top to bottom, so every problem is visible
    // together instead of one per attempt.
    const problems: typeof fieldErrors = {};
    if (!fullName.trim()) problems.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) problems.email = 'Enter a valid email address, like you@example.com.';
    if (password.length < 8) problems.password = 'Use at least 8 characters.';
    setFieldErrors(problems);
    setConsentError(null);
    if (!acceptedTerms) {
      setConsentError('Please accept the Terms and Privacy Policy to create an account.');
    }
    if (Object.keys(problems).length > 0 || !acceptedTerms) {
      const firstField = problems.name ? 'signup-name' : problems.email ? 'signup-email' : problems.password ? 'signup-password' : null;
      if (firstField) document.getElementById(firstField)?.focus();
      return;
    }

    setSubmitting(true);
    const { error, needsConfirmation } = await signUp(email.trim(), password, fullName.trim(), legal.consentVersion);
    setSubmitting(false);
    if (needsConfirmation) {
      setConfirmationSentTo(email.trim());
    } else if (error) {
      setError(error);
    } else {
      navigate('/onboarding');
    }
  }

  if (confirmationSentTo) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-700">
            We sent a confirmation link to <strong>{confirmationSentTo}</strong>. Open it to activate your
            account, then sign in to set up your business.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Nothing there? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => setConfirmationSentTo(null)}
              className="font-medium text-blue-700 underline underline-offset-2"
            >
              try a different email
            </button>
            .
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Start free</h1>
        <p className="mt-1.5 text-sm text-gray-600">
          Create your {branding.name} account. Your free trial starts after a ₹1 AutoPay check, refunded straight away.
        </p>

        <div className="mt-6 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-xs text-blue-900">
          <p className="font-medium mb-1">Your {legal.trialDays}-day free trial includes:</p>
          <ul className="space-y-1">
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> A custom QR code for your business
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> AI-assisted review writing
            </li>
            <li className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> A private feedback dashboard
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <Input
            id="signup-name"
            label="Full name"
            icon={User}
            name="name"
            type="text"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => {
              setFullName(e.target.value);
              if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={fieldErrors.name}
          />
          <Input
            id="signup-email"
            label="Email"
            icon={Mail}
            name="email"
            type="email"
            inputMode="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
            }}
            placeholder="you@example.com"
            error={fieldErrors.email}
          />
          <Input
            id="signup-password"
            label="Password"
            icon={Lock}
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (fieldErrors.password) setFieldErrors((prev) => ({ ...prev, password: undefined }));
            }}
            revealable
            hint={fieldErrors.password ? undefined : 'At least 8 characters.'}
            error={fieldErrors.password}
          />

          {/* What we collect and why, stated before the account is created —
              the notice DPDPA s.5 requires to accompany consent. */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-700">
            We store your name and email to run your account, and your business details to build your
            review page. We do not sell your data and we serve no advertising. Full detail is in the{' '}
            <Link
              to="/privacy"
              target="_blank"
              className="font-medium text-blue-700 underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            .
          </div>

          <ConsentCheckbox
            checked={acceptedTerms}
            onChange={(value) => {
              setAcceptedTerms(value);
              if (value) setConsentError(null);
            }}
            error={consentError}
          >
            I have read and agree to the{' '}
            <Link
              to="/terms"
              target="_blank"
              className="font-medium text-blue-700 underline underline-offset-2"
            >
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy"
              target="_blank"
              className="font-medium text-blue-700 underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            , including the rules on incentivised and fake reviews. I am 18 or older.
          </ConsentCheckbox>

          {error && <Alert variant="error">{error}</Alert>}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Create account <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-700 hover:text-blue-800 font-medium underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
