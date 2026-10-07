import { Link } from 'react-router-dom';
import type { ChangeEvent } from 'react';
import { Alert, Button, Card, Input, Textarea } from '@/components/ui';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { GoogleReviewLinkHelp } from '@/components/GoogleReviewLinkHelp';
import { parsePartnerTopics, MAX_PARTNER_TOPIC_LENGTH } from '@/lib/partner-setup';

interface Props {
  email: string;
  name: string;
  category: string;
  google: string;
  logo: string;
  topics: string[];
  accepted: boolean;
  busy: boolean;
  urlError: string | null;
  logoError: string | null;
  onName: (value: string) => void;
  onCategory: (value: string) => void;
  onGoogle: (value: string) => void;
  onLogo: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveLogo: () => void;
  onTopics: (topics: string[]) => void;
  onAccepted: (value: boolean) => void;
}

/** The invited owner checks everything in one place before paying. */
export function PartnerOwnerReview(props: Props) {
  return <Card className="space-y-6 p-5 sm:p-8">
    <div>
      <p className="break-all text-xs font-medium text-brand-800">Prepared for {props.email}</p>
      <h1 className="mt-2 text-xl font-bold text-gray-900">Check your business details</h1>
      <p className="mt-2 text-sm text-gray-600">Your partner has done the setup for you. Check or edit the details below, then choose a plan and pay securely. Your review page activates after payment.</p>
    </div>
    <fieldset disabled={props.busy} className="space-y-6">
      <legend className="sr-only">Your business setup</legend>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Business name" autoComplete="organization" maxLength={200} required disabled={props.busy} value={props.name} onChange={(e) => props.onName(e.target.value)} />
        <Input label="Business category" maxLength={100} required disabled={props.busy} value={props.category} onChange={(e) => props.onCategory(e.target.value)} />
      </div>
      <div className="space-y-3">
        <Input label="Google review link (optional)" type="url" maxLength={2048} disabled={props.busy} error={props.urlError ?? undefined} hint="Connect your Google Business Profile so customers can post their reviews. You can add this later in Settings." value={props.google} onChange={(e) => props.onGoogle(e.target.value)} />
        <GoogleReviewLinkHelp businessName={props.name} currentUrl={props.google} onUseLink={props.onGoogle} />
      </div>
      <div>
        <label htmlFor="partner-owner-logo" className="block text-sm font-medium text-gray-800">Business logo (optional)</label>
        <input id="partner-owner-logo" type="file" accept="image/png,image/jpeg,image/webp" disabled={props.busy} className="mt-2 block w-full text-sm" onChange={props.onLogo} />
        {props.logo && <div className="mt-3 flex items-center gap-3"><img src={props.logo} alt={`${props.name || 'Business'} logo preview`} className="h-16 w-16 rounded-lg border border-gray-200 object-contain" /><Button variant="ghost" size="sm" disabled={props.busy} onClick={props.onRemoveLogo}>Remove logo</Button></div>}
        {props.logoError && <Alert variant="error" className="mt-2">{props.logoError}</Alert>}
      </div>
      <Textarea label="Review topics" rows={6} disabled={props.busy} value={props.topics.join('\n')} onChange={(e) => props.onTopics(e.target.value.split('\n'))} hint={`${parsePartnerTopics(props.topics.join('\n')).length} of 20 topics. One per line, up to ${MAX_PARTNER_TOPIC_LENGTH} characters each. Customers describe their own experience.`} />
      <div className="space-y-3 border-t border-gray-200 pt-5">
        <p className="text-sm text-gray-600">You own this account and make the payment yourself. We use your email for your account and the business details for your review page. There is no free trial for this setup. Read the <Link to="/refunds" target="_blank" className="font-medium underline">refund policy</Link> before paying.</p>
        <ConsentCheckbox checked={props.accepted} onChange={props.onAccepted}>I agree to the <Link to="/terms" target="_blank" className="underline">Terms and conditions</Link> and <Link to="/privacy" target="_blank" className="underline">Privacy notice</Link>.</ConsentCheckbox>
      </div>
    </fieldset>
  </Card>;
}
