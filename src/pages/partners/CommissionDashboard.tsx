import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { fetchAllRows } from '@/lib/fetch-all-rows';
import { Alert, Button, Card, Input, PageHeader, Spinner } from '@/components/ui';
import { BrandLogo } from '@/components/BrandLogo';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { formatRupees, PLANS } from '@/config/plans';
import { PartnerBusinessSetup } from '@/pages/partners/PartnerBusinessSetup';

type Partner = { id: string; name: string; email: string; active: boolean; invitation_sent_at: string | null; bank_last4: string | null; fund_account_id: string | null };
type Referral = { id: string; partner_id: string; email: string; paid_at: string | null; capture_verified_at: string | null; qualified_at: string | null; created_at: string };
type Earning = { id: string; partner_id: string; kind: string; milestone: number | null; amount: number; status: string; detail: string | null; payout_id: string | null; created_at: string };

async function action(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke('commission-access', { body });
  if (error) {
    let message = 'The request failed. Please try again.';
    if (error.context instanceof Response) {
      try { message = (await error.context.json()).error ?? message; } catch { /* Keep the readable fallback. */ }
    }
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
}

function date(value: string) { return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); }
function statusText(status: string) {
  return ({ pending: 'Ready to pay', sending: 'Submitting transfer', queued: 'Queued by RazorpayX', processing: 'Transfer in progress', processed: 'Paid', failed: 'Transfer failed', reversed: 'Transfer reversed', cancelled: 'Cancelled', needs_attention: 'Developer review required' } as Record<string, string>)[status] ?? status;
}

