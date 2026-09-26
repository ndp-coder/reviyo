import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Check, Copy, ExternalLink, MessageSquare, PenLine, Info, RefreshCw, Edit3, AlertCircle, Lock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { generateReview } from '@/lib/ai-client';
import { trackEvent } from '@/lib/analytics';
import { legal, displayValue } from '@/config/legal';
import { safeExternalUrl } from '@/lib/url-safety';
import { readSource } from '@/lib/review-source';
import type { AIReviewStyle, CreateSessionResult } from '@/lib/types';
import { Alert, Button, Textarea, Spinner } from '@/components/ui';
import { buttonClasses } from '@/components/ui/button-styles';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';

interface TopicInfo {
  id: string;
  label: string;
}

type Step = 'loading' | 'error' | 'lapsed' | 'start' | 'generating' | 'review' | 'feedback' | 'done';

/** What the page shows for a business whose trial or plan has ended. */
interface LapsedBusiness {
  name: string;
  logoUrl: string | null;
  googleReviewUrl: string;
}

// create_review_session's refusal for an unknown, inactive, or lapsed business.
// Anything else is a connection or server problem worth retrying.
const isBusinessNotFound = (error: { message?: string }) => /Business not found/i.test(error.message ?? '');
const NOT_ACTIVE = 'This review page isn’t active right now. Please check the QR code or link, or ask the staff for help.';

// Two steps: say what you liked (and agree), then check the draft and post it.
// There is no star rating in Reviyo: customers choose their stars on Google,
// where the review is posted, so asking here as well only slowed them down.
// The feedback and thank-you screens sit outside the count.
const PROGRESS: Partial<Record<Step, number>> = { start: 1, generating: 2, review: 2 };
const PROGRESS_TOTAL = 2;

/**
 * Shared frame for every step: the business's name and logo stay visible after
 * the welcome screen (so the customer never wonders whose page this is), plus
 * the progress bar while they are inside the four-step flow.
 */
