import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, Smartphone, ShieldCheck, Bell, RotateCcw } from 'lucide-react';
import { Alert, Button } from '@/components/ui';
import { ConsentCheckbox } from '@/components/ConsentCheckbox';
import { legal } from '@/config/legal';
import { branding } from '@/config/branding';
import { AUTOPAY_PLANS, formatRupees, setUpAutopay } from '@/lib/autopay';
import { BEST_VALUE_PLAN, PLAN_ORDER, YEARLY_SAVING, perMonth, billingPeriod } from '@/config/plans';
import type { AutopayMethod, Subscription, SubscriptionPlan } from '@/lib/types';

interface AutopaySetupProps {
  businessId: string;
  userName?: string;
  userEmail?: string;
  /** True when this business has never had a subscription: the free trial applies. */
  trialAvailable: boolean;
  /** End of any access the business already has, used to show the first charge date. */
  currentAccessEndsAt?: string | null;
  onComplete: (result: { trialStarted: boolean; subscription?: Subscription | null }) => void;
}

const METHODS: { value: AutopayMethod; label: string; detail: string; icon: typeof Smartphone }[] = [
  { value: 'upi', label: 'UPI AutoPay', detail: 'GPay, PhonePe, Paytm, BHIM and other UPI apps', icon: Smartphone },
  { value: 'card', label: 'Debit or credit card', detail: 'Visa, Mastercard, RuPay', icon: CreditCard },
];

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Plan and payment-method choice plus the ₹1 AutoPay authorisation. The
 * summary states exactly what is charged and when, and consent is an
 * explicit, unticked checkbox, as RBI's e-mandate rules and DPDPA require.
 */
export function AutopaySetup({
  businessId,
  userName,
  userEmail,
  trialAvailable,
  currentAccessEndsAt,
  onComplete,
}: AutopaySetupProps) {
  const [plan, setPlan] = useState<SubscriptionPlan>('1_month');
  const [method, setMethod] = useState<AutopayMethod>('upi');
  const [consented, setConsented] = useState(false);
  const [consentError, setConsentError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  const selected = AUTOPAY_PLANS[plan];
  const price = formatRupees(selected.price);
  const period = billingPeriod(plan);

  const accessEnd = currentAccessEndsAt ? new Date(currentAccessEndsAt) : null;
  const firstCharge = trialAvailable
    ? new Date(Date.now() + legal.trialDays * 24 * 60 * 60 * 1000)
    : accessEnd && accessEnd.getTime() > Date.now()
      ? accessEnd
      : null;
  const firstChargeText = firstCharge ? `on ${formatDate(firstCharge)}` : 'within 2 days, after your bank’s advance notice';
  const methodName = method === 'upi' ? 'UPI app' : 'card';

  async function handleSetup() {
    if (!consented) {
      setConsentError('Please tick the box to authorise AutoPay.');
      return;
    }
    setConsentError(null);
    setError(null);
    setProcessing(true);

    const result = await setUpAutopay({ businessId, plan, method, userName, userEmail });
    setProcessing(false);

    if (result.dismissed) return;
    if (!result.success) {
      setError(result.error ?? 'AutoPay could not be set up. Please try again.');
      return;
    }
    onComplete({ trialStarted: Boolean(result.trialStarted), subscription: result.subscription });
  }

  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">Choose your plan</legend>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-3">
          {PLAN_ORDER.map((key) => {
            const option = AUTOPAY_PLANS[key];
            const checked = plan === key;
            return (
              <label
                key={key}
                className={`relative flex cursor-pointer flex-col rounded-lg border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700 ${
                  checked ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-gray-300 bg-white hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="autopay-plan"
                  value={key}
                  checked={checked}
                  onChange={() => setPlan(key)}
                  className="sr-only"
                />
                <span className="text-sm font-medium text-gray-700">{option.label}</span>
                <span className="mt-1 text-2xl font-bold text-gray-900">{formatRupees(option.price)}</span>
                <span className="text-xs text-gray-600">
                  {perMonth(key)}, billed {billingPeriod(key)}
                </span>
                {key === BEST_VALUE_PLAN && (
                  <span className="mt-2 self-start rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                    Save {formatRupees(YEARLY_SAVING)} vs monthly
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-semibold text-gray-900">Pay with</legend>
        <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
          {METHODS.map((option) => {
            const checked = method === option.value;
            const Icon = option.icon;
            return (
              <label
                key={option.value}
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-700 ${
                  checked ? 'border-brand-700 bg-brand-50 ring-1 ring-brand-700' : 'border-gray-300 bg-white hover:border-gray-500'
                }`}
              >
                <input
                  type="radio"
                  name="autopay-method"
                  value={option.value}
                  checked={checked}
                  onChange={() => setMethod(option.value)}
                  className="sr-only"
                />
                <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-700" aria-hidden="true" />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{option.label}</span>
                  <span className="block text-xs text-gray-600">{option.detail}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="text-sm font-semibold text-gray-900">What happens</h3>
        <ul className="mt-3 space-y-2.5 text-sm text-gray-700">
          <li className="flex gap-2.5">
            <RotateCcw className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" aria-hidden="true" />
            <span>
              <strong>Today: ₹1</strong> to verify your {methodName}. It is refunded straight away and
              usually shows up in 5–7 working days.
            </span>
          </li>
          {trialAvailable && (
            <li className="flex gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" aria-hidden="true" />
              <span>
                <strong>Your {legal.trialDays}-day free trial starts now</strong>, with full access.
              </span>
            </li>
          )}
          <li className="flex gap-2.5">
            <CreditCard className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" aria-hidden="true" />
            <span>
              <strong>{price}</strong> is charged automatically {firstChargeText}, then {period} until you cancel.
            </span>
          </li>
          <li className="flex gap-2.5">
            <Bell className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" aria-hidden="true" />
            <span>
              Your {method === 'upi' ? 'UPI app' : 'bank'} notifies you at least 24 hours before every charge.
              Cancel any time from Billing{trialAvailable ? ' — cancel before the trial ends and you pay nothing' : ''}.
            </span>
          </li>
        </ul>
      </div>

      <ConsentCheckbox checked={consented} onChange={setConsented} error={consentError}>
        I authorise {branding.name} to set up AutoPay on my {methodName} and charge{' '}
        <strong>{price} {period}</strong>, starting {firstChargeText}, until I cancel. I have read the{' '}
        <Link to="/terms" target="_blank" className="text-brand-800 underline underline-offset-2">
          Terms<span className="sr-only"> (opens in a new tab)</span>
        </Link>{' '}
        and{' '}
        <Link to="/refunds" target="_blank" className="text-brand-800 underline underline-offset-2">
          Refund Policy<span className="sr-only"> (opens in a new tab)</span>
        </Link>
        .
      </ConsentCheckbox>

      {error && <Alert variant="error">{error}</Alert>}

      <Button size="lg" className="w-full" onClick={handleSetup} loading={processing}>
        {trialAvailable ? 'Pay ₹1 and start free trial' : 'Pay ₹1 and turn on AutoPay'}
      </Button>
      <p className="text-center text-xs text-gray-600">Secure payment by Razorpay. We never see your card or UPI PIN.</p>
    </div>
  );
}
