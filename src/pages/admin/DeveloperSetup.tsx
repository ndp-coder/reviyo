import { Alert, Badge, Card } from '@/components/ui';
import { legal } from '@/config/legal';
import type { DeveloperSetup as Setup } from '@/pages/admin/developer-types';

export function DeveloperSetup({ setup }: { setup: Setup | null }) {
  const checks = setup ? [
    { label: 'Hostinger mail password', ready: setup.emailReady, detail: `Used to send partner and owner invitations from ${legal.supportEmail}.` },
    { label: 'RazorpayX credentials and source account', ready: setup.payoutsReady, detail: 'Required for commission transfers. The account also needs funding and permitted API access.' },
    { label: 'Automatic payouts enabled', ready: setup.enabled, detail: 'Enable after the payout account and automatic processing have been configured and tested.' },
    { label: 'Scheduler access key', ready: setup.schedulerReady, detail: 'The scheduled job must use this key when calling the payout processor.' },
  ] : [];
  return <section className="mt-6 space-y-4" aria-labelledby="developer-setup-heading"><h2 id="developer-setup-heading" className="text-lg font-semibold">Service setup</h2>
    <Alert variant="info">These indicators confirm saved configuration. They do not confirm email delivery, bank transfers or that a scheduled job is running.</Alert>
    {!setup && <Alert variant="error">Could not check service configuration. Use Refresh dashboard to try again.</Alert>}
    <Card className="p-5"><h3 className="font-semibold">Invitations and automatic payouts</h3><ul className="mt-3 divide-y divide-gray-200">{checks.map((c) => <li key={c.label} className="flex flex-wrap items-start justify-between gap-3 py-4"><div className="max-w-xl"><p className="text-sm font-medium">{c.label}</p><p className="mt-1 text-sm text-gray-600">{c.detail}</p></div><Badge variant={c.ready ? 'success' : 'warning'}>{c.ready ? 'Configured' : 'Needs setup'}</Badge></li>)}</ul></Card>
    <Card className="p-5"><h3 className="font-semibold">Website and account invitations</h3><dl className="mt-3 space-y-3 text-sm"><div><dt className="text-gray-600">Public website and scanner links</dt><dd className="break-all font-medium">{legal.siteUrl}</dd></div><div><dt className="text-gray-600">Support and invitation sender</dt><dd className="break-all font-medium">{legal.supportEmail}</dd></div></dl><p className="mt-4 text-sm text-gray-600">In Supabase Auth, set the site URL to the address above and allow invitation redirects to /partners and /onboarding. Configure the Hostinger sender and schedule hourly commission processing.</p><a className="mt-4 inline-block text-sm font-medium text-brand-700 underline" href="https://supabase.com/dashboard/project/yagchgwgbttxfihlyddm" target="_blank" rel="noopener noreferrer">Open Supabase project</a></Card>
  </section>;
}
