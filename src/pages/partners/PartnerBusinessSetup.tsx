import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { prepareLogo } from '@/lib/image';
import { directReviewUrl } from '@/lib/url-safety';
import { readFunctionError } from '@/lib/function-errors';
import { parsePartnerTopics, validatePartnerDetails } from '@/lib/partner-setup';
import { businessCategories, getCategoryLabel, getSuggestedTopics, isPresetCategory, OTHER_CATEGORY } from '@/config/categories';
import { formatRupees, PLANS, PLAN_ORDER, PLAN_SUMMARY } from '@/config/plans';
import { DELIVERY_FIELDS, EMPTY_DELIVERY_ADDRESS, validateDelivery } from '@/lib/qr-stand';
import type { SubscriptionPlan } from '@/lib/types';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { AdminQrDelivery } from '@/pages/admin/AdminQrDelivery';
import { GoogleReviewLinkHelp } from '@/components/GoogleReviewLinkHelp';
import { StandOfferNotice } from '@/components/StandOfferNotice';
import { PaymentSetupQr } from '@/components/PaymentSetupQr';
import { Alert, Badge, Button, Card, Input, Select, Skeleton, Textarea } from '@/components/ui';

type Draft = { id: string; name: string; category: string; google_review_url: string | null; logo_url: string | null; topics: string[]; invitation_sent_at?: string | null; claimed_at: string | null; email: string; admin_qr_deliveries?: { payment_method: 'cash' | 'razorpay' } | null };
type PartnerDraft = Omit<Draft, 'email'> & { commission_referrals: { email: string } };
const draftFields = 'id,name,category,google_review_url,logo_url,topics,claimed_at';

