import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { branding } from '@/config/branding';
import { legal } from '@/config/legal';
import { AuthLayout } from '@/pages/auth/AuthLayout';
import { Alert, Button, Input } from '@/components/ui';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { AccountRedirect } from '@/components/AccountRedirect';

export function SignupPage() {
  const { signUp, user } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Problems with individual fields, shown under the field they belong to.
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  // Set when the email already has an account, so the error can offer sign-in.
  const [alreadyRegistered, setAlreadyRegistered] = useState(false);
  // Shown instead of the form when the project requires email confirmation.
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Never pre-ticked. DPDPA s.6(1) requires a clear affirmative action, and a
  // pre-selected box is treated as a dark pattern under the CCPA's 2023
  // guidelines.
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);

  if (user) return <AccountRedirect />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setAlreadyRegistered(false);

    // Check everything at once, top to bottom, so every problem is visible
    // together instead of one per attempt.
    const problems: typeof fieldErrors = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) problems.email = 'Enter a valid email address, like you@example.com.';
    if (password.length < 8) problems.password = 'Use at least 8 characters.';
    setFieldErrors(problems);
    setConsentError(null);
    if (!acceptedTerms) {
      setConsentError('Please accept the Terms and Privacy Policy to create an account.');
    }
    if (Object.keys(problems).length > 0 || !acceptedTerms) {
      const firstField = problems.email ? 'signup-email' : problems.password ? 'signup-password' : null;
      if (firstField) document.getElementById(firstField)?.focus();
      return;
    }

    setSubmitting(true);
    const { error, needsConfirmation } = await signUp(email.trim(), password, legal.consentVersion);
    setSubmitting(false);
    if (needsConfirmation) {
      setConfirmationSentTo(email.trim());
    } else if (error) {
      if (/already registered|already exists/i.test(error)) {
        setAlreadyRegistered(true);
        setError('An account with this email already exists.');
      } else {
        setError(error);
      }
    }
  }

  if (confirmationSentTo) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold text-gray-900">Check your email</h1>
          <p className="mt-2 text-sm text-gray-700">
            We sent a confirmation link to <strong>{confirmationSentTo}</strong>. Open it on this device — it
            takes you straight to setting up your business.
          </p>
          <p className="mt-4 text-sm text-gray-600">
            Nothing there? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => setConfirmationSentTo(null)}
              className="font-medium text-brand-700 underline underline-offset-2"
            >
              try a different email
            </button>
            .
          </p>
          <p className="mt-6 text-sm text-gray-600">
            Already confirmed?{' '}
            <Link to="/login" className="font-medium text-brand-700 underline underline-offset-2">
              Sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="w-full max-w-sm">
        <h1 className="text-2xl font-bold text-gray-900">Start your {legal.trialDays}-day free trial</h1>
        <p className="mt-1.5 text-sm text-gray-600">Create your {branding.name} account with your email.</p>

        {/* What happens after this form, including when money is involved, so
            nothing later comes as a surprise. */}
        <div className="mt-6 rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-950">
          <p className="font-medium">What happens next</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-brand-900">
            <li>Add your business name, Google link, and review topics — about 3 minutes.</li>
            <li>Verify UPI or a card with ₹1, refunded straight away. Your {legal.trialDays}-day trial starts.</li>
            <li>Print your QR code. Nothing more is charged until the trial ends; cancel any time before.</li>
          </ol>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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
          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-relaxed text-gray-700">
            We store your email to run your account, and your business details to build your
            review page. We do not sell your data and we serve no advertising. Full detail is in the{' '}
            <Link
              to="/privacy"
              target="_blank"
              className="font-medium text-brand-700 underline underline-offset-2"
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
              className="font-medium text-brand-700 underline underline-offset-2"
            >
              Terms &amp; Conditions
            </Link>{' '}
            and{' '}
            <Link
              to="/privacy"
              target="_blank"
              className="font-medium text-brand-700 underline underline-offset-2"
            >
              Privacy Policy
            </Link>
            , including the rules on incentivised and fake reviews. I am 18 or older.
          </ConsentCheckbox>

          {error && (
            <Alert
              variant="error"
              action={
                alreadyRegistered ? (
                  <span className="flex flex-wrap gap-x-4 gap-y-1">
                    <Link to="/login" className="font-medium underline underline-offset-2">Sign in instead</Link>
                    <Link to="/forgot-password" className="font-medium underline underline-offset-2">Reset your password</Link>
                  </span>
                ) : undefined
              }
            >
              {error}
            </Alert>
          )}

          <Button type="submit" size="lg" loading={submitting} className="w-full">
            Create account and set up <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-600">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-700 hover:text-brand-800 font-medium underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