export function CommissionDashboard({ developer = false }: { developer?: boolean }) {
  const { user, profile, loading: authLoading, signOut, sendSignInCode, verifySignInCode } = useAuth();
  const [partners, setPartners] = useState<Partner[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [account, setAccount] = useState('');
  const [confirmAccount, setConfirmAccount] = useState('');
  const [ifsc, setIfsc] = useState('');
  const [signInEmail, setSignInEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [bankConsented, setBankConsented] = useState(false);
  const [setup, setSetup] = useState<{ emailReady: boolean; payoutsReady: boolean; enabled: boolean; schedulerReady: boolean } | null>(null);

  const load = useCallback(async () => {
    if (!user || (developer && profile?.role !== 'admin')) { setLoading(false); return; }
    try {
      const [p, r, e] = await Promise.all([
        fetchAllRows<Partner>((from, to) => supabase.from('commission_partners').select('id,name,email,active,invitation_sent_at,bank_last4,fund_account_id').order('id').range(from, to)),
        fetchAllRows<Referral>((from, to) => supabase.from('commission_referrals').select('id,partner_id,email,paid_at,capture_verified_at,qualified_at,created_at').order('id').range(from, to)),
        fetchAllRows<Earning>((from, to) => supabase.from('commission_earnings').select('id,partner_id,kind,milestone,amount,status,detail,payout_id,created_at').order('created_at', { ascending: false }).order('id').range(from, to)),
      ]);
      setPartners(p); setReferrals(r); setEarnings(e); setError(null);
      if (developer) {
        const { data: config, error: configError } = await supabase.functions.invoke('commission-access', { body: { action: 'setup' } });
        if (!configError) setSetup(config);
      }
    } catch { setError('Could not load commissions. Try refreshing, or ask the developer to check setup.'); }
    finally { setLoading(false); }
  }, [user, profile?.role, developer]);

  useEffect(() => { if (!authLoading) void load(); }, [authLoading, load]);

  async function perform(task: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true); setError(null); setNotice(null);
    try { await task(); setNotice(success); await load(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Something went wrong. Try again.'); }
    finally { setBusy(false); }
  }

  function submitReferral(event: FormEvent) {
    event.preventDefault();
    void perform(async () => {
      const { error: referralError } = await supabase.rpc('register_commission_referral', { p_email: email });
      if (referralError) throw new Error(referralError.message);
      setEmail('');
    }, 'Referral registered. We’ll track their first payment automatically.');
  }

  const myPartner = partners.find((p) => p.email === user?.email?.toLowerCase() && p.active);
  const qualified = referrals.filter((r) => r.qualified_at).length;
  const paid = earnings.filter((e) => e.status === 'processed').reduce((sum, e) => sum + e.amount, 0);
  const pending = earnings.filter((e) => ['pending', 'sending', 'queued', 'processing'].includes(e.status)).reduce((sum, e) => sum + e.amount, 0);

  if (authLoading || loading) return <div className="flex justify-center p-8"><Spinner /><span className="sr-only">Loading commissions</span></div>;
  if (!user) return (
    <main id="main-content" className="mx-auto max-w-md px-4 py-12">
      <BrandLogo className="h-10 w-auto" />
      <PageHeader title="Partner sign in" description="Access is available by developer invitation." />
      {error && <Alert variant="error" className="mt-4">{error}</Alert>}
      {notice && <Alert variant="success" className="mt-4">{notice}</Alert>}
      <form className="mt-6 space-y-4" onSubmit={(event) => {
        event.preventDefault();
        void perform(async () => {
          const result = sentTo ? await verifySignInCode(sentTo, code.trim()) : await sendSignInCode(signInEmail.trim());
          if (result.error) throw new Error(result.error);
          if (!sentTo) setSentTo(signInEmail.trim());
        }, sentTo ? 'Signed in.' : 'Check your email for a sign-in code.');
      }}>
        <Input label="Invited email" type="email" required value={signInEmail} onChange={(e) => setSignInEmail(e.target.value)} disabled={!!sentTo} autoComplete="email" />
        {sentTo && <Input label="Sign-in code" required value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" inputMode="numeric" />}
        <Button type="submit" loading={busy}>{sentTo ? 'Sign in' : 'Send sign-in code'}</Button>
        {sentTo && <Button type="button" variant="ghost" onClick={() => { setSentTo(null); setCode(''); }}>Use another email</Button>}
      </form>
    </main>
  );
  if (developer && profile?.role !== 'admin') return <Alert variant="error">Developer access required.</Alert>;

  const content = (
    <>
      {developer ? <div><h2 className="text-lg font-semibold">Partner commissions</h2><p className="mt-1 text-sm text-gray-600">Private referral programme. Earnings and bank transfers are tracked automatically.</p></div> : <PageHeader title="Your commissions" description="Private referral programme. Earnings and bank transfers are tracked automatically." />}
      {error && <Alert variant="error" className="mt-4">{error}</Alert>}
      {notice && <Alert variant="success" className="mt-4">{notice}</Alert>}
      {developer && setup && (!setup.emailReady || !setup.payoutsReady || !setup.enabled || !setup.schedulerReady) && <Alert variant="warning" className="mt-4">
        Commission setup is incomplete. {!setup.emailReady && 'Invitation email is not configured. '}{!setup.payoutsReady && 'RazorpayX payout credentials or source account are missing. '}{!setup.schedulerReady && 'The automatic scheduler is not configured. '}{!setup.enabled && 'Automatic payouts are switched off.'}
      </Alert>}
      {!developer && !myPartner ? (
        <Card className="mt-6 p-6"><h2 className="font-semibold">Invitation required</h2><p className="mt-2 text-sm text-gray-600">Ask the developer to invite this email. If your access was revoked, contact them to restore it.</p></Card>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[['Qualifying owners', String(qualified)], ['Waiting for transfer', formatRupees(pending / 100)], ['Paid to bank', formatRupees(paid / 100)]].map(([label, value]) => <Card key={label} className="p-5"><p className="text-sm text-gray-600">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p></Card>)}
          </div>
          <Card className="mt-6 p-5">
            <h2 className="font-semibold">How earnings work</h2>
            <p className="mt-2 text-sm text-gray-600">Register the owner’s signup email before their first payment. One {formatRupees(PLANS['12_months'].price)} annual payment per referred owner qualifies after 14 days without a refund or dispute. You earn ₹1,000 for each qualifying owner and ₹2,000 extra at 10, 20, 30 and every further 10. Monthly plan payments earn zero commission and do not count towards bonuses. Renewals and ₹1 trial setup payments don’t earn commission.</p>
            <p className="mt-2 text-sm text-gray-600">Transfers are submitted automatically once bank details are saved. Bank processing and available RazorpayX balance can affect arrival time.</p>
            {!developer && <p className="mt-3 text-sm font-medium text-brand-700">{10 - qualified % 10} more qualifying owners until your next ₹2,000 bonus.</p>}
          </Card>
          <Card className="mt-6 p-5">
            <h2 className="font-semibold">{developer ? 'Invite a partner' : 'Add a referral'}</h2>
            <form className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={developer ? (event) => {
              event.preventDefault(); void perform(async () => { await action({ action: 'invite', email, name }); setEmail(''); setName(''); }, 'Invitation sent.');
            } : submitReferral}>
              {developer && <Input label="Partner name" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />}
              <Input label={developer ? 'Partner email' : 'Referred owner’s email'} type="email" required maxLength={254} value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" loading={busy} className="shrink-0">{developer ? 'Send invitation' : 'Register referral'}</Button>
            </form>
          </Card>
          {!developer && <PartnerBusinessSetup />}
          {!developer && <Card className="mt-6 p-5">
            <h2 className="font-semibold">Payout bank account</h2>
            {myPartner?.fund_account_id ? <p className="mt-3 text-sm text-gray-600">Bank account ending {myPartner.bank_last4} is registered for automatic transfers. Contact the developer if it needs changing.</p> : <form className="mt-4 grid gap-4 sm:grid-cols-2" onSubmit={(event) => {
              event.preventDefault();
              void perform(async () => {
                if (account !== confirmAccount) throw new Error('The account numbers do not match.');
                await action({ action: 'bank', name: accountName, account, ifsc, consent: bankConsented });
                setAccount(''); setConfirmAccount(''); setIfsc(''); setAccountName('');
              }, 'Bank account registered for automatic payouts.');
            }}>
              <Input label="Account holder name" required minLength={2} maxLength={100} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              <Input label="IFSC" required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" value={ifsc} onChange={(e) => setIfsc(e.target.value)} autoComplete="off" />
              <Input label="Account number" required inputMode="numeric" pattern="[0-9]{9,18}" value={account} onChange={(e) => setAccount(e.target.value)} autoComplete="off" />
              <Input label="Confirm account number" required inputMode="numeric" value={confirmAccount} onChange={(e) => setConfirmAccount(e.target.value)} autoComplete="off" />
              <p className="text-xs text-gray-600 sm:col-span-2">Check these details carefully. RazorpayX stores the bank details; Reviyo keeps only its payout reference and the last four digits.</p>
              <div className="sm:col-span-2"><ConsentCheckbox checked={bankConsented} onChange={setBankConsented}>I authorise Reviyo to send these bank details to RazorpayX for my commission payouts.</ConsentCheckbox></div>
              <Button type="submit" loading={busy} disabled={!bankConsented}>Save payout account</Button>
            </form>}
          </Card>}
          {developer && <Card className="mt-6 p-5">
            <h2 className="font-semibold">Invited partners</h2>
            {!partners.length && <p className="mt-3 text-sm text-gray-600">No partners invited yet.</p>}
            <ul className="mt-4 divide-y divide-gray-200">{partners.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div><p className="text-sm font-medium">{p.name}</p><p className="break-all text-xs text-gray-600">{p.email}</p><p className="text-xs text-gray-600">{p.active ? 'Access active' : 'Access revoked'} · {p.bank_last4 ? `Bank ending ${p.bank_last4}` : 'Bank not registered'} · {p.invitation_sent_at ? 'Invitation sent' : 'Invitation not delivered'}</p></div>
              <div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy || !p.active} onClick={() => void perform(() => action({ action: 'invite', email: p.email, name: p.name }), 'Invitation resent.')}>Resend invitation</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => void perform(() => action({ action: 'access', id: p.id, active: !p.active }), p.active ? 'Access revoked. New transfers are paused.' : 'Access restored.')}>{p.active ? 'Revoke access' : 'Restore access'}</Button></div>
            </li>)}</ul>
          </Card>}
          <Card className="mt-6 p-5">
            <h2 className="font-semibold">Referrals</h2>
            {!referrals.length && <p className="mt-3 text-sm text-gray-600">No referrals yet.</p>}
            <ul className="mt-3 divide-y divide-gray-200">{referrals.map((r) => <li key={r.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><div><p className="break-all font-medium">{r.email}</p>{developer && <p className="text-xs text-gray-600">Partner: {partners.find((p) => p.id === r.partner_id)?.email}</p>}</div><p className="text-gray-600">{r.qualified_at ? `Qualified ${date(r.qualified_at)}` : r.capture_verified_at ? `Payment captured · eligible from ${date(new Date(Date.parse(r.capture_verified_at ?? r.paid_at) + 14 * 86400000).toISOString())}, subject to payment checks` : r.paid_at ? 'Checking payment capture' : 'Waiting for first annual payment'}</p></li>)}</ul>
          </Card>
          <Card className="mt-6 p-5">
            <h2 className="font-semibold">Earnings and transfers</h2>
            {!earnings.length && <p className="mt-3 text-sm text-gray-600">Commissions appear after the 14-day payment check.</p>}
            <ul className="mt-3 divide-y divide-gray-200">{earnings.map((e) => <li key={e.id} className="flex flex-wrap justify-between gap-3 py-3 text-sm"><div><p className="font-medium">{e.kind === 'bonus' ? `${e.milestone}-referral bonus` : 'Referral commission'} · {formatRupees(e.amount / 100)}</p>{developer && <p className="text-xs text-gray-600">{partners.find((p) => p.id === e.partner_id)?.email}</p>}<p className="text-xs text-gray-600">{date(e.created_at)}{e.payout_id ? ` · ${e.payout_id}` : ''}</p>{e.detail && <p className="mt-1 text-xs text-amber-800">{e.detail}</p>}</div><p className="text-gray-600">{statusText(e.status)}</p></li>)}</ul>
          </Card>
        </>
      )}
      <Button className="mt-6" variant="outline" disabled={busy} onClick={() => void load()}>Refresh commissions</Button>
    </>
  );
  if (developer) return <section className="mt-8 border-t border-gray-200 pt-8">{content}</section>;
  return <div className="min-h-screen bg-gray-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4"><BrandLogo className="h-9 w-auto" /><div className="flex items-center gap-4">{profile?.role === 'admin' && <Link to="/admin" className="text-sm text-brand-700">Developer dashboard</Link>}<Button variant="ghost" size="sm" onClick={() => void signOut()}>Sign out</Button></div></div></header><main id="main-content" tabIndex={-1} className="mx-auto max-w-6xl px-4 py-8">{content}</main></div>;
}