export function PartnerBusinessSetup({ admin = false, refresh = 0 }: { admin?: boolean; refresh?: number } = {}) {
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
  const [paymentRequest, setPaymentRequest] = useState<(Pick<Draft, 'id' | 'name' | 'email'> & { cash?: boolean }) | null>(null);
  const [deliveryRequest, setDeliveryRequest] = useState<Pick<Draft, 'id' | 'name'> | null>(null);
  const [address, setAddress] = useState(EMPTY_DELIVERY_ADDRESS);
  const [deliveryConsent, setDeliveryConsent] = useState(false);
  const [method, setMethod] = useState<'cash' | 'razorpay'>('razorpay');
  const [cashPlan, setCashPlan] = useState<SubscriptionPlan | ''>('');
  const [cashReceived, setCashReceived] = useState(false);
  const busyRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);
  const effectiveCategory = category === OTHER_CATEGORY ? customCategory.trim() : category;
  const parsedTopics = parsePartnerTopics(topics);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = admin
        ? supabase.from('admin_business_setups').select(`${draftFields},email,admin_qr_deliveries(payment_method)`)
        : supabase.from('partner_business_drafts').select(`${draftFields},invitation_sent_at,commission_referrals!inner(email)`);
      const { data, error: problem } = await query.order('created_at', { ascending: false }).limit(100);
      if (problem) throw problem;
      setDrafts(admin ? (data ?? []) as unknown as Draft[] : ((data ?? []) as unknown as PartnerDraft[])
        .map((draft) => ({ ...draft, email: draft.commission_referrals.email })));
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
      throw new Error('Could not load business setups. Refresh and try again.');
    } finally { setLoading(false); }
  }, [admin]);
  useEffect(() => { void load().catch((err: Error) => setError(err.message)); }, [load, refresh]);

  async function invite(id: string) {
    const { data, error: problem } = await supabase.functions.invoke('commission-access', { body: { action: 'invite-owner', id } });
    if (problem) throw new Error(await readFunctionError(problem, 'Setup saved, but the invitation could not be sent. Try resending below.'));
    if (data?.error) throw new Error(data.error);
  }

  function resetForm() {
    setEditing(null); setEmail(''); setName(''); setCategory(''); setCustomCategory(''); setGoogle(''); setLogo(''); setTopics('');
    setAddress(EMPTY_DELIVERY_ADDRESS); setDeliveryConsent(false); setMethod('razorpay'); setCashPlan(''); setCashReceived(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    const send = !admin && (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') !== 'save';
    busyRef.current = true;
    setBusy(true); setError(null); setNotice(null);
    let saved = false;
    try {
      const detailsProblem = validatePartnerDetails(name, effectiveCategory, google, parsedTopics);
      if (detailsProblem) throw new Error(detailsProblem);
      const ownerEmail = email.trim().toLowerCase();
      if (admin) {
        const addressProblem = validateDelivery(address);
        if (addressProblem) throw new Error(addressProblem);
        if (!deliveryConsent) throw new Error('Confirm the owner agreed to use the delivery address.');
        if (method === 'cash' && (!cashPlan || !cashReceived)) throw new Error('Choose a plan and confirm cash was collected.');
      }
      const { data: id, error: problem } = await supabase.rpc(admin ? 'save_admin_delivery_setup' : 'save_partner_business_draft', {
        p_email: ownerEmail, p_name: name.trim(), p_category: effectiveCategory,
        p_google_review_url: google.trim() ? directReviewUrl(google) : null,
        p_logo_url: logo || null, p_topics: parsedTopics,
        ...(admin ? { p_method: method, p_cash_plan: method === 'cash' ? cashPlan : null,
          p_cash_received: method === 'cash' && cashReceived, p_delivery_consent: deliveryConsent,
          p_address: { ...Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])), country: 'IN' } } : {}),
      });
      if (problem || !id) throw new Error(problem?.message ?? 'Could not save this setup. Try again.');
      saved = true;
      if (admin) {
        setDeliveryRequest(null);
        setPaymentRequest({ id: String(id), name: name.trim(), email: ownerEmail, cash: method === 'cash' });
        resetForm();
      } else if (send) {
        setEditing(String(id));
        await invite(String(id));
        setNotice(`Details saved and invitation sent to ${email.trim().toLowerCase()}. The owner checks the setup, accepts the terms and pays. Your referral is registered automatically.`);
        resetForm();
      } else {
        setEditing(String(id));
        setNotice('Details saved. No email sent. You can edit this setup or send its invitation when it is ready.');
      }
    } catch (err) { setError(`${saved ? 'Your business details are saved. ' : ''}${err instanceof Error ? err.message : 'Could not save setup. Try again.'}`); }
    finally { await load().catch(() => {}); setBusy(false); busyRef.current = false; }
  }

  const visibleDrafts = drafts.filter((draft) => `${draft.name} ${draft.email}`.toLowerCase().includes(search.trim().toLowerCase()));

  return <Card className="mt-6 p-5">
    <h2 className="font-semibold">Set up a business for an owner</h2>
    <p className="mt-2 text-sm text-gray-600">{admin ? 'Record cash collected in person or share a Razorpay payment QR. The plan begins on the date the owner receives the printed review QR stand.' : 'Prepare the review page here and invite the owner using their own email. New owners create their password first, then check the details, accept the terms, pay for a plan and download their QR code.'}</p>
    <p className="mt-2 text-sm font-medium text-gray-800">Paid plans only: {PLAN_SUMMARY}.</p>
    {!admin && <StandOfferNotice partner />}
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
      {admin && <>
        <fieldset disabled={busy} className="space-y-3 border-t border-gray-200 pt-4">
          <legend className="font-semibold">Collect payment</legend>
          <Select label="Payment method" value={method} onChange={event => { setMethod(event.target.value === 'cash' ? 'cash' : 'razorpay'); setCashReceived(false); }}>
            <option value="razorpay">Razorpay payment QR</option><option value="cash">Cash collected in person</option>
          </Select>
          {method === 'cash' && <>
            <Select label="Cash plan" required value={cashPlan} onChange={event => { setCashPlan(event.target.value as SubscriptionPlan); setCashReceived(false); }}>
              <option value="">Choose a plan</option>{PLAN_ORDER.map(plan => <option key={plan} value={plan}>{PLANS[plan].label} · {formatRupees(PLANS[plan].price)}</option>)}
            </Select>
            <ConsentCheckbox checked={cashReceived} onChange={setCashReceived}>I received the full plan amount in cash.</ConsentCheckbox>
          </>}
        </fieldset>
        <fieldset disabled={busy} className="space-y-3 border-t border-gray-200 pt-4">
          <legend className="font-semibold">Deliver the printed review QR stand</legend>
          <div className="grid gap-3 sm:grid-cols-2">{DELIVERY_FIELDS.map(field => <Input key={field.key} label={field.label}
            required={field.key !== 'line2'} maxLength={field.max} autoComplete={field.autoComplete}
            inputMode={field.key === 'phone' || field.key === 'pincode' ? 'numeric' : 'text'} value={address[field.key]}
            onChange={event => { setAddress(current => ({ ...current, [field.key]: event.target.value })); setDeliveryConsent(false); }} />)}</div>
          <ConsentCheckbox checked={deliveryConsent} onChange={setDeliveryConsent}>The owner agreed that Reviyo and its courier may use these details to deliver their stand.</ConsentCheckbox>
        </fieldset>
      </>}
      <section aria-label="Setup summary" className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold">{admin ? 'Check before sharing' : 'Check before inviting'}</h3>
        <p className="mt-2 break-words text-sm">{name.trim() || 'Business name'} · {effectiveCategory ? getCategoryLabel(effectiveCategory) : 'Choose a category'}</p>
        <p className="mt-1 break-all text-sm text-gray-600">{admin ? 'Owner signs in as' : 'Invitation goes to'}: {email.trim() || 'Enter the owner’s email'}</p>
        <p className="mt-1 text-xs text-gray-600">{parsedTopics.length} review topics · {google.trim() ? 'Google link entered — test it above' : 'Google link still needs to be added'}</p>
        <p className="mt-2 text-xs text-gray-600">{admin && method === 'cash' ? 'The owner signs in to confirm the setup and delivery address.' : 'The owner chooses a plan and pays through Razorpay.'} Customers review their own experience and post to Google themselves.</p>
      </section>
      <div className="flex flex-wrap gap-3">
        {admin ? <Button type="submit" loading={busy}>{method === 'cash' ? 'Record cash and show owner setup QR' : 'Save and show payment QR code'}</Button> : <>
          <Button type="submit" name="action" value="invite" loading={busy}>Save and invite owner</Button>
          <Button type="submit" name="action" value="save" variant="outline" disabled={busy}>Save without sending</Button>
        </>}
        {editing && <Button variant="ghost" disabled={busy} onClick={() => { resetForm(); setError(null); setNotice(null); }}>Start a new setup</Button>}
      </div>
    </form>
    {paymentRequest && <PaymentSetupQr key={paymentRequest.id} {...paymentRequest} />}
    {deliveryRequest && <AdminQrDelivery key={deliveryRequest.id} {...deliveryRequest} />}
    <h3 className="mt-6 text-sm font-semibold">Recent business setups</h3>
    <p className="mt-1 text-xs text-gray-600">Your latest 100 setups. Owners keep control of their accounts and payments.</p>
    <div className="mt-3"><Input label="Find a setup" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Business name or owner email" /></div>
    {loading ? <Skeleton className="mt-4 h-16" /> : loadFailed ? <Alert variant="error" className="mt-4" action={<Button variant="outline" size="sm" onClick={() => void load().catch(() => {})}>Try again</Button>}>Could not load saved setups. Your form details are safe.</Alert> : !visibleDrafts.length && <p className="mt-3 text-sm text-gray-600">{search.trim() ? 'No matching business setups.' : 'No businesses prepared yet.'}</p>}
    {!loading && !loadFailed && <ul className="mt-2 divide-y divide-gray-200">{visibleDrafts.map((d) => (
      <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="break-words text-sm font-medium">{d.name}</p>
          <p className="break-all text-xs text-gray-600">{d.email}</p>
          <div className="mt-2"><Badge variant={d.claimed_at ? 'success' : d.invitation_sent_at ? 'info' : 'warning'}>
            {d.claimed_at ? 'Owner took over setup' : admin ? 'Waiting for owner' : d.invitation_sent_at ? 'Invited · waiting for owner' : 'Saved · invitation not sent'}
          </Badge></div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!d.claimed_at && !d.admin_qr_deliveries && <Button size="sm" variant="ghost" disabled={busy} onClick={() => {
            setPaymentRequest(null);
            setEditing(d.id); setEmail(d.email); setName(d.name); setCategory(isPresetCategory(d.category) ? d.category : OTHER_CATEGORY); setCustomCategory(isPresetCategory(d.category) ? '' : d.category); setGoogle(d.google_review_url ?? ''); setLogo(d.logo_url ?? ''); setTopics(d.topics.join('\n')); setNotice('Details loaded into the form above. Save to update this setup.'); setError(null);
            formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); formRef.current?.querySelector<HTMLInputElement>('input[name="business-name"]')?.focus({ preventScroll: true });
          }}>Edit details</Button>}
          {admin && <Button size="sm" variant="outline" disabled={busy} onClick={() => {
            setDeliveryRequest(null); setPaymentRequest({ id: d.id, name: d.name, email: d.email, cash: d.admin_qr_deliveries?.payment_method === 'cash' });
          }}>{d.admin_qr_deliveries?.payment_method === 'cash' ? 'Show owner setup QR' : 'Show payment QR code'}</Button>}
          {admin && d.admin_qr_deliveries && <Button size="sm" variant="outline" onClick={() => {
            setPaymentRequest(null); setDeliveryRequest({ id: d.id, name: d.name });
          }}>Manage QR delivery</Button>}
          {!admin && !d.claimed_at && <Button size="sm" variant="outline" disabled={busy} onClick={() => {
            if (busyRef.current) return;
            busyRef.current = true; setBusy(true); setError(null); setNotice(null);
            void invite(d.id).then(() => setNotice(`Owner invitation sent to ${d.email}.`)).catch((err: Error) => setError(err.message)).finally(() => { void load().catch(() => {}); setBusy(false); busyRef.current = false; });
          }}>{d.invitation_sent_at ? 'Resend invitation' : 'Send invitation'}</Button>}
        </div>
      </li>
    ))}</ul>}
  </Card>;
}
