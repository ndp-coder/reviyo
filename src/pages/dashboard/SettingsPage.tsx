import { useState, useEffect, useRef, type KeyboardEvent } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Save, Plus, X, ArrowUp, ArrowDown, Upload, Eye, EyeOff, Check, Copy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import {
  businessCategories,
  getCategoryLabel,
  getSuggestedTopics,
  isPresetCategory,
  MAX_CATEGORY_LENGTH,
  OTHER_CATEGORY,
} from '@/config/categories';
import { directReviewUrl, validateGoogleReviewUrl } from '@/lib/url-safety';
import { Alert, Card, Button, Input, Select, IconButton, Skeleton, PageHeader } from '@/components/ui';
import { prepareLogo } from '@/lib/image';
import { DataRightsCard } from '@/components/dashboard/DataRightsCard';
import { AiTopicSuggestions } from '@/components/AiTopicSuggestions';
import { GoogleReviewLinkHelp } from '@/components/GoogleReviewLinkHelp';
import type { Business, ReviewTopic } from '@/lib/types';

const TABS = [
  { key: 'profile', label: 'Business profile' },
  { key: 'topics', label: 'Review topics' },
  { key: 'google', label: 'Google review link' },
  { key: 'account', label: 'Account & data' },
] as const;
type TabKey = (typeof TABS)[number]['key'];
const MAX_TOPIC_LENGTH = 80;

