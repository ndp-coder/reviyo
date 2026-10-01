import { useEffect, useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { prepareLogo } from '@/lib/image';
import { directReviewUrl, validateGoogleReviewUrl } from '@/lib/url-safety';
import { Alert, Button, Card, Input } from '@/components/ui';

type Draft = { id: string; name: string; referral_id: string; category: string; google_review_url: string | null; logo_url: string | null; topics: string[]; invitation_sent_at: string | null; claimed_at: string | null; commission_referrals: { email: string } };

export function PartnerBusinessSetup() {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [google, setGoogle] = useState('');
  const [logo, setLogo] = useState('');
  const [topics, setTopics] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const { data, error: problem } = await supabase.from('partner_business_drafts').select('id,name,referral_id,category,google_review_url,logo_url,topics,invitation_sent_at,claimed_at,commission_referrals!inner(email)').order('created_at', { ascending: false }).limit(100);
    if (problem) throw new Error('Could not load business setups. Refresh and try again.');
    setDrafts((data ?? []) as unknown as Draft[]);
  }
  useEffect(() => { void load().catch((err: Error) => setError(err.message)); }, []);

  async function invite(id: string) {
    const { data, error: problem } = await supabase.functions.invoke('commission-access', { body: { action: 'invite-owner', id } });
    if (problem) {
      let message = 'Setup saved, but the invitation could not be sent. Try resending.';
      if (problem.context instanceof Response) {
        try { message = (await problem.context.json()).error ?? message; } catch { /* Keep fallback. */ }
      }
      throw new Error(message);
    }
    if (data?.error) throw new Error(data.error);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const urlProblem = validateGoogleReviewUrl(google);
      if (urlProblem) throw new Error(urlProblem);
      const { data: id, error: problem } = await supabase.rpc('save_partner_business_draft', {
        p_email: email, p_name: name, p_category: category,
        p_google_review_url: google.trim() ? directReviewUrl(google) : null,
        p_logo_url: logo || null, p_topics: topics.split('\n').map((t) => t.trim()).filter(Boolean),
      });
      if (problem) throw new Error(problem.message);
      await load();
      setEmail(''); setName(''); setCategory(''); setGoogle(''); setLogo(''); setTopics('');
      await invite(String(id));
      await load(); setNotice('Business details saved and owner invited. Your referral is registered automatically.');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save setup. Try again.'); }
    finally { setBusy(false); }
  }

  return <Card className="mt-6 p-5">
    <h2 className="font-semibold">Set up a business for an owner</h2>
    <p className="mt-2 text-sm text-gray-600">Enter their details here. They receive a private invitation to review the setup, accept the terms and pay from their own account. Use the owner’s own email.</p>
    {error && <Alert variant="error" className="mt-4">{error}</Alert>}
    {notice && <Alert variant="success" className="mt-4">{notice}</Alert>}
    <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
      <Input label="Owner email" type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
      <Input label="Business name" required maxLength={200} value={name} onChange={(e) => setName(e.target.value)} />
      <Input label="Business category" required maxLength={100} placeholder="For example, restaurant or salon" value={category} onChange={(e) => setCategory(e.target.value)} />
      <Input label="Google review link (optional)" type="url" maxLength={2048} value={google} onChange={(e) => setGoogle(e.target.value)} />
      <label className="text-sm font-medium text-gray-700">Business logo (optional)<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} className="mt-2 block w-full text-sm" onChange={(e) => {
        const file = e.target.files?.[0]; e.target.value = '';
        if (file) { setBusy(true); void prepareLogo(file).then((result) => { if ('error' in result) setError(result.error); else setLogo(result.dataUrl); }).catch(() => setError('Could not prepare this logo. Try another image.')).finally(() => setBusy(false)); }
      }} />{logo && <><img src={logo} alt="Business logo preview" className="mt-2 h-16 w-16 rounded object-contain" /><Button type="button" variant="ghost" size="sm" onClick={() => setLogo('')}>Remove logo</Button></>}</label>
      <label className="text-sm font-medium text-gray-700">Review topics (one per line)<textarea required rows={4} value={topics} onChange={(e) => setTopics(e.target.value)} className="mt-2 block w-full rounded-lg border border-gray-300 p-3" placeholder={'Staff\nService\nCleanliness'} /><span className="mt-1 block text-xs text-gray-600">Choose 1–20 topics, up to 80 characters each.</span></label>
      <Button type="submit" loading={busy}>Save details and invite owner</Button>
    </form>
    <h3 className="mt-6 text-sm font-semibold">Recent business setups</h3>
    {!drafts.length && <p className="mt-2 text-sm text-gray-600">No businesses prepared yet.</p>}
    <ul className="mt-2 divide-y divide-gray-200">{drafts.map((d) => <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="text-sm font-medium">{d.name}</p><p className="break-all text-xs text-gray-600">{d.commission_referrals.email}</p><p className="text-xs text-gray-600">{d.claimed_at ? 'Owner completed setup' : d.invitation_sent_at ? 'Invitation sent · waiting for owner' : 'Saved · invitation not delivered'}</p></div>{!d.claimed_at && <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" disabled={busy} onClick={() => {
      setEmail(d.commission_referrals.email); setName(d.name); setCategory(d.category); setGoogle(d.google_review_url ?? ''); setLogo(d.logo_url ?? ''); setTopics(d.topics.join('\n')); setNotice('Details loaded into the form above. Save to update this setup.'); setError(null);
    }}>Edit details</Button><Button size="sm" variant="outline" disabled={busy} onClick={() => {
      setBusy(true); setError(null); setNotice(null);
      void invite(d.id).then(load).then(() => setNotice('Owner invitation sent.')).catch((err: Error) => setError(err.message)).finally(() => setBusy(false));
    }}>Resend owner invitation</Button></div>}</li>)}</ul>
  </Card>;
}
