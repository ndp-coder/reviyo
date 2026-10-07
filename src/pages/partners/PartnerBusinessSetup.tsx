import { useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { prepareLogo } from '@/lib/image';
import { directReviewUrl } from '@/lib/url-safety';
import { readFunctionError } from '@/lib/function-errors';
import { parsePartnerTopics, validatePartnerDetails } from '@/lib/partner-setup';
import { businessCategories, getCategoryLabel, getSuggestedTopics, isPresetCategory, OTHER_CATEGORY } from '@/config/categories';
import { PLAN_SUMMARY } from '@/config/plans';
import { GoogleReviewLinkHelp } from '@/components/GoogleReviewLinkHelp';
import { Alert, Badge, Button, Card, Input, Select, Skeleton, Textarea } from '@/components/ui';

type Draft = { id: string; name: string; referral_id: string; category: string; google_review_url: string | null; logo_url: string | null; topics: string[]; invitation_sent_at: string | null; claimed_at: string | null; commission_referrals: { email: string } };

export function PartnerBusinessSetup() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [google, setGoogle] = useState('');
  const [logo, setLogo] = useState('');
  const [topics, setTopics] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const busyRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const effectiveCategory = category === OTHER_CATEGORY ? customCategory.trim() : category;
  const parsedTopics = parsePartnerTopics(topics);

  async function load() {
    setLoading(true);
    const { data, error: problem } = await supabase.from('partner_business_drafts').select('id,name,referral_id,category,google_review_url,logo_url,topics,invitation_sent_at,claimed_at,commission_referrals!inner(email)').order('created_at', { ascending: false }).limit(100);
    setLoading(false); setLoadFailed(Boolean(problem));
    if (problem) throw new Error('Could not load business setups. Refresh and try again.');
    setDrafts((data ?? []) as unknown as Draft[]);
  }
  useEffect(() => { void load().catch((err: Error) => setError(err.message)); }, []);

  async function invite(id: string) {
    const { data, error: problem } = await supabase.functions.invoke('commission-access', { body: { action: 'invite-owner', id } });
    if (problem) throw new Error(await readFunctionError(problem, 'Setup saved, but the invitation could not be sent. Try resending below.'));
    if (data?.error) throw new Error(data.error);
  }

  function resetForm() {
    setEditing(null); setEmail(''); setName(''); setCategory(''); setCustomCategory(''); setGoogle(''); setLogo(''); setTopics('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const send = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'save';
    busyRef.current = true;
    setBusy(true); setError(null); setNotice(null);
    let saved = false;
    try {
      const detailsProblem = validatePartnerDetails(name, effectiveCategory, google, parsedTopics);
      if (detailsProblem) throw new Error(detailsProblem);
      const { data: id, error: problem } = await supabase.rpc('save_partner_business_draft', {
        p_email: email.trim().toLowerCase(), p_name: name.trim(), p_category: effectiveCategory,
        p_google_review_url: google.trim() ? directReviewUrl(google) : null,
        p_logo_url: logo || null, p_topics: parsedTopics,
      });
      if (problem || !id) throw new Error(problem?.message ?? 'Could not save this setup. Try again.');
      saved = true; setEditing(String(id));
      if (send) {
        await invite(String(id));
        setNotice(`Details saved and invitation sent to ${email.trim().toLowerCase()}. The owner checks the setup, accepts the terms and pays. Your referral is registered automatically.`);
        resetForm();
      } else setNotice('Details saved. No email sent. You can edit this setup or send its invitation when it is ready.');
    } catch (err) { setError(`${saved ? 'Your business details are saved. ' : ''}${err instanceof Error ? err.message : 'Could not save setup. Try again.'}`); }
    finally { await load().catch(() => {}); setBusy(false); busyRef.current = false; }
  }

  const visibleDrafts = drafts.filter((draft) => `${draft.name} ${draft.commission_referrals.email}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <Card className="mt-6 p-5">
    <h2 className="font-semibold">Set up a business for an owner</h2>
    <p className="mt-2 text-sm text-gray-600">Prepare the review page here and invite the owner using their own email. New owners create their password first, then check the details, accept the terms, pay for a plan and download their QR code.</p>
    <p className="mt-2 text-sm font-medium text-gray-800">Paid plans only: {PLAN_SUMMARY}. Partner setups do not include a free trial.</p>
    {error && <Alert variant="error" className="mt-4">{error}</Alert>}
    {notice && <Alert variant="success" className="mt-4">{notice}</Alert>}
    <form ref={formRef} className="mt-6 space-y-5" onSubmit={(event) => void submit(event)}>
      <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
      <legend className="mb-3 font-semibold">Owner and business</legend>
      <Input label="Owner email" type="email" autoComplete="email" required maxLength={254} readOnly={Boolean(editing)} value={email} onChange={(e) => setEmail(e.target.value)} hint={editing ? 'The email stays fixed for this saved setup. Start a new setup for a different owner.' : 'Check this carefully. The owner signs in and pays using this email.'} />
      <Input name="business-name" label="Business name" autoComplete="organization" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      <Select label="Business category" required value={category} onChange={(e) => { setCategory(e.target.value); if (!topics.trim()) setTopics(getSuggestedTopics(e.target.value).join('\n')); }}><option value="">Choose a category</option>{businessCategories.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
      {category === OTHER_CATEGORY && <Input label="Describe the business" required maxLength={100} value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="For example, real estate agency" />}
      </fieldset>
      <fieldset disabled={busy} className="space-y-4 border-t border-gray-200 pt-4">
      <legend className="font-semibold">Prepare the review page</legend>
      <Input label="Google review link (optional)" type="url" maxLength={2048} value={google} onChange={(e) => setGoogle(e.target.value)} hint="Connect the owner’s Google Business Profile before asking customers to post on Google. You can save the setup without it." />
      <GoogleReviewLinkHelp businessName={name} currentUrl={google} onUseLink={setGoogle} />
      <label className="text-sm font-medium text-gray-700">Business logo (optional)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="mt-2 block w-full text-sm" onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (file && !busyRef.current) { busyRef.current = true; setBusy(true); setError(null); void prepareLogo(file).then((result) => { if ('error' in result) setError(result.error); else setLogo(result.dataUrl); }).catch(() => setError('Could not prepare this logo. Try another image.')).finally(() => { setBusy(false); busyRef.current = false; }); }
      }} />{logo && <><img src={logo} alt="Business logo preview" className="mt-2 h-16 w-16 rounded object-contain" /><Button type="button" variant="ghost" size="sm" onClick={() => setLogo('')}>Remove logo</Button></>}</label>
      <Textarea label="Review topics (one per line)" required rows={5} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder={'Staff\nService\nCleanliness'} hint={`${parsedTopics.length} of 20 topics. Up to 80 characters each. Empty lines and duplicates are removed when saving.`} />
      <Button variant="outline" size="sm" disabled={!category} onClick={() => setTopics(parsePartnerTopics(`${topics}\n${getSuggestedTopics(category).join('\n')}`).slice(0,20).join('\n'))}>Add suggested topics</Button>
      </fieldset>
      <section aria-label="Setup summary" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold">Check before inviting</h3>
        <p className="mt-2 break-words text-sm">{name.trim() || 'Business name'} · {effectiveCategory ? getCategoryLabel(effectiveCategory) : 'Choose a category'}</p>
        <p className="mt-1 break-all text-sm text-gray-600">Invitation goes to: {email.trim() || 'Enter the owner’s email'}</p>
        <p className="mt-1 text-xs text-gray-600">{parsedTopics.length} review topics · {google.trim() ? 'Google link entered — test it above' : 'Google link still needs to be added'}</p>
        <p className="mt-2 text-xs text-gray-600">The owner chooses a plan and pays through Razorpay. Customers review their own experience and post to Google themselves.</p>
      </section>
      <div className="flex flex-wrap gap-3">
        <Button type="submit" name="action" value="invite" loading={busy}>Save and invite owner</Button>
        <Button type="submit" name="action" value="save" variant="outline" disabled={busy}>Save without sending</Button>
        {editing && <Button variant="ghost" disabled={busy} onClick={() => { resetForm(); setError(null); setNotice(null); }}>Start a new setup</Button>}
      </div>
    </form>
    <h3 className="mt-6 text-sm font-semibold">Recent business setups</h3>
    <p className="mt-1 text-xs text-gray-600">Your latest 100 setups. Owners keep control of their accounts and payments.</p>
    <div className="mt-3"><Input label="Find a setup" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Business name or owner email" /></div>
    {loading ? <Skeleton className="mt-4 h-16" /> : loadFailed ? <Alert variant="error" className="mt-4" action={<Button variant="outline" size="sm" onClick={() => void load().catch(() => {})}>Try again</Button>}>Could not load saved setups. Your form details are safe.</Alert> : !visibleDrafts.length && <p className="mt-3 text-sm text-gray-600">{search.trim() ? 'No matching business setups.' : 'No businesses prepared yet.'}</p>}
    {!loading && !loadFailed && <ul className="mt-2 divide-y divide-gray-200">{visibleDrafts.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="break-words text-sm font-medium">{d.name}</p><p className="break-all text-xs text-gray-600">{d.commission_referrals.email}</p><div className="mt-2"><Badge variant={d.claimed_at ? 'success' : d.invitation_sent_at ? 'info' : 'warning'}>{d.claimed_at ? 'Owner took over setup' : d.invitation_sent_at ? 'Invited · waiting for owner' : 'Saved · invitation not sent'}</Badge></div></div>{!d.claimed_at && <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={busy} onClick={() => {
      setEditing(d.id); setEmail(d.commission_referrals.email); setName(d.name); setCategory(isPresetCategory(d.category) ? d.category : OTHER_CATEGORY); setCustomCategory(isPresetCategory(d.category) ? '' : d.category); setGoogle(d.google_review_url ?? ''); setLogo(d.logo_url ?? ''); setTopics(d.topics.join('\n')); setNotice('Details loaded into the form above. Save to update this setup.'); setError(null);
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); formRef.current?.querySelector<HTMLInputElement>('input[name="business-name"]')?.focus({ preventScroll: true });
    }}>Edit details</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => {
      if (busyRef.current) return;
      busyRef.current = true; setBusy(true); setError(null); setNotice(null);
      void invite(d.id).then(() => setNotice(`Owner invitation sent to ${d.commission_referrals.email}.`)).catch((err: Error) => setError(err.message)).finally(() => { void load().catch(() => {}); setBusy(false); busyRef.current = false; });
    }}>{d.invitation_sent_at ? 'Resend invitation' : 'Send invitation'}</Button></div>}</li>)}</ul>}
  </Card>;
}