function Screen({
  children,
  business,
  step,
  wide = false,
}: {
  children: ReactNode;
  business?: { name: string; logoUrl: string | null };
  step?: Step;
  wide?: boolean;
}) {
  const position = step ? PROGRESS[step] : undefined;
  const width = wide ? 'max-w-md' : 'max-w-sm';
  return (
    <div className="flex min-h-screen flex-col bg-paper">
      {business && (
        <header className={`mx-auto w-full px-4 pt-4 sm:px-6 sm:pt-6 ${width}`}>
          <div className="flex items-center gap-2.5">
            {business.logoUrl && (
              <img
                src={business.logoUrl}
                alt=""
                className="h-8 w-8 flex-shrink-0 rounded-lg border border-gray-200 object-cover"
              />
            )}
            <p className="min-w-0 truncate text-sm font-medium text-gray-800">{business.name}</p>
            {position && (
              <p className="ml-auto flex-shrink-0 text-xs font-medium text-gray-600">
                Step {position} of {PROGRESS_TOTAL}
              </p>
            )}
          </div>
          {position && (
            <div className="mt-3 h-1 rounded-full bg-gray-200" aria-hidden="true">
              <div
                className="h-full rounded-full bg-brand-900 transition-[width] duration-300"
                style={{ width: `${(position / PROGRESS_TOTAL) * 100}%` }}
              />
            </div>
          )}
        </header>
      )}
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-6 sm:py-12">
        <main id="main-content" className={`w-full ${width}`}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function CustomerReviewPage() {
  const { slug } = useParams<{ slug: string }>();
  const [step, setStep] = useState<Step>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [bizInfo, setBizInfo] = useState<CreateSessionResult | null>(null);
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [generatedReview, setGeneratedReview] = useState('');
  const [editableReview, setEditableReview] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  // Set once the drafting limit is hit (HTTP 429): asking again would only fail.
  const [aiLimitReached, setAiLimitReached] = useState(false);
  // True when the customer writes the review in their own words instead of
  // using an AI draft — the fallback whenever drafting is unavailable.
  const [ownDraft, setOwnDraft] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clipboardFailed, setClipboardFailed] = useState(false);
  // Consent is never pre-ticked: DPDPA s.6(1) requires a clear affirmative action.
  const [consented, setConsented] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  // One save at a time: blocks double taps while a step is being saved, and
  // lets the current screen show progress and any failure.
  const [busy, setBusy] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  // A connection failure can be retried; a page that does not exist cannot.
  const [loadRetryable, setLoadRetryable] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [lapsed, setLapsed] = useState<LapsedBusiness | null>(null);

  // Analytics must never slow the customer down or block a step, so events are
  // sent in the background and failures are ignored (trackEvent logs them).
  // Which QR code or WhatsApp link brought this customer here (?src=...), so
  // the owner can see which spot works best. A place, never a person.
  const source = readSource(useLocation().search);

  const track = useCallback(
    (
      businessSlug: string,
      sessionToken: string | null,
      eventType: Parameters<typeof trackEvent>[2],
      metadata: Record<string, unknown> = {}
    ) => {
      void trackEvent(businessSlug, sessionToken, eventType, source ? { ...metadata, source } : metadata);
    },
    [source]
  );

  /** Runs a session RPC and reports whether it worked. */
  async function saveSession(fn: string, params: Record<string, unknown>): Promise<boolean> {
    const { error } = await supabase.rpc(fn, params);
    if (error) console.error(`${fn} failed:`, error.message);
    return !error;
  }

  const SAVE_FAILED = 'We couldn’t save that. Check your connection and try again.';

  // Initialize session
  useEffect(() => {
    let cancelled = false;
    async function init() {
      if (!slug) return;
      try {
        const { data, error } = await supabase.rpc('create_review_session', {
          p_business_slug: slug,
        });

        if (cancelled) return;
        if (error && isBusinessNotFound(error)) {
          // A printed QR code must never look broken to the shop's customers.
          // If the business's plan has ended, send them straight to its Google
          // review page (nothing is collected); otherwise say the page is off.
          const { data: lapsedData } = await supabase.rpc('get_lapsed_business_review_link', {
            p_business_slug: slug,
          });
          if (cancelled) return;
          const row = (lapsedData as
            | { business_name: string; business_logo_url: string | null; business_google_review_url: string }[]
            | null)?.[0];
          const googleUrl = safeExternalUrl(row?.business_google_review_url);
          if (row && googleUrl) {
            setLapsed({ name: row.business_name, logoUrl: row.business_logo_url, googleReviewUrl: googleUrl });
            document.title = `Review ${row.business_name} | Reviyo`;
            setStep('lapsed');
            return;
          }
          setErrorMsg(NOT_ACTIVE);
          setLoadRetryable(false);
          setStep('error');
          return;
        }
        if (error) {
          setErrorMsg('Check your internet connection and try again. If it keeps happening, scan the QR code again.');
          setLoadRetryable(true);
          setStep('error');
          return;
        }
        if (!data || data.length === 0) {
          setErrorMsg(NOT_ACTIVE);
          setLoadRetryable(false);
          setStep('error');
          return;
        }

        const info = data[0] as CreateSessionResult;
        setBizInfo(info);
        // The tab names the shop the customer is reviewing, not just "Reviyo".
        document.title = `Review ${info.business_name} | Reviyo`;

        void trackEvent(slug, info.session_token, 'qr_page_view', source ? { source } : {});

        // Load topics
        const { data: topicData } = await supabase
          .from('review_topics')
          .select('id, label')
          .eq('business_id', info.business_id)
          .eq('active', true)
          .order('display_order');

        if (cancelled) return;
        setTopics((topicData as TopicInfo[]) ?? []);
        setStep('start');
      } catch {
        if (cancelled) return;
        setErrorMsg('Check your internet connection and try again. If it keeps happening, scan the QR code again.');
        setLoadRetryable(true);
        setStep('error');
      }
    }
    init();
    return () => {
      cancelled = true;
    };
  }, [slug, loadAttempt, source]);

  // Move focus to the new screen's heading whenever the step changes, so screen
  // reader and keyboard users land at the top of the new content instead of on
  // <body> (the button they pressed no longer exists). Skipped for the first
  // screen, where focus should stay where the browser put it.
  const firstScreenShown = useRef(false);
  useEffect(() => {
    if (step === 'loading') return;
    if (!firstScreenShown.current) {
      firstScreenShown.current = true;
      return;
    }
    const heading = document.querySelector<HTMLElement>('#main-content h1');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
    window.scrollTo({ top: 0 });
  }, [step]);

  const goTo = (next: Step) => {
    setStepError(null);
    setStep(next);
  };

  // Counted once, the first time the customer taps a topic or types, so the
  // owner's funnel shows how many visitors began. Analytics only: nothing the
  // customer entered is sent until they agree and tap "Write my review".
  const startedTracked = useRef(false);
  const markStarted = () => {
    if (startedTracked.current || !slug || !bizInfo) return;
    startedTracked.current = true;
    track(slug, bizInfo.session_token, 'review_started');
  };

  const toggleTopic = (topicId: string) => {
    markStarted();
    setSelectedTopics((prev) =>
      prev.includes(topicId) ? prev.filter((t) => t !== topicId) : [...prev, topicId]
    );
  };

  // One tap does it all: records the consent, saves what the customer picked,
  // and writes the draft.
  const writeReview = async () => {
    if (!slug || !bizInfo || busy) return;

    if (!consented) {
      setConsentError('Please tick the box to continue.');
      return;
    }
    setConsentError(null);
    setStepError(null);
    markStarted();
    setBusy(true);

    // Record which version of the notice this person actually agreed to, so
    // the consent can be evidenced later (DPDPA s.6(1)). Nothing they entered
    // is saved before this succeeds.
    const consentSaved = await saveSession('record_review_consent', {
      p_session_token: bizInfo.session_token,
      p_consent_version: legal.consentVersion,
    });
    if (!consentSaved) {
      setBusy(false);
      setStepError(SAVE_FAILED);
      return;
    }

    const topicLabels = selectedTopics
      .map((id) => topics.find((t) => t.id === id)?.label)
      .filter((label): label is string => Boolean(label));
    // The AI draft reads the saved topics, so they must be stored first.
    const [statusSaved, topicsSaved] = await Promise.all([
      saveSession('update_review_session', { p_session_token: bizInfo.session_token, p_status: 'topics_selected' }),
      saveSession('set_session_topics', { p_session_token: bizInfo.session_token, p_topic_ids: selectedTopics }),
    ]);
    setBusy(false);
    if (!statusSaved || !topicsSaved) {
      setStepError(SAVE_FAILED);
      return;
    }
    track(slug, bizInfo.session_token, 'topics_selected', { topics: topicLabels });
    await generateAIReview('standard');
  };

  const generateAIReview = useCallback(async (style: AIReviewStyle = 'standard', isRegen = false) => {
    if (!bizInfo || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setStep('generating');

    const topicLabels = selectedTopics
      .map((id) => topics.find((t) => t.id === id)?.label)
      .filter((label): label is string => Boolean(label));

    try {
      const result = await generateReview(bizInfo.session_token, {
        businessName: bizInfo.business_name,
        businessCategory: bizInfo.business_category,
        selectedTopics: topicLabels,
        customerComment: comment.trim() || null,
        requestedStyle: style,
      });

      if (result.error || !result.review) {
        // The function's own wording ("Rate limit exceeded") is written for
        // developers; customers get what happened and what they can do.
        if (result.status === 429) {
          setAiLimitReached(true);
          setAiError(
            isRegen
              ? 'That’s as many new drafts as we can write for this visit.'
              : 'Our review writer is busy right now.'
          );
        } else {
          setAiError('The draft didn’t come through.');
        }
        setStep('review');
        setAiLoading(false);
        return;
      }

      // A draft came back, so drafting is available again.
      setAiLimitReached(false);
      setOwnDraft(false);
      setGeneratedReview(result.review);
      setEditableReview(result.review);
      setIsEditing(false);
      // Recorded for the owner's dashboard; the customer does not wait for it.
      void saveSession('update_review_session', {
        p_session_token: bizInfo.session_token,
        p_generated_review: result.review,
        p_status: 'review_generated',
      });
      track(bizInfo.business_slug, bizInfo.session_token, isRegen ? 'review_regenerated' : 'review_generated', { style });
      setStep('review');
    } catch {
      setAiError('We couldn’t reach our review writer. Check your connection.');
      setStep('review');
    }
    setAiLoading(false);
  }, [bizInfo, selectedTopics, topics, comment, aiLoading, track]);

  // Fallback when no AI draft is available: the customer writes the review
  // themselves, starting from their own comment, and can still post it.
  const writeOwnReview = () => {
    setOwnDraft(true);
    setAiError(null);
    setGeneratedReview('');
    setEditableReview(comment.trim());
    setIsEditing(true);
    goTo('review');
  };

  // Runs synchronously inside the tap. The Google link itself is a real <a
  // target="_blank">, so the browser opens it as part of the same tap; opening
  // it from code after an await is blocked as a pop-up on most phones.
  const copyReview = (opensGoogle: boolean) => {
    if (!bizInfo || !slug) return;
    const textToCopy = isEditing ? editableReview : generatedReview;
    if (isEditing) setGeneratedReview(editableReview);

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        setCopied(true);
        setClipboardFailed(false);
      })
      .catch(() => setClipboardFailed(true));

    track(slug, bizInfo.session_token, 'review_copied');
    if (opensGoogle) track(slug, bizInfo.session_token, 'google_review_opened');
    void saveSession('update_review_session', { p_session_token: bizInfo.session_token, p_status: 'completed' });
  };

  const submitFeedback = async () => {
    if (!bizInfo || !slug || !feedbackMessage.trim() || busy) return;
    setBusy(true);
    setFeedbackError(null);
    const sent = await saveSession('submit_private_feedback', {
      p_session_token: bizInfo.session_token,
      p_message: feedbackMessage.trim(),
      p_consent_version: legal.consentVersion,
    });
    setBusy(false);
    if (!sent) {
      setFeedbackError('Your message wasn’t sent. Check your connection and try again.');
      return;
    }
    track(slug, bizInfo.session_token, 'private_feedback_submitted');
    setFeedbackSent(true);
  };

  // ===== Loading state =====
  if (step === 'loading') {
    return (
      <Screen>
        <div className="flex flex-col items-center gap-3" role="status">
          <Spinner className="h-8 w-8 text-brand-600" />
          <p className="text-sm text-gray-600">Opening review page…</p>
        </div>
      </Screen>
    );
  }

  // ===== Error state =====
  if (step === 'error') {
    return (
      <Screen>
        <div className="text-center">
          <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
            <AlertCircle className="h-7 w-7 text-red-600" aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {loadRetryable ? 'Couldn’t open this page' : 'Page not available'}
          </h1>
          <p role="alert" className="mt-2 text-sm text-gray-600">{errorMsg}</p>
          {loadRetryable && (
            <Button
              className="mt-6 w-full"
              onClick={() => {
                setStep('loading');
                setLoadAttempt((attempt) => attempt + 1);
              }}
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
            </Button>
          )}
        </div>
      </Screen>
    );
  }

  // ===== Lapsed business =====
  // The owner's trial or plan has ended. No review session, no consent needed:
  // nothing is collected here, and the customer writes on Google directly.
  if (step === 'lapsed' && lapsed) {
    return (
      <Screen>
        <div className="text-center">
          {lapsed.logoUrl && (
            <img
              src={lapsed.logoUrl}
              alt={`${lapsed.name} logo`}
              className="mx-auto mb-5 h-20 w-20 rounded-xl border border-gray-200 object-cover"
            />
          )}
          <h1 className="text-2xl font-bold text-gray-900">Review {lapsed.name} on Google</h1>
          <p className="mt-2 text-sm text-gray-600">
            This opens {lapsed.name}&rsquo;s Google review page. You write and post your review there yourself.
          </p>
          <a href={lapsed.googleReviewUrl} rel="noopener noreferrer" className={`${buttonClasses({ size: 'lg' })} mt-6 w-full`}>
            Open Google reviews <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </a>
        </div>
      </Screen>
    );
  }

  if (!bizInfo) return null;

  const welcomeMessage = bizInfo.business_welcome_message || `How was your experience at ${bizInfo.business_name}?`;
  const brand = { name: bizInfo.business_name, logoUrl: bizInfo.business_logo_url };

  // Owner-supplied. Anything that is not an absolute http(s) URL is dropped
  // rather than rendered — see src/lib/url-safety.ts.
  const googleReviewUrl = safeExternalUrl(bizInfo.business_google_review_url);

  // ===== Start: what they liked, and consent =====
  // Everything on one screen: tap what you liked, add your own words if you
  // want, agree, and the draft is written. The notice required by DPDPA s.5 —
  // what is collected, why, who sees it, and how to have it deleted — sits
  // above an unticked consent box, and nothing entered is saved until the
  // customer agrees and taps "Write my review".
  if (step === 'start') {
    const hasTopics = topics.length > 0;
    const canWrite = !hasTopics || selectedTopics.length > 0 || comment.trim().length > 0;
    return (
      <Screen business={brand} step={step}>
        <h1 className="text-center text-2xl font-bold text-gray-900">{welcomeMessage}</h1>
        <p className="mt-2 text-center text-sm text-gray-600">
          Tap what you liked and we&rsquo;ll draft a Google review for you to check and post. It takes about a minute.
        </p>

        {/* aria-pressed makes the selected state audible; without it a screen
            reader user cannot tell which chips they have already chosen. */}
        {hasTopics && (
          <>
            <h2 id="topics-heading" className="mt-6 text-center text-sm font-semibold text-gray-900">
              What did you like?
            </h2>
            <div role="group" aria-labelledby="topics-heading" className="mt-3 flex flex-wrap justify-center gap-2">
              {topics.map((topic) => {
                const selected = selectedTopics.includes(topic.id);
                return (
                  <button
                    key={topic.id}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTopic(topic.id)}
                    className={`inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium transition-colors active:scale-95 ${
                      selected
                        ? 'bg-brand-900 text-white'
                        : 'border border-gray-400 bg-white text-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {selected && <Check className="mr-1 h-3.5 w-3.5" aria-hidden="true" />}
                    {topic.label}
                  </button>
                );
              })}
            </div>
          </>
        )}

        <div className="mt-6">
          <Textarea
            label={hasTopics ? 'In your own words, good or bad (optional)' : 'Tell us about your visit'}
            value={comment}
            onChange={(e) => {
              markStarted();
              setComment(e.target.value);
            }}
            placeholder="e.g. Great coffee, but the wait was a bit long"
            rows={3}
            maxLength={2000}
            aria-describedby="comment-privacy-hint"
          />
          {/* Data minimisation: the review is destined for a public Google
              listing, so the safest comment is one with no personal data in
              it at all. Say so at the point of entry, not only in a policy. */}
          <p
            id="comment-privacy-hint"
            className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-gray-600"
          >
            <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
            <span>
              Please don&apos;t include names, phone numbers, addresses, or health or payment
              details — yours or anyone else&apos;s. This text will be sent to our AI provider, and
              the review you end up with is meant to be posted publicly.
            </span>
          </p>
        </div>

        <section
          aria-labelledby="privacy-notice-heading"
          className="mt-6 rounded-xl border border-gray-200 bg-white p-4 text-left"
        >
          <h2 id="privacy-notice-heading" className="text-sm font-semibold text-gray-900">
            Your privacy
          </h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-gray-700">
            <li>
              We save the <strong>topics you tap</strong> and <strong>anything you type</strong> —
              nothing else. No name, phone number, or login.
            </li>
            <li>
              It goes to our AI provider to draft your review, and {bizInfo.business_name} can see it.
              Nothing is posted for you: you decide whether to post on Google.
            </li>
            <li>
              It is deleted after {legal.sessionRetentionDays} days. No cookies, no tracking.
            </li>
          </ul>
          <p className="mt-3 text-sm text-gray-700">
            Read the{' '}
            <Link
              to="/privacy"
              target="_blank"
              className="font-medium text-brand-700 underline underline-offset-2"
            >
              Privacy Policy<span className="sr-only"> (opens in a new tab)</span>
            </Link>{' '}
            or email{' '}
            <a
              href={`mailto:${legal.privacyEmail}`}
              className="font-medium text-brand-700 underline underline-offset-2"
            >
              {displayValue(legal.privacyEmail)}
            </a>{' '}
            to have it deleted.
          </p>
        </section>

        <div className="mt-4">
          <ConsentCheckbox
            checked={consented}
            onChange={(value) => {
              setConsented(value);
              if (value) setConsentError(null);
            }}
            error={consentError}
          >
            I agree to share this with {bizInfo.business_name} and to have AI draft a review from
            what I enter. I am 18 or older.
          </ConsentCheckbox>
        </div>

        {stepError && <Alert variant="error" className="mt-4">{stepError}</Alert>}
        <Button
          size="lg"
          className="mt-5 w-full"
          onClick={writeReview}
          // A business with no active topics must not strand the customer here.
          disabled={!canWrite}
          loading={busy}
        >
          <PenLine className="h-4 w-4" aria-hidden="true" /> Write my review
        </Button>
        {!canWrite && (
          <p className="mt-2 text-center text-xs text-gray-600">Tap something you liked, or write a few words, to continue.</p>
        )}
      </Screen>
    );
  }

  // ===== Generating step =====
  if (step === 'generating') {
    return (
      <Screen business={brand} step={step} wide>
        {/* aria-busy plus a polite live region so a screen reader announces the
            wait and, later, the result — rather than going silent. */}
        <div className="text-center" role="status" aria-live="polite" aria-busy="true">
          <h1 className="text-xl font-bold text-gray-900">Writing your review…</h1>
          <p className="mt-2 text-sm text-gray-600">Drafting from what you told us. This takes a few seconds.</p>
          {/* Placeholder lines in the shape of the draft that is coming, so the
              screen does not jump when it arrives. */}
          <div className="mt-6 space-y-2.5 rounded-xl border border-gray-200 bg-white p-5" aria-hidden="true">
            <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-11/12 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-full animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-3/5 animate-pulse rounded bg-gray-200" />
          </div>
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
            <Spinner className="h-4 w-4 text-brand-700" /> Working on it
          </p>
        </div>
      </Screen>
    );
  }

  // ===== Review step, when no draft could be written =====
  // A missing draft must never stop the customer from posting: writing it in
  // their own words is always offered, and is the main action once the
  // drafting limit has been reached (retrying would only fail again).
  if (step === 'review' && !generatedReview && !ownDraft) {
    return (
      <Screen business={brand} step={step}>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">We couldn’t write your draft</h1>
          <Alert variant="error" className="mt-4 text-left">
            {aiError ?? 'The draft didn’t come through.'}{' '}
            {aiLimitReached
              ? 'You can write the review in your own words instead — it only takes a minute.'
              : 'Try again, or write the review in your own words.'}
          </Alert>
          <div className="mt-6 space-y-3">
            <Button className="w-full" variant={aiLimitReached ? 'primary' : 'outline'} onClick={writeOwnReview}>
              <Edit3 className="h-4 w-4" aria-hidden="true" /> Write it myself
            </Button>
            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={() => goTo('start')}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </Button>
              {!aiLimitReached && (
                <Button className="flex-1" onClick={() => generateAIReview('standard')}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" /> Try again
                </Button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => goTo('feedback')}
            className="mt-6 min-h-11 w-full rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            Send private feedback to {bizInfo.business_name} instead
          </button>
        </div>
      </Screen>
    );
  }

  // ===== Review step =====
  if (step === 'review') {
    return (
      <Screen business={brand} step={step} wide>
        <h1 className="text-center text-2xl font-bold text-gray-900">{ownDraft ? 'Your review' : 'Your draft review'}</h1>
        <p className="mt-1.5 text-center text-sm text-gray-600">
          {ownDraft
            ? 'Write a few sentences about your visit, then copy and post it on Google.'
            : 'Read it, change anything that isn’t right, then copy and post it on Google.'}
        </p>

        {aiError && (
          <Alert variant="error" className="mt-4">
            {aiError} Your current draft is below — you can still edit it yourself.
          </Alert>
        )}

        {/* Transparency about machine-generated text. The customer is about to
            publish this under their own name, so they need to know an AI wrote
            the first draft and that they are responsible for its accuracy. */}
        {!ownDraft && (
        <p className="mt-4 flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs leading-relaxed text-amber-900">
          <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
          <span>
            <strong>This draft was written by AI</strong> from the topics you tapped and your comment.
            Please check it reflects your real experience before posting — you are the one
            publishing it.
          </span>
        </p>
        )}

        <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          {isEditing ? (
            <Textarea
              label={ownDraft ? 'Your review' : 'Edit your review'}
              placeholder={ownDraft ? 'e.g. Friendly staff and the treatment was quick and painless.' : undefined}
              value={editableReview}
              onChange={(e) => setEditableReview(e.target.value)}
              rows={7}
              maxLength={2000}
              autoFocus
            />
          ) : (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800" aria-live="polite">
              {generatedReview}
            </p>
          )}
        </div>

        {/* Review controls. Every label says what the button will do to the
            draft, so it reads correctly out of context in a screen reader's
            element list. Editing comes first: it keeps the customer's own words. */}
        {/* Own words: the text box stays open, and there is nothing for AI to change. */}
        {!ownDraft && (
        <div role="group" aria-label="Change this draft" className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Button
            variant={isEditing ? 'primary' : 'outline'}
            size="sm"
            aria-pressed={isEditing}
            onClick={() => {
              setIsEditing(!isEditing);
              if (isEditing) setGeneratedReview(editableReview);
            }}
          >
            <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
            {isEditing ? 'Done editing' : 'Edit it myself'}
          </Button>
          {/* Hidden once the drafting limit is reached: they would only fail. */}
          {!aiLimitReached && (
            <>
              <Button variant="outline" size="sm" onClick={() => generateAIReview('shorter', true)} disabled={aiLoading}>
                Make it shorter
              </Button>
              <Button variant="outline" size="sm" onClick={() => generateAIReview('detailed', true)} disabled={aiLoading}>
                Add more detail
              </Button>
              <Button variant="outline" size="sm" onClick={() => generateAIReview('standard', true)} disabled={aiLoading}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Another version
              </Button>
            </>
          )}
        </div>
        )}

        {/* Copy & Open Google */}
        <div className="mt-6 space-y-3">
          {isEditing && !editableReview.trim() ? (
            // Nothing to copy yet. (A link cannot be disabled, so this is a button.)
            <Button size="lg" className="w-full" disabled>
              <Copy className="h-5 w-5" aria-hidden="true" />
              {googleReviewUrl ? 'Copy review and open Google' : 'Copy review'}
            </Button>
          ) : googleReviewUrl ? (
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                copyReview(true);
                // Show the thank-you screen when they come back to this tab.
                window.setTimeout(() => goTo('done'), 600);
              }}
              className={`${buttonClasses({ size: 'lg' })} w-full`}
            >
              <Copy className="h-5 w-5" aria-hidden="true" />
              Copy review and open Google
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          ) : (
            <Button size="lg" className="w-full" onClick={() => copyReview(false)}>
              {copied ? <Check className="h-5 w-5" aria-hidden="true" /> : <Copy className="h-5 w-5" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy review'}
            </Button>
          )}

          {clipboardFailed && (
            <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="mb-1 font-medium">We couldn&apos;t copy it automatically.</p>
              <p className="text-xs">Press and hold the review text above to select and copy it, then open Google.</p>
              {googleReviewUrl && (
                <a
                  href={googleReviewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 underline underline-offset-2"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open Google Reviews
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              )}
            </div>
          )}

          <p className="text-center text-xs text-gray-600">
            {googleReviewUrl
              ? 'Google opens in a new tab. Paste your review there, choose your star rating, and tap Post. Nothing is posted for you.'
              : `Paste it on ${bizInfo.business_name}’s Google listing to post it. Nothing is posted for you.`}
          </p>
          {/* Without a Google link there is no automatic hand-off, so give an
              explicit way to finish instead of leaving the customer here. */}
          {!googleReviewUrl && copied && (
            <Button variant="outline" className="w-full" onClick={() => goTo('done')}>
              I&apos;m done
            </Button>
          )}
        </div>

        {/* Private feedback */}
        <div className="mt-6 border-t border-gray-200 pt-4">
          <button
            type="button"
            onClick={() => goTo('feedback')}
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span>Send private feedback to {bizInfo.business_name} instead</span>
          </button>
        </div>
      </Screen>
    );
  }

  // ===== Private feedback step =====
  if (step === 'feedback') {
    return (
      <Screen business={brand}>
        {feedbackSent ? (
          <div className="text-center" role="status" aria-live="polite">
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
              <Check className="h-7 w-7 text-green-700" aria-hidden="true" />
            </div>
            <h1 className="text-xl font-bold text-gray-900">Feedback sent</h1>
            <p className="mt-2 text-sm text-gray-600">Thank you. {bizInfo.business_name} will see your message.</p>
            <Button className="mt-6 w-full" onClick={() => goTo('done')}>
              Finish
            </Button>
          </div>
        ) : (
          <>
            <h1 className="text-center text-2xl font-bold text-gray-900">Private feedback</h1>
            <p className="mt-2 text-center text-sm text-gray-600">
              This goes straight to {bizInfo.business_name} and is never posted publicly.
            </p>
            <div className="mt-6">
              <Textarea
                label="Your message"
                value={feedbackMessage}
                onChange={(e) => setFeedbackMessage(e.target.value)}
                placeholder="What should they know?"
                rows={5}
                maxLength={5000}
                aria-describedby="feedback-privacy-hint"
              />
              <p id="feedback-privacy-hint" className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-gray-600">
                <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Sent to {bizInfo.business_name} only — not to the AI, and never published. It is
                  deleted after {legal.feedbackRetentionDays} days. Please leave out personal
                  details you don&apos;t want the business to keep.
                </span>
              </p>
            </div>
            {feedbackError && <Alert variant="error" className="mt-4">{feedbackError}</Alert>}
            <div className="mt-4 flex gap-3">
              {/* Back returns to wherever the customer came from: the draft if
                  there is one, otherwise the first screen. */}
              <Button variant="ghost" onClick={() => goTo(generatedReview ? 'review' : 'start')} disabled={busy}>
                <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
              </Button>
              <Button className="flex-1" onClick={submitFeedback} disabled={!feedbackMessage.trim()} loading={busy}>
                Send privately
              </Button>
            </div>
          </>
        )}
      </Screen>
    );
  }

  // ===== Done step =====
  if (step === 'done') {
    return (
      <Screen business={brand}>
        <div className="animate-scale-in text-center" role="status" aria-live="polite">
          <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <Check className="h-8 w-8 text-green-700" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Thank you</h1>
          <p className="mt-2 text-sm text-gray-600">
            {copied
              ? `Your review is on your clipboard. Paste it on Google and post it to help ${bizInfo.business_name}.`
              : `Thanks for sharing your experience with ${bizInfo.business_name}.`}
          </p>
          <div className="mt-6 space-y-3">
            {googleReviewUrl && (
              <a
                href={googleReviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonClasses({ size: 'lg' })} w-full`}
              >
                <ExternalLink className="h-5 w-5" aria-hidden="true" /> Open Google Reviews
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            )}
            {!feedbackSent && (
              <button
                type="button"
                onClick={() => goTo('feedback')}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 hover:text-gray-900"
              >
                <MessageSquare className="h-4 w-4" aria-hidden="true" /> Send private feedback to the business
              </button>
            )}
          </div>
          <p className="mt-8 text-xs text-gray-600">
            <Link to="/privacy" className="underline underline-offset-2 hover:text-gray-900">
              How we handle your data
            </Link>
          </p>
        </div>
      </Screen>
    );
  }

  return null;
}
