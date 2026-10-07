import { Card } from '@/components/ui';

const steps = [
  'Accept your developer invitation and create your partner password.',
  'Use the owner’s own email. Enter the business name and category, then prepare the Google review link, logo and review topics.',
  'Save without sending, or save and invite the owner. You can edit and resend a pending setup.',
  'The owner checks the details, accepts the terms and pays through Razorpay. Partner-prepared businesses have no free trial.',
  'Once payment is confirmed, the owner downloads their QR code. If confirmation is delayed, check payment status instead of paying again.',
  'Customers describe their real experience, edit the draft and post their own review on Google.',
  'Save your bank details for automatic payouts. Only qualifying annual payments earn commission after the 14-day payment check; monthly and six-month payments earn none.',
];

export function PartnerWalkthrough() {
  return <Card className="mt-6 overflow-hidden">
    <div className="p-5">
      <h2 id="partner-video-title" className="font-semibold">Watch: set up a business for an owner</h2>
      <p className="mt-2 text-sm text-gray-600">A 90-second walkthrough in English, with captions. Play, pause or replay any step.</p>
    </div>
    <video aria-labelledby="partner-video-title" controls playsInline preload="metadata" poster="/media/partner-walkthrough-poster.jpg" className="aspect-video w-full bg-brand-900">
      <source src="/media/partner-walkthrough.mp4" type="video/mp4" />
      <track kind="captions" src="/media/partner-walkthrough-en.vtt" srcLang="en" label="English" />
      Your browser cannot play this video. Read the steps below.
    </video>
    <details className="p-5 text-sm text-gray-600">
      <summary className="cursor-pointer font-medium text-gray-900">Read the walkthrough steps</summary>
      <ol className="mt-4 list-decimal space-y-3 pl-5">{steps.map(step => <li key={step}>{step}</li>)}</ol>
    </details>
  </Card>;
}