export function SettingsPage() {
  const { business, setBusiness } = useOutletContext<{ business: Business | null; setBusiness: (b: Business) => void }>();
  const { user } = useAuth();
  const [name, setName] = useState('');
  // A preset value, or OTHER_CATEGORY with the owner's own text in customCategory.
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [googleReviewUrl, setGoogleReviewUrl] = useState('');
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [topics, setTopics] = useState<ReviewTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [newTopic, setNewTopic] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  // Labels as last saved, so an invalid rename can be put back.
  const savedLabels = useRef(new Map<string, string>());
  const [saving, setSaving] = useState(false);
  // Result of the last action, shown next to the control that triggered it.
  const [status, setStatus] = useState<{ variant: 'success' | 'error'; message: string } | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // The open tab lives in the URL (?tab=google), so other pages can link
  // straight to it and a reload keeps you where you were.
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab');
  const activeTab: TabKey = TABS.some((t) => t.key === requestedTab) ? (requestedTab as TabKey) : 'profile';
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function selectTab(key: TabKey, focus = false) {
    setSearchParams(key === 'profile' ? {} : { tab: key }, { replace: true });
    setStatus(null);
    setConfirmDeleteId(null);
    if (focus) tabRefs.current[key]?.focus();
    // On phones the tab strip scrolls sideways; keep the chosen tab in view.
    tabRefs.current[key]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // A deep link can open a tab that starts off-screen on a phone.
  useEffect(() => {
    tabRefs.current[activeTab]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    // Only on first render; later changes go through selectTab.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // WAI-ARIA tabs: arrow keys move between tabs, Home/End jump to the ends.
  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = TABS.length - 1;
    const target =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1)
      : event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1)
      : event.key === 'Home' ? 0
      : event.key === 'End' ? last
      : null;
    if (target === null) return;
    event.preventDefault();
    selectTab(TABS[target].key, true);
  }

  useEffect(() => {
    if (business) {
      setName(business.name);
      if (isPresetCategory(business.category)) {
        setCategory(business.category);
        setCustomCategory('');
      } else {
        setCategory(OTHER_CATEGORY);
        setCustomCategory(business.category === OTHER_CATEGORY ? '' : business.category);
      }
      setGoogleReviewUrl(business.google_review_url ?? '');
      setWelcomeMessage(business.welcome_message ?? '');
      setLogoUrl(business.logo_url ?? '');
    }
  }, [business]);

  useEffect(() => {
    async function loadTopics() {
      if (!business) return;
      const { data } = await supabase
        .from('review_topics')
        .select('*')
        .eq('business_id', business.id)
        .order('display_order');
      const loaded = (data as ReviewTopic[]) ?? [];
      savedLabels.current = new Map(loaded.map((t) => [t.id, t.label]));
      setTopics(loaded);
      setTopicsLoading(false);
    }
    loadTopics();
  }, [business]);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  // Left blank, "Other" is saved as-is, which is how businesses created before
  // custom categories existed are stored.
  const effectiveCategory = category === OTHER_CATEGORY ? customCategory.trim() || OTHER_CATEGORY : category;

  const profileDirty =
    !!business &&
    (name !== business.name ||
      effectiveCategory !== business.category ||
      welcomeMessage !== (business.welcome_message ?? '') ||
      logoUrl !== (business.logo_url ?? ''));
  const linkDirty = !!business && googleReviewUrl !== (business.google_review_url ?? '');

  async function saveProfile() {
    if (!business) return;

    // Rejected here as well as by a database CHECK constraint, so a bad link
    // can never reach a customer's review page. Only a changed link is
    // checked: one saved before the direct-link rule must not block saving a
    // new name or logo (Overview already asks the owner to switch it).
    const urlProblem = linkDirty ? validateGoogleReviewUrl(googleReviewUrl) : null;
    setUrlError(urlProblem);
    if (urlProblem) {
      // The field with the error may be on another tab.
      if (activeTab !== 'google') {
        setStatus({ variant: 'error', message: 'Your Google review link needs fixing first. Open the Google review link tab to see why.' });
      }
      return;
    }

    if (!name.trim()) {
      setStatus({ variant: 'error', message: 'Your business name can’t be empty.' });
      return;
    }

    // Saved in the form that opens the review form itself (g.page links get
    // "/review"), and shown that way in the field too.
    const reviewLink = !linkDirty
      ? business.google_review_url ?? ''
      : googleReviewUrl.trim() ? directReviewUrl(googleReviewUrl) : '';
    setGoogleReviewUrl(reviewLink);

    setSaving(true);
    setStatus(null);
    const { data, error } = await supabase
      .from('businesses')
      .update({
        name: name.trim(),
        category: effectiveCategory,
        google_review_url: reviewLink || null,
        welcome_message: welcomeMessage || null,
        logo_url: logoUrl || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', business.id)
      .select()
      .single();
    setSaving(false);
    if (error || !data) {
      setStatus({
        variant: 'error',
        message:
          error?.code === '23514'
            ? 'That Google link or logo isn’t accepted. Check the link starts with https:// and try again.'
            : 'Your changes weren’t saved. Check your connection and try again.',
      });
      return;
    }
    setBusiness(data as Business);
    setStatus({ variant: 'success', message: 'Changes saved.' });
  }

  // Every topic change saves as soon as it is made — adding, renaming (when
  // the field loses focus), reordering, hiding, and deleting — so there is no
  // separate Save button to forget.
  function addTopic(topicLabel = newTopic) {
    addTopics([topicLabel]).then(() => setNewTopic(''));
  }

  // Inserts several topics in one request so their display order is correct
  // and none are lost to stale state when AI suggestions are added together.
  async function addTopics(labels: string[]) {
    if (!business) return;
    const taken = new Set(topics.map((topic) => topic.label.trim().toLowerCase()));
    const fresh: string[] = [];
    for (const raw of labels) {
      const label = raw.trim();
      if (!label || label.length > MAX_TOPIC_LENGTH || taken.has(label.toLowerCase())) continue;
      taken.add(label.toLowerCase());
      fresh.push(label);
    }
    if (fresh.length === 0) return;

    const { data, error } = await supabase
      .from('review_topics')
      .insert(fresh.map((label, i) => ({
        business_id: business.id,
        label,
        display_order: topics.length + i,
        active: true,
      })))
      .select();
    if (error) {
      setStatus({ variant: 'error', message: 'That topic wasn’t added. Check your connection and try again.' });
      return;
    }
    if (data) {
      for (const topic of data as ReviewTopic[]) savedLabels.current.set(topic.id, topic.label);
      setTopics((current) => [...current, ...(data as ReviewTopic[])]);
    }
  }

  async function renameTopic(id: string) {
    const topic = topics.find((t) => t.id === id);
    const previous = savedLabels.current.get(id);
    if (!topic || previous === undefined) return;
    const label = topic.label.trim();
    if (label === previous) return;
    if (!label || label.length > MAX_TOPIC_LENGTH) {
      setTopics((current) => current.map((t) => (t.id === id ? { ...t, label: previous } : t)));
      setStatus({ variant: 'error', message: `Topic names need 1 to ${MAX_TOPIC_LENGTH} characters, so “${previous}” was kept.` });
      return;
    }
    const { error } = await supabase.from('review_topics').update({ label }).eq('id', id);
    if (error) {
      setTopics((current) => current.map((t) => (t.id === id ? { ...t, label: previous } : t)));
      setStatus({ variant: 'error', message: 'That rename wasn’t saved. Check your connection and try again.' });
      return;
    }
    savedLabels.current.set(id, label);
    setTopics((current) => current.map((t) => (t.id === id ? { ...t, label } : t)));
    setStatus({ variant: 'success', message: `Renamed to “${label}”.` });
  }

  async function deleteTopic(id: string) {
    const previous = topics;
    setConfirmDeleteId(null);
    setTopics((current) => current.filter((t) => t.id !== id));
    const { error } = await supabase.from('review_topics').delete().eq('id', id);
    if (error) {
      setTopics(previous);
      setStatus({ variant: 'error', message: 'That topic wasn’t deleted. Check your connection and try again.' });
    }
  }

  async function moveTopic(index: number, dir: -1 | 1) {
    const newIndex = index + dir;
    if (newIndex < 0 || newIndex >= topics.length) return;
    const previous = topics;
    const reordered = [...topics];
    [reordered[index], reordered[newIndex]] = [reordered[newIndex], reordered[index]];
    setTopics(reordered.map((t, i) => ({ ...t, display_order: i })));
    // Stored positions are not always 0..n-1 (adding after a delete can leave
    // gaps or repeats), so renumber every row that is out of place — not just
    // the two that swapped — or the saved order could come back scrambled.
    const results = await Promise.all(
      reordered
        .map((topic, i) => ({ topic, i }))
        .filter(({ topic, i }) => topic.display_order !== i)
        .map(({ topic, i }) => supabase.from('review_topics').update({ display_order: i }).eq('id', topic.id))
    );
    if (results.some((result) => result.error)) {
      setTopics(previous);
      setStatus({ variant: 'error', message: 'The new order wasn’t saved. Check your connection and try again.' });
    }
  }

  async function toggleTopicActive(id: string) {
    const topic = topics.find((t) => t.id === id);
    if (!topic) return;
    const active = !topic.active;
    setConfirmDeleteId(null);
    setTopics((current) => current.map((t) => (t.id === id ? { ...t, active } : t)));
    const { error } = await supabase.from('review_topics').update({ active }).eq('id', id);
    if (error) {
      setTopics((current) => current.map((t) => (t.id === id ? { ...t, active: !active } : t)));
      setStatus({ variant: 'error', message: 'That change wasn’t saved. Check your connection and try again.' });
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const result = await prepareLogo(file);
    if ('error' in result) {
      setLogoError(result.error);
      return;
    }
    setLogoError(null);
    setLogoUrl(result.dataUrl);
  }

  if (!business) return null;

  const reviewPageUrl = `${window.location.origin}/r/${business.slug}`;
  const activeCount = topics.filter((t) => t.active).length;
  const suggestions = getSuggestedTopics(category).filter(
    (s) => !topics.some((t) => t.label.trim().toLowerCase() === s.toLowerCase())
  );

  const saveBar = (label: string, dirty: boolean) => (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <Button onClick={saveProfile} loading={saving}>
        <Save className="h-4 w-4" aria-hidden="true" /> {label}
      </Button>
      {status ? (
        <Alert variant={status.variant} className="flex-1 py-2">
          {status.message}
        </Alert>
      ) : (
        dirty && <p className="text-sm text-amber-800">You have unsaved changes.</p>
      )}
    </div>
  );

  return (
    <div>
      <PageHeader title="Settings" description="Your business profile, review page, and account." />

      {/* Tabs */}
      <div role="tablist" aria-label="Settings sections" className="scrollbar-none mt-6 flex gap-1 overflow-x-auto overflow-y-hidden border-b border-gray-200">
        {TABS.map((tab, index) => {
          const selected = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              ref={(el) => {
                tabRefs.current[tab.key] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${tab.key}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${tab.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(tab.key)}
              onKeyDown={(event) => onTabKeyDown(event, index)}
              className={`min-h-11 flex-shrink-0 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors ${
                selected
                  ? 'border-brand-700 text-brand-800'
                  : 'border-transparent text-gray-600 hover:border-gray-300 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Profile tab */}
      {activeTab === 'profile' && (
        <div role="tabpanel" id="settings-panel-profile" aria-labelledby="settings-tab-profile" className="mt-6 space-y-4">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Business information</h2>
            <div className="space-y-4">
              <Input label="Business name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="organization" maxLength={200} />
              <Select id="settings-category" label="Category" value={category} onChange={(e) => setCategory(e.target.value)}>
                {businessCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </Select>
              {category === OTHER_CATEGORY && (
                <Input
                  label="What kind of business is it?"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  maxLength={MAX_CATEGORY_LENGTH}
                  placeholder="e.g. Pet grooming, Yoga studio, Printing shop"
                />
              )}
              <Input
                label="Welcome message"
                maxLength={500}
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                placeholder={`How was your experience at ${name || business.name}?`}
                hint="The first line customers read after scanning your QR code."
              />
            </div>
          </Card>

          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Logo</h2>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={`Current logo for ${name || 'your business'}`}
                  className="h-20 w-20 flex-shrink-0 rounded-lg border border-gray-300 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs text-gray-600">
                  No logo
                </div>
              )}
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <label
                    htmlFor="settings-logo-upload"
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand-700"
                  >
                    <Upload className="h-4 w-4" aria-hidden="true" /> {logoUrl ? 'Replace' : 'Upload logo'}
                    <input
                      id="settings-logo-upload"
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="sr-only"
                      onChange={handleLogoUpload}
                    />
                  </label>
                  {logoUrl && (
                    <Button variant="ghost" size="sm" onClick={() => setLogoUrl('')}>
                      <X className="h-4 w-4" aria-hidden="true" /> Remove
                    </Button>
                  )}
                </div>
                <p className="mt-2 text-xs text-gray-600">PNG, JPG, or WebP. We resize it for you.</p>
                {logoError && (
                  <p role="alert" className="mt-1 text-xs font-medium text-red-700">
                    {logoError}
                  </p>
                )}
              </div>
            </div>
          </Card>

          {saveBar('Save changes', profileDirty)}
        </div>
      )}

      {/* Topics tab */}
      {activeTab === 'topics' && (
        <div role="tabpanel" id="settings-panel-topics" aria-labelledby="settings-tab-topics" className="mt-6 space-y-4">
          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Review topics</h2>
              {!topicsLoading && (
                <p className="text-xs text-gray-600">
                  {activeCount} shown to customers{topics.length > activeCount ? `, ${topics.length - activeCount} hidden` : ''}
                </p>
              )}
            </div>
            <p className="mt-1 text-sm text-gray-600">
              Customers tap these to say what stood out. Changes save straight away.
            </p>

            {topicsLoading ? (
              <div className="mt-4 space-y-2" role="status" aria-label="Loading topics">
                {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12" />)}
              </div>
            ) : topics.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-gray-300 px-4 py-5 text-center text-sm text-gray-600">
                No topics yet. Customers can still leave a review, but topics make the drafts more specific — add a few below.
              </p>
            ) : (
              <ul className="mt-4 space-y-2">
                {topics.map((topic, i) => (
                  <li key={topic.id} className={`rounded-lg border ${topic.active ? 'border-gray-300' : 'border-dashed border-gray-300 bg-gray-50'}`}>
                    <div className="flex items-center gap-1 py-1 pl-3 pr-1">
                      <input
                        value={topic.label}
                        aria-label={`Topic ${i + 1} name`}
                        maxLength={MAX_TOPIC_LENGTH}
                        onChange={(e) => {
                          const label = e.target.value;
                          setTopics((current) => current.map((t) => (t.id === topic.id ? { ...t, label } : t)));
                        }}
                        onBlur={() => renameTopic(topic.id)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className={`min-w-0 flex-1 bg-transparent py-1.5 text-sm outline-none ${topic.active ? 'text-gray-900' : 'text-gray-600 line-through decoration-gray-400'}`}
                      />
                      <IconButton onClick={() => moveTopic(i, -1)} disabled={i === 0} aria-label={`Move ${topic.label} up`}>
                        <ArrowUp className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton onClick={() => moveTopic(i, 1)} disabled={i === topics.length - 1} aria-label={`Move ${topic.label} down`}>
                        <ArrowDown className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                      <IconButton
                        onClick={() => toggleTopicActive(topic.id)}
                        aria-pressed={!topic.active}
                        aria-label={`Hide ${topic.label} from customers`}
                        title={topic.active ? 'Hide from customers' : 'Show to customers'}
                      >
                        {topic.active ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
                      </IconButton>
                      <IconButton
                        tone="danger"
                        onClick={() => setConfirmDeleteId(confirmDeleteId === topic.id ? null : topic.id)}
                        aria-expanded={confirmDeleteId === topic.id}
                        aria-label={`Delete topic ${topic.label}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                      </IconButton>
                    </div>
                    {/* Deleting also removes the topic from past visits in
                        Analytics (the link cascades), so it is confirmed, and
                        hiding — which keeps the history — is offered instead. */}
                    {confirmDeleteId === topic.id && (
                      <div role="group" aria-label={`Confirm deleting ${topic.label}`} className="border-t border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-900 rounded-b-lg">
                        <p>Delete “{topic.label}”? It is also removed from past visits in Analytics.</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Button size="sm" variant="danger" onClick={() => deleteTopic(topic.id)}>
                            Delete
                          </Button>
                          {topic.active && (
                            <Button size="sm" variant="outline" onClick={() => toggleTopicActive(topic.id)}>
                              Hide instead
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

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
              <Button variant="outline" onClick={() => addTopic()} disabled={!newTopic.trim()}>
                <Plus className="h-4 w-4" aria-hidden="true" /> Add
              </Button>
            </div>

            {suggestions.length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-medium text-gray-700">Common for {getCategoryLabel(effectiveCategory)}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => addTopic(s)}
                      aria-label={`Add suggested topic ${s}`}
                      className="inline-flex min-h-8 items-center gap-1 rounded-full border border-gray-300 bg-white px-2.5 text-xs text-gray-800 hover:border-brand-600 hover:bg-brand-50"
                    >
                      <Plus className="h-3 w-3" aria-hidden="true" /> {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="mt-4">
              <AiTopicSuggestions
                businessName={name || business.name}
                category={getCategoryLabel(effectiveCategory)}
                existingTopics={topics.map((t) => t.label)}
                onAdd={(labels) => { void addTopics(labels); }}
              />
            </div>
          </Card>
          {status && (
            <Alert variant={status.variant} className="py-2">
              {status.message}
            </Alert>
          )}
        </div>
      )}

      {/* Google link tab */}
      {activeTab === 'google' && (
        <div role="tabpanel" id="settings-panel-google" aria-labelledby="settings-tab-google" className="mt-6 space-y-4">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">Google review link</h2>
            <p className="mb-4 text-sm text-gray-600">
              Where customers land to post their review. Without it they can still copy their draft, but have to find your Google listing themselves.
            </p>
            <Input
              label="Google review link"
              type="url"
              inputMode="url"
              value={googleReviewUrl}
              error={urlError ?? undefined}
              onChange={(e) => {
                setGoogleReviewUrl(e.target.value);
                if (urlError) setUrlError(null);
              }}
              placeholder="https://g.page/r/..."
            />
            <div className="mt-4">
              <GoogleReviewLinkHelp
                businessName={name || business.name}
                currentUrl={googleReviewUrl}
                onUseLink={(url) => {
                  setGoogleReviewUrl(url);
                  setUrlError(null);
                }}
              />
            </div>
          </Card>
          {saveBar('Save link', linkDirty)}
        </div>
      )}

      {/* Account tab */}
      {activeTab === 'account' && (
        <div role="tabpanel" id="settings-panel-account" aria-labelledby="settings-tab-account" className="mt-6 space-y-4">
          <Card className="p-5 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-gray-900">Account</h2>
            <dl className="divide-y divide-gray-100 text-sm">
              <div className="flex flex-col gap-0.5 py-2.5 first:pt-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="text-gray-600">Email</dt>
                <dd className="break-all font-medium text-gray-900">{user?.email}</dd>
              </div>
              <div className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="text-gray-600">Review page</dt>
                <dd className="flex min-w-0 items-center gap-1">
                  <span className="break-all font-mono text-xs text-gray-900">{reviewPageUrl}</span>
                  <IconButton
                    aria-label={copied ? 'Review page link copied' : 'Copy review page link'}
                    onClick={() => navigator.clipboard.writeText(reviewPageUrl).then(() => setCopied(true)).catch(() => undefined)}
                  >
                    {copied ? <Check className="h-4 w-4 text-green-700" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                  </IconButton>
                </dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2.5 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <dt className="text-gray-600">Member since</dt>
                <dd className="font-medium text-gray-900">
                  {new Date(business.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </dd>
              </div>
            </dl>
            <span className="sr-only" role="status" aria-live="polite">{copied ? 'Review page link copied' : ''}</span>
          </Card>

          <DataRightsCard businessSlug={business.slug} />
        </div>
      )}
    </div>
  );
}
