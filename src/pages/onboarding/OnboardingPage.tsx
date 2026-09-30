import { useState, useEffect, useCallback, useRef } from 'react';
import { reviewUrlFor } from '@/lib/review-source';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  businessCategories,
  getCategoryLabel,
  getSuggestedTopics,
  MAX_CATEGORY_LENGTH,
  OTHER_CATEGORY,
} from '@/config/categories';
import { directReviewUrl, validateGoogleReviewUrl } from '@/lib/url-safety';
import { prepareLogo } from '@/lib/image';
import { Alert, Button, Input, Card, IconButton, Spinner } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button-styles';
import { BrandLogo } from '@/components/BrandLogo';
import { SkipLink } from '@/components/SkipLink';
import { AiTopicSuggestions } from '@/components/AiTopicSuggestions';
import { GoogleReviewLinkHelp } from '@/components/GoogleReviewLinkHelp';
import { AutopaySetup } from '@/components/AutopaySetup';
import { PayOncePlans, type PaymentFeedback } from '@/components/PayOncePlans';
import { paymentGate } from '@/lib/payment-gate';
import { hasSubscriptionAccess } from '@/lib/subscription';
import { legal } from '@/config/legal';
import { Star, Store, Link2, Image, QrCode, ArrowRight, ArrowLeft, ArrowUp, ArrowDown, Check, Copy, Plus, X, Upload, Gift, Download } from 'lucide-react';
import QRCode from 'qrcode';
import type { Business, Subscription } from '@/lib/types';

