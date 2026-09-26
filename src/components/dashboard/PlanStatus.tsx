import { Link } from 'react-router-dom';
import { Alert } from '@/components/ui';
import { PLANS, formatRupees } from '@/config/plans';
import type { AutopayMandate, Subscription } from '@/lib/types';

const DAY = 24 * 60 * 60 * 1000;
const LIVE = ['authorized', 'active'];

const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });

/**
 * One line on Overview saying what happens to the owner's plan next — shown
 * only when there is something to know: during the free trial (when the first
 * charge lands, or that the QR code will stop), and when a plan without AutoPay
 * is about to end. No countdown pressure: just the date, the amount, and where
 * to change it.
 */
export function PlanStatus({
  subscription,
  mandate,
}: {
  subscription: Subscription | null;
  mandate: Pick<AutopayMandate, 'status' | 'plan' | 'method'> | null;
}) {
  if (!subscription?.expires_at) return null;
  const ends = new Date(subscription.expires_at).getTime();
  if (ends <= Date.now()) return null; // Expired: the layout already shows the renewal notice.

  const daysLeft = Math.ceil((ends - Date.now()) / DAY);
  const endsOn = longDate(subscription.expires_at);
  const autopayOn = mandate !== null && LIVE.includes(mandate.status);
  const billing = (
    <Link to="/dashboard/billing" className="font-medium underline underline-offset-2">
      {autopayOn ? 'Manage billing' : 'Choose a plan'}
    </Link>
  );

  if (subscription.status === 'trial') {
    if (autopayOn && mandate) {
      const plan = PLANS[mandate.plan];
      return (
        <Alert variant="info" className="mt-6" action={billing}>
          Free trial: {daysLeft} day{daysLeft === 1 ? '' : 's'} left. Your {plan.months}-month plan ({formatRupees(plan.price)})
          starts on {endsOn}, paid by {mandate.method === 'upi' ? 'UPI AutoPay' : 'card AutoPay'}. You&apos;ll get a
          notice 24 hours before the charge.
        </Alert>
      );
    }
    return (
      <Alert variant="warning" className="mt-6" action={billing}>
        Free trial ends on {endsOn}, and AutoPay is off — your QR code and AI drafting will pause then unless you
        choose a plan.
      </Alert>
    );
  }

  if (subscription.status === 'active' && !autopayOn && daysLeft <= 14) {
    return (
      <Alert variant="warning" className="mt-6" action={billing}>
        Your plan ends on {endsOn}. Renew before then to keep your QR code working — nothing renews automatically.
      </Alert>
    );
  }

  return null;
}