// Name and category share the first screen: both take seconds, and splitting
// them only added a click.
const STEPS = [
  { label: 'Business', icon: Store },
  { label: 'Google link', icon: Link2 },
  { label: 'Logo', icon: Image },
  { label: 'Topics', icon: Star },
  { label: 'Free trial', icon: Gift },
  { label: 'QR code', icon: QrCode },
] as const;
const STEP = { business: 0, google: 1, logo: 2, topics: 3, trial: 4, qr: 5 } as const;
const TOTAL_STEPS = STEPS.length;
// create_business_with_defaults accepts at most 20 topics of 1-80 characters.
const MAX_TOPICS = 20;
const MAX_TOPIC_LENGTH = 80;

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    // "Café" becomes "cafe" rather than "caf".
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function OnboardingPage() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  // Signing in always lands here; owners who already have a business are sent
  // on to the dashboard. Hold the page until that is known, so they don't see
  // the first setup question flash past.
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [checkFailed, setCheckFailed] = useState(false);
  const [step, setStep] = useState<number>(STEP.business);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  // Step data
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  // What the owner types after choosing "Other"; saved as their category.
  const [customCategory, setCustomCategory] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [topics, setTopics] = useState<string[]>([]);
  const [newTopic, setNewTopic] = useState('');
  const [business, setBusiness] = useState<Business | null>(null);
  // The subscription of a business that already exists but has never paid
  // (the old sign-up-only free trial): its trial is used up, so the payment
  // step offers a plan instead.
  const [existingSubscription, setExistingSubscription] = useState<Subscription | null>(null);
  const [payFeedback, setPayFeedback] = useState<PaymentFeedback | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');

  // Owners with a business go to the dashboard only once they have paid (the
  // ₹1 AutoPay check or a plan). Anyone else — a refresh or closed tab during
  // payment, or an existing owner who never paid — lands on the payment step.
  useEffect(() => {
    let cancelled = false;
    async function checkExistingBusiness() {
      if (!user) return;
      const { data, error: businessError } = await supabase
        .from('businesses')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (businessError) {
        setCheckFailed(true);
        setCheckingExisting(false);
        return;
      }
      if (data) {
        const existing = data as Business;
        const [gate, subscriptionRes] = await Promise.all([
          paymentGate(existing.id),
          supabase
            .from('subscriptions')
            .select('*')
            .eq('business_id', existing.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);
        if (cancelled) return;
        if (gate !== 'not_paid') {
          navigate('/dashboard', { replace: true });
          return;
        }
        if (subscriptionRes.error) {
          setCheckFailed(true);
          setCheckingExisting(false);
          return;
        }
        setBusiness(existing);
        setBusinessName(existing.name);
        setExistingSubscription((subscriptionRes.data as Subscription | null) ?? null);
        setStep(STEP.trial);
      }
      setCheckingExisting(false);
    }
    checkExistingBusiness();
    return () => {
      cancelled = true;
    };
  }, [user, navigate]);

  // Auto-suggest topics when category changes
  useEffect(() => {
    if (category && topics.length === 0) {
      setTopics(getSuggestedTopics(category));
    }
  }, [category, topics.length]);

  // Bring each new step's heading into view and focus, so keyboard and screen
  // reader users start at the top of the new question.
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current === step) return;
    previousStep.current = step;
    window.scrollTo({ top: 0 });
    // A step that auto-focuses its field has already put focus somewhere useful.
    if (headingRef.current?.contains(document.activeElement)) return;
    const heading = headingRef.current?.querySelector<HTMLElement>('h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
  }, [step]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const effectiveCategory = category === OTHER_CATEGORY ? customCategory.trim() : category;

  // An owner whose free trial is used up pays for a plan at the trial step.
  const trialAvailable = existingSubscription === null;
  const stepLabel = (i: number) => (i === STEP.trial && !trialAvailable ? 'Payment' : STEPS[i].label);
  const existingAccessLive = hasSubscriptionAccess(existingSubscription);

  const reviewUrl = business ? reviewUrlFor(business.slug) : '';

  useEffect(() => {
    if (reviewUrl) {
      QRCode.toDataURL(reviewUrl, { width: 600, margin: 2, color: { dark: '#1e293b', light: '#ffffff' } })
        .then(setQrDataUrl)
        .catch(console.error);
    }
  }, [reviewUrl]);

  const handleCreateBusiness = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setSaving(true);
    setError(null);

    const { data: bizData, error: bizError } = await supabase.rpc('create_business_with_defaults', {
      p_name: businessName.trim(),
      p_slug: slugify(businessName),
      p_category: effectiveCategory,
      p_google_review_url: googleReviewUrl.trim() ? directReviewUrl(googleReviewUrl) : null,
      p_logo_url: logoUrl || null,
      p_welcome_message: `How was your experience at ${businessName.trim()}?`,
      p_topics: topics.map((t) => t.trim()).filter(Boolean),
    });

    if (bizError || !bizData) {
      // Database messages are not written for owners; say what to do instead.
      console.error('create_business_with_defaults failed:', bizError?.message);
      setError(
        bizError?.code === '23514'
          ? 'That Google link or logo isn’t accepted. Go back and check the link starts with https://, then try again.'
          : 'We couldn’t create your business. Check your connection and try again — nothing you entered has been lost.'
      );
      setSaving(false);
      return false;
    }

    setBusiness(bizData as Business);
    setSaving(false);
    return true;
  }, [user, businessName, effectiveCategory, googleReviewUrl, logoUrl, topics]);

  const nextStep = async () => {
    if (step === STEP.google) {
      // Only http(s) Google links that open the review form (the database also
      // enforces the http(s) part).
      const urlProblem = validateGoogleReviewUrl(googleReviewUrl);
      setUrlError(urlProblem);
      if (urlProblem) return;
    }
    if (step === STEP.topics) {
      const created = await handleCreateBusiness();
      if (!created) return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const prevStep = () => {
    setError(null);
    setStep((s) => Math.max(s - 1, 0));
  };

  const addTopic = () => {
    const trimmed = newTopic.trim();
    if (trimmed && topics.length < MAX_TOPICS && !topics.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTopics([...topics, trimmed]);
      setNewTopic('');
    }
  };

  const addSuggestedTopics = (suggested: string[]) => {
    setTopics((current) => {
      const next = [...current];
      for (const topic of suggested) {
        if (next.length >= MAX_TOPICS) break;
        if (!next.some((t) => t.toLowerCase() === topic.toLowerCase())) next.push(topic);
      }
      return next;
    });
  };

  const removeTopic = (index: number) => {
    setTopics(topics.filter((_, i) => i !== index));
  };

  const moveTopic = (index: number, dir: -1 | 1) => {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= topics.length) return;
    const newTopics = [...topics];
    [newTopics[index], newTopics[newIndex]] = [newTopics[newIndex], newTopics[index]];
    setTopics(newTopics);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    // Scaled down in the browser: the logo is loaded on every customer scan.
    const result = await prepareLogo(file);
    if ('error' in result) {
      setLogoError(result.error);
      return;
    }
    setLogoError(null);
    setLogoUrl(result.dataUrl);
  };

  const copyReviewUrl = () => {
    navigator.clipboard
      .writeText(reviewUrl)
      .then(() => setCopied(true))
      .catch(() => setCopied(false));
  };

  const canProceed = () => {
    if (step === STEP.business) {
      if (!businessName.trim()) return false;
      if (category === OTHER_CATEGORY) return customCategory.trim().length >= 2;
      return category.length > 0;
    }
    if (step === STEP.google) return true; // Google URL is optional
    if (step === STEP.logo) return true; // Logo is optional
    if (step === STEP.topics) return topics.length > 0;
    return true;
  };

  // Says why Continue is disabled, instead of leaving a greyed-out button.
  const blockedReason = (() => {
    if (step === STEP.business) {
      if (!businessName.trim()) return 'Enter your business name to continue.';
      if (!category) return 'Choose a business type to continue.';
      if (category === OTHER_CATEGORY && customCategory.trim().length < 2) return 'Describe your business in a few words to continue.';
    }
    if (step === STEP.topics && topics.length === 0) return 'Add at least one topic to continue.';
    return null;
  })();

  if (checkingExisting) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50" role="status">
        <Spinner className="text-brand-600" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  if (checkFailed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-4">
        <div className="w-full max-w-md">
          <Alert variant="error" title="We couldn’t load your account">
            Check your connection and try again.
          </Alert>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      {/* Header */}
      <SkipLink />
      <header className="flex items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
        <BrandLogo className="h-10 w-auto sm:h-11" />
        <div role="status" aria-live="polite" className="text-sm text-gray-700">
          Step {step + 1} of {TOTAL_STEPS}
          <span className="sr-only">: {stepLabel(step)}</span>
        </div>
      </header>

      {/* Progress. Phones get a single bar (the step count is in the header);
          six labelled circles don't fit below 640px. */}
      <div className="mb-6 px-4 sm:mb-8 sm:px-6">
        <div className="mx-auto max-w-xl sm:hidden" aria-hidden="true">
          <div className="h-1.5 rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-brand-900 transition-[width] duration-300"
              style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }}
            />
          </div>
          <p className="mt-2 text-xs font-medium text-gray-700">{stepLabel(step)}</p>
        </div>
        <ol aria-label="Setup progress" className="mx-auto hidden max-w-2xl list-none items-center gap-2 p-0 sm:flex">
          {STEPS.map(({ label, icon: Icon }, i) => {
            const isActive = i === step;
            const isDone = i < step;
            return (
              <li key={label} className="flex flex-1 items-center last:flex-none">
                <div
                  aria-current={isActive ? 'step' : undefined}
                  className={`flex flex-col items-center gap-1 ${
                    isActive ? 'text-brand-800' : isDone ? 'text-green-800' : 'text-gray-600'
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors ${
                      isActive
                        ? 'border-brand-700 bg-brand-50'
                        : isDone
                        ? 'border-green-700 bg-green-50'
                        : 'border-gray-400 bg-white'
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
                  </div>
                  <span className="whitespace-nowrap text-xs font-medium">{stepLabel(i)}</span>
                  <span className="sr-only">{isDone ? 'completed' : isActive ? 'current step' : 'not started'}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    aria-hidden="true"
                    className={`mx-2 mb-5 h-0.5 flex-1 rounded-full ${i < step ? 'bg-green-600' : 'bg-gray-300'}`}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Step content */}
      <main id="main-content" tabIndex={-1} className="mx-auto max-w-xl px-4 pb-12 sm:px-6">
        <div key={step} ref={headingRef}>
          {step === STEP.business && (
            <Card className="p-5 sm:p-8">
              <h1 className="text-xl font-bold text-gray-900">Tell us about your business</h1>
              <p className="mt-1.5 text-sm text-gray-600">Customers see your name on the review page. The type helps us suggest review topics.</p>
              <div className="mt-6">
                <Input
                  label="Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Smile Dental Clinic"
                  autoFocus
                  autoComplete="organization"
                  maxLength={200}
                  onKeyDown={(e) => e.key === 'Enter' && canProceed() && nextStep()}
                />
              </div>
              <fieldset className="mt-6">
                <legend className="mb-1.5 text-sm font-medium text-gray-800">Type of business</legend>
                <div role="group" aria-label="Business category" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {businessCategories.map((cat) => {
                    const selected = category === cat.value;
                    return (
                      <button
                        key={cat.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => setCategory(cat.value)}
                        className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-center text-sm font-medium transition-colors ${
                          selected
                            ? 'border-brand-700 bg-brand-50 text-brand-800 ring-1 ring-brand-700'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500'
                        }`}
                      >
                        {selected && <Check className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />}
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {category === OTHER_CATEGORY && (
                <div className="mt-5 animate-fade-in">
                  <Input
                    label="What kind of business is it?"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    maxLength={MAX_CATEGORY_LENGTH}
                    placeholder="e.g. Pet grooming, Yoga studio, Printing shop"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && canProceed() && nextStep()}
                    hint="A few words is enough. We use this to suggest review topics and to write better review drafts."
                  />
                </div>
              )}
            </Card>
          )}

          {step === STEP.google && (
            <Card className="p-5 sm:p-8">
              <h1 className="text-xl font-bold text-gray-900">Your Google review link</h1>
              <p className="mt-1.5 text-sm text-gray-600">
                Where customers land to post their review. Optional now — you can add it later in Settings.
              </p>
              <div className="mt-6">
                <Input
                  label="Google review link (optional)"
                  type="url"
                  inputMode="url"
                  value={googleReviewUrl}
                  error={urlError ?? undefined}
                  onChange={(e) => {
                    setGoogleReviewUrl(e.target.value);
                    if (urlError) setUrlError(null);
                  }}
                  placeholder="https://g.page/r/..."
                  autoFocus
                />
              </div>
              <div className="mt-4">
                <GoogleReviewLinkHelp
                  businessName={businessName}
                  currentUrl={googleReviewUrl}
                  onUseLink={(url) => {
                    setGoogleReviewUrl(url);
                    setUrlError(null);
                  }}
                  defaultOpen
                />
              </div>
            </Card>
          )}

          {step === STEP.logo && (
            <Card className="p-5 sm:p-8">
              <h1 className="text-xl font-bold text-gray-900">Add your logo</h1>
              <p className="mt-1.5 text-sm text-gray-600">Shown at the top of your review page. Optional, but it helps customers trust the page.</p>
              <div className="mt-6 flex flex-col items-center">
                {logoUrl ? (
                  <div className="flex flex-col items-center gap-3">
                    <img
                      src={logoUrl}
                      alt={`Logo preview for ${businessName || 'your business'}`}
                      className="h-32 w-32 rounded-xl border border-gray-300 object-cover"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')}>
                      <X className="h-4 w-4" aria-hidden="true" /> Remove logo
                    </Button>
                  </div>
                ) : (
                  <label htmlFor="onboarding-logo-upload" className="cursor-pointer rounded-xl">
                    <div className="flex h-32 w-32 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-400 transition-colors hover:border-brand-600 hover:bg-brand-50/50">
                      <Upload className="h-6 w-6 text-gray-600" aria-hidden="true" />
                      <span className="text-xs text-gray-700">Choose image</span>
                    </div>
                    <span className="sr-only">Upload your business logo, PNG, JPG, or WebP</span>
                    <input
                      id="onboarding-logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={handleLogoUpload}
                    />
                  </label>
                )}
                <p className="mt-3 text-xs text-gray-600">PNG, JPG, or WebP. We resize it for you.</p>
                {logoError && (
                  <p role="alert" className="mt-2 text-sm font-medium text-red-700">
                    {logoError}
                  </p>
                )}
              </div>
            </Card>
          )}

          {step === STEP.topics && (
            <Card className="p-5 sm:p-8">
              <h1 className="text-xl font-bold text-gray-900">Choose review topics</h1>
              <p className="mt-1.5 text-sm text-gray-600">
                Customers tap these to say what they liked. We&apos;ve suggested some for your business type — edit, reorder, or remove any.
              </p>
              <ul className="mt-6 space-y-2">
                {topics.map((topic, i) => (
                  <li key={i} className="flex items-center gap-1 rounded-lg border border-gray-300 py-1 pl-3 pr-1">
                    <input
                      value={topic}
                      aria-label={`Topic ${i + 1} label`}
                      maxLength={MAX_TOPIC_LENGTH}
                      onChange={(e) => {
                        const newTopics = [...topics];
                        newTopics[i] = e.target.value;
                        setTopics(newTopics);
                      }}
                      className="min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none"
                    />
                    <IconButton
                      onClick={() => moveTopic(i, -1)}
                      disabled={i === 0}
                      aria-label={`Move ${topic || `topic ${i + 1}`} up`}
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton
                      onClick={() => moveTopic(i, 1)}
                      disabled={i === topics.length - 1}
                      aria-label={`Move ${topic || `topic ${i + 1}`} down`}
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                    <IconButton tone="danger" onClick={() => removeTopic(i)} aria-label={`Remove ${topic || `topic ${i + 1}`}`}>
                      <X className="h-4 w-4" aria-hidden="true" />
                    </IconButton>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Input
                  value={newTopic}
                  aria-label="New topic"
                  maxLength={MAX_TOPIC_LENGTH}
                  onChange={(e) => setNewTopic(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
                  placeholder="Add a topic"
                  className="flex-1"
                />
                <Button variant="outline" onClick={addTopic} disabled={topics.length >= MAX_TOPICS || !newTopic.trim()}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> Add
                </Button>
              </div>
              <p className="mt-1.5 text-xs text-gray-600">
                {topics.length} of {MAX_TOPICS} topics
              </p>
              <div className="mt-4">
                <AiTopicSuggestions
                  businessName={businessName}
                  category={getCategoryLabel(effectiveCategory)}
                  existingTopics={topics}
                  onAdd={addSuggestedTopics}
                  remaining={MAX_TOPICS - topics.length}
                />
              </div>
            </Card>
          )}

          {step === STEP.trial && business && trialAvailable && (
            <Card className="p-5 sm:p-8">
              <h1 className="text-xl font-bold text-gray-900">Start your {legal.trialDays}-day free trial</h1>
              <p className="mt-1.5 text-sm text-gray-600">
                Your business is saved. Set up AutoPay with a ₹1 verification payment, which we refund straight
                away. You won&apos;t be charged for the plan until your trial ends, and you can cancel any time
                before that.
              </p>
              <div className="mt-6">
                <AutopaySetup
                  businessId={business.id}
                  userName={profile?.full_name || businessName}
                  userEmail={user?.email}
                  trialAvailable
                  onComplete={() => setStep(STEP.qr)}
                />
              </div>
            </Card>
          )}

          {step === STEP.trial && business && !trialAvailable && (
            <div className="space-y-6">
              <Card className="p-5 sm:p-8">
                <h1 className="text-xl font-bold text-gray-900">
                  {existingAccessLive ? 'Set up payment to keep going' : 'Choose a plan to continue'}
                </h1>
                <p className="mt-1.5 text-sm text-gray-600">
                  {existingAccessLive
                    ? 'Your free trial is running. Set up AutoPay now so your review page keeps working when it ends — you won’t be charged for the plan until then.'
                    : 'Your free trial has ended. Set up AutoPay or pay once to switch on AI review drafting and your dashboard.'}
                </p>
                <div className="mt-6">
                  <AutopaySetup
                    businessId={business.id}
                    userName={profile?.full_name || businessName}
                    userEmail={user?.email}
                    trialAvailable={false}
                    currentAccessEndsAt={existingSubscription?.expires_at}
                    onComplete={(result) => {
                      // With the trial over, the first charge is still a day or two
                      // away: Billing shows it until the plan starts.
                      if (hasSubscriptionAccess(result.subscription ?? existingSubscription)) setStep(STEP.qr);
                      else navigate('/dashboard/billing');
                    }}
                  />
                </div>
              </Card>
              {payFeedback && <Alert variant={payFeedback.type}>{payFeedback.message}</Alert>}
              <PayOncePlans
                businessId={business.id}
                userName={profile?.full_name || businessName}
                userEmail={user?.email || ''}
                onFeedback={setPayFeedback}
                onFinished={(paid) => {
                  if (paid) {
                    setPayFeedback(null);
                    setStep(STEP.qr);
                  }
                }}
              />
            </div>
          )}

          {step === STEP.qr && business && (
            <Card className="p-5 text-center sm:p-8">
              <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
                <Check className="h-7 w-7 text-green-700" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Your QR code is ready</h1>
              <p className="mt-1.5 text-sm text-gray-600">
                Put it where customers pay or wait. Scanning it opens your review page.
              </p>

              {qrDataUrl ? (
                <div className="mt-6 flex flex-col items-center">
                  <div className="rounded-xl border border-gray-200 bg-white p-4">
                    <img src={qrDataUrl} alt={`QR code linking to your review page at ${reviewUrl}`} className="h-48 w-48" />
                  </div>
                  <div className="mt-3 max-w-xs break-all text-xs text-gray-600">{reviewUrl}</div>
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <a href={qrDataUrl} download={`${business.slug}-qr.png`} className={buttonClasses()}>
                      <Download className="h-4 w-4" aria-hidden="true" /> Download PNG
                    </a>
                    <Button variant="outline" onClick={copyReviewUrl}>
                      {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                      {copied ? 'Link copied' : 'Copy link'}
                    </Button>
                    <a href={reviewUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ variant: 'outline' })}>
                      Preview page
                      <span className="sr-only">(opens in a new tab)</span>
                    </a>
                  </div>
                  <span className="sr-only" role="status" aria-live="polite">
                    {copied ? 'Review page link copied' : ''}
                  </span>
                </div>
              ) : (
                <div className="mx-auto mt-6 h-56 w-56 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
              )}
            </Card>
          )}
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {/* Navigation */}
        {step < STEP.trial && (
          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={prevStep} disabled={step === 0 || saving}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </Button>
              <div className="flex items-center gap-2">
                {/* Offered only while the optional field is empty, so it can
                    never throw away something the owner has entered. */}
                {((step === STEP.google && !googleReviewUrl.trim()) || (step === STEP.logo && !logoUrl)) && (
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setUrlError(null);
                      setStep((s) => s + 1);
                    }}
                  >
                    Skip for now
                  </Button>
                )}
                <Button onClick={nextStep} disabled={!canProceed() || saving} loading={saving} aria-describedby={blockedReason ? 'onboarding-blocked' : undefined}>
                  {step === STEP.topics ? 'Create business' : `Next: ${stepLabel(step + 1)}`}{' '}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
            {blockedReason && (
              <p id="onboarding-blocked" className="mt-2 text-right text-xs text-gray-600">
                {blockedReason}
              </p>
            )}
          </div>
        )}

        {/* The app opens only after AutoPay is set up. Owners who aren't ready
            can leave: the business is saved and this step is waiting when
            they sign in again. */}
        {step === STEP.trial && business && (
          <p className="mt-6 text-center text-sm text-gray-600">
            Not ready yet? Your business is saved.{' '}
            <button
              type="button"
              onClick={async () => {
                await signOut();
                navigate('/');
              }}
              className="font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              Sign out and finish later
            </button>
          </p>
        )}

        {step === STEP.qr && business && (
          <div className="mt-6 flex justify-center">
            <Button size="lg" onClick={() => navigate('/dashboard')}>
              Go to dashboard <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      </main>

      <footer className="px-6 pb-10">
        <nav aria-label="Legal and policies">
          <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {[
              { to: '/terms', label: 'Terms' },
              { to: '/privacy', label: 'Privacy' },
              { to: '/refunds', label: 'Refunds' },
              { to: '/contact', label: 'Contact' },
            ].map((link) => (
              <li key={link.to}>
                <Link to={link.to} className="text-xs text-gray-600 underline underline-offset-2 hover:text-gray-900">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </footer>
    </div>
  );
}
