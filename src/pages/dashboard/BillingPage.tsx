import { useState, useEffect, useCallback } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { ShieldCheck, Receipt } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { legal, displayValue } from '@/config/legal';
import { BEST_VALUE_PLAN, PLAN_ORDER, PLANS, YEARLY_SAVING, perMonth } from '@/config/plans';
import { Alert, Card, Button, Badge, PageHeader, Skeleton } from '@/components/ui';
import { AutopaySetup } from '@/components/AutopaySetup';
import { AUTOPAY_PLANS, cancelAutopay, formatRupees } from '@/lib/autopay';
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  startRazorpayCheckout,
} from '@/lib/razorpay';
import type {
  AutopayMandate,
  Business,
  PaymentOrder,
  PaymentOrderStatus,
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  RazorpayCheckoutSuccessResponse,
} from '@/lib/types';

const subscriptionStatus: Record<SubscriptionStatus, { label: string; variant: 'info' | 'success' | 'error' | 'default' }> = {
  trial: { label: 'Free trial', variant: 'info' },
  active: { label: 'Active', variant: 'success' },
  expired: { label: 'Expired', variant: 'error' },
  cancelled: { label: 'Cancelled', variant: 'default' },
};

const orderStatus: Record<PaymentOrderStatus, { label: string; variant: 'success' | 'error' | 'warning' | 'default' }> = {
  paid: { label: 'Paid', variant: 'success' },
  failed: { label: 'Failed', variant: 'error' },
  attempted: { label: 'Pending', variant: 'warning' },
  created: { label: 'Not completed', variant: 'default' },
};

const formatDate = (iso: string, month: 'short' | 'long' = 'short') =>
  new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month, year: 'numeric' });

export function BillingPage() {
  const { business, refreshSubscription } = useOutletContext<{
    business: Business | null;
    refreshSubscription: () => Promise<void>;
  }>();
  const { user, profile } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [paymentOrders, setPaymentOrders] = useState<PaymentOrder[]>([]);
  const [mandate, setMandate] = useState<AutopayMandate | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [processingPlan, setProcessingPlan] = useState<SubscriptionPlan | null>(null);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!business) return;
    try {
      const [subRes, ordersRes, mandateRes] = await Promise.all([
        supabase
          .from('subscriptions')
          .select('*')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('payment_orders')
          .select('*')
          .eq('business_id', business.id)
          .order('created_at', { ascending: false })
          .limit(10),
        supabase
          .from('autopay_mandates')
          .select('*')
          .eq('business_id', business.id)
          .neq('status', 'created')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      // Supabase reports failures in the result rather than throwing. Showing
      // an empty billing page on a failed load would tell a paying owner they
      // have no plan and no payments, so say it failed instead.
      setLoadFailed(Boolean(subRes.error || ordersRes.error || mandateRes.error));
      setSubscription(subRes.data as Subscription | null);
      setPaymentOrders((ordersRes.data as PaymentOrder[]) || []);
      setMandate(mandateRes.data as AutopayMandate | null);
    } catch (err) {
      console.error('Error loading billing data:', err);
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [business]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getDaysRemaining = (expiresAt: string | null) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - new Date().getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days;
  };

  const daysRemaining = subscription ? getDaysRemaining(subscription.expires_at) : null;
  const isTrial = subscription?.status === 'trial';
  const isActive = subscription?.status === 'active';
  const isExpired = subscription?.status === 'expired' || (daysRemaining !== null && daysRemaining <= 0);

  const mandateLive = mandate !== null && ['authorized', 'active', 'paused'].includes(mandate.status);

  async function handleCancelAutopay() {
    if (!business) return;
    setCancelling(true);
    const result = await cancelAutopay(business.id);
    setCancelling(false);
    setConfirmingCancel(false);
    if (!result.cancelled) {
      setFeedback({ type: 'error', message: result.error ?? 'Could not cancel AutoPay.' });
      return;
    }
    setFeedback({
      type: 'success',
      message: 'AutoPay is cancelled. You will not be charged again, and you keep access until your current period ends.',
    });
    await Promise.all([loadData(), refreshSubscription()]);
  }

  async function handleAutopayComplete(result: { trialStarted: boolean }) {
    setFeedback({
      type: 'success',
      message: result.trialStarted
        ? `AutoPay is on and your ${legal.trialDays}-day free trial has started. Your ₹1 is being refunded.`
        : 'AutoPay is on. Your ₹1 is being refunded.',
    });
    await Promise.all([loadData(), refreshSubscription()]);
  }

  async function handleCheckout(planId: SubscriptionPlan) {
    if (!business) return;
    setFeedback(null);
    setProcessingPlan(planId);

    try {
      const { order, error: orderError } = await createRazorpayOrder(business.id, planId);

      if (orderError || !order) {
        setFeedback({
          type: 'error',
          message: orderError || 'We couldn’t start the payment. Please try again.',
        });
        setProcessingPlan(null);
        return;
      }

      await startRazorpayCheckout({
        order,
        userName: profile?.full_name || business.name,
        userEmail: user?.email || '',
        onSuccess: async (paymentResponse: RazorpayCheckoutSuccessResponse) => {
          setFeedback({
            type: 'info',
            message: 'Confirming your payment with Razorpay…',
          });

          const verifyRes = await verifyRazorpayPayment({
            business_id: business.id,
            plan: planId,
            razorpay_order_id: paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
          });

          if (verifyRes.success) {
            setFeedback({
              type: 'success',
              message: 'Payment received. Your plan is active.',
            });
            // Unlock the rest of the dashboard without a page reload.
            await Promise.all([loadData(), refreshSubscription()]);
          } else {
            setFeedback({
              type: 'error',
              message:
                verifyRes.error ||
                'We couldn’t confirm the payment yet. If money was debited, your plan activates automatically within a few minutes — no need to pay again.',
            });
            await Promise.all([loadData(), refreshSubscription()]);
          }
          setProcessingPlan(null);
        },
        onError: (errMsg: string) => {
          setFeedback({
            type: 'error',
            message: errMsg || 'The payment wasn’t completed, and you haven’t been charged. Please try again.',
          });
          setProcessingPlan(null);
        },
        onDismiss: () => {
          setProcessingPlan(null);
        },
      });
    } catch (err) {
      console.error('Checkout error:', err);
      setFeedback({
        type: 'error',
        message: 'We couldn’t open the payment window. Check your connection and try again.',
      });
      setProcessingPlan(null);
    }
  }

  const retry = () => {
    setLoading(true);
    void loadData();
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Billing" description="Your plan, AutoPay, and payment history." />

      {feedback && (
        <Alert variant={feedback.type}>{feedback.message}</Alert>
      )}

      {loadFailed && !loading && (
        <Alert
          variant="error"
          title="We couldn’t load your billing details"
          action={<Button size="sm" variant="outline" onClick={retry}>Try again</Button>}
        >
          Your plan and payments are safe — this page just couldn’t reach them. Check your connection and try again
          before paying for anything.
        </Alert>
      )}

      {loading ? (
        <div role="status" aria-label="Loading billing" className="space-y-6">
          <Skeleton className="h-28" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      ) : loadFailed ? null : (
        <>
          {/* Current plan */}
          {subscription && (
            <Card className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-base font-semibold text-gray-900">Your plan</h2>
                <Badge variant={isExpired ? 'error' : subscriptionStatus[subscription.status].variant}>
                  {isExpired ? 'Expired' : subscriptionStatus[subscription.status].label}
                </Badge>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-gray-600">Plan</dt>
                  <dd className="mt-0.5 text-sm font-medium text-gray-900">
                    {isTrial ? `${legal.trialDays}-day free trial` : `${PLANS[subscription.plan].label}`}
                  </dd>
                </div>
                {subscription.expires_at && (
                  <div>
                    <dt className="text-xs text-gray-600">{isExpired ? 'Ended on' : isTrial ? 'Trial ends' : mandateLive ? 'Renews on' : 'Ends on'}</dt>
                    <dd className="mt-0.5 text-sm font-medium text-gray-900">{formatDate(subscription.expires_at)}</dd>
                  </div>
                )}
                {daysRemaining !== null && daysRemaining > 0 && (
                  <div>
                    <dt className="text-xs text-gray-600">Time left</dt>
                    <dd className={`mt-0.5 text-sm font-medium ${daysRemaining <= 7 ? 'text-amber-800' : 'text-gray-900'}`}>
                      {daysRemaining} day{daysRemaining === 1 ? '' : 's'}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          )}

          {/* AutoPay */}
          {business && (
            <Card className="p-5 sm:p-6">
              {mandateLive && mandate ? (
                <div>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h2 className="text-base font-semibold text-gray-900">AutoPay</h2>
                    <Badge variant={mandate.status === 'paused' ? 'warning' : 'success'}>
                      {mandate.status === 'active'
                        ? 'On'
                        : mandate.status === 'authorized'
                        ? 'On — bank confirming'
                        : 'Paused'}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-gray-700">
                    {formatRupees(AUTOPAY_PLANS[mandate.plan].price)} every {AUTOPAY_PLANS[mandate.plan].months} months via{' '}
                    {mandate.method === 'upi' ? 'UPI AutoPay' : 'card'}.
                    {subscription?.expires_at && mandate.status !== 'paused' && (
                      <>
                        {' '}Next charge around{' '}
                        <strong>
                          {formatDate(new Date(new Date(subscription.expires_at).getTime() - 24 * 60 * 60 * 1000).toISOString(), 'long')}
                        </strong>
                        . Your {mandate.method === 'upi' ? 'UPI app' : 'bank'} notifies you at least 24 hours before.
                      </>
                    )}
                  </p>
                  {mandate.status === 'paused' && (
                    <Alert variant="warning" className="mt-3">
                      AutoPay is paused in your UPI app, so renewals can&apos;t be charged. Resume it in your UPI app to keep
                      your plan running.
                    </Alert>
                  )}
                  {mandate.failed_attempts > 0 && (
                    <Alert variant="error" className="mt-3">
                      The last renewal charge didn&apos;t go through. We&apos;ll try again automatically; please make sure your{' '}
                      {mandate.method === 'upi' ? 'UPI account' : 'card'} has enough balance.
                    </Alert>
                  )}
                  <p className="mt-2 text-xs text-gray-600">
                    ₹1 verification payment: {mandate.auth_refund_id ? 'refunded' : 'refund in progress'}.
                  </p>

                  <div className="mt-4">
                    {confirmingCancel ? (
                      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                        <p className="text-sm text-red-900">
                          Cancel AutoPay? You won&apos;t be charged again. You keep access until{' '}
                          {subscription?.expires_at ? formatDate(subscription.expires_at, 'long') : 'your current period ends'}
                          , then your QR code, AI drafting, and dashboard pause.
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button variant="danger" size="sm" onClick={handleCancelAutopay} loading={cancelling}>
                            Yes, cancel AutoPay
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => setConfirmingCancel(false)} disabled={cancelling}>
                            Keep AutoPay
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button variant="ghost" size="sm" className="-ml-3" onClick={() => setConfirmingCancel(true)}>
                        Cancel AutoPay
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <h2 className="text-base font-semibold text-gray-900">
                    {subscription ? 'Turn on AutoPay' : `Start your ${legal.trialDays}-day free trial`}
                  </h2>
                  {mandate?.status === 'failed' && (
                    <Alert variant="error" className="mt-3">
                      AutoPay stopped after three renewal charges failed. Set it up again below, or pay once for a plan.
                    </Alert>
                  )}
                  {mandate?.status === 'rejected' && (
                    <Alert variant="error" className="mt-3">
                      Your bank didn&apos;t approve the AutoPay mandate. Please try again, or use a different UPI app or card.
                    </Alert>
                  )}
                  <p className="mt-1 text-sm text-gray-600">
                    {subscription
                      ? 'Renew automatically so your QR code and dashboard never pause.'
                      : 'Set up AutoPay with a ₹1 verification payment, refunded straight away. Nothing more is charged until your trial ends.'}
                  </p>
                  <div className="mt-5">
                    <AutopaySetup
                      businessId={business.id}
                      userName={profile?.full_name || business.name}
                      userEmail={user?.email}
                      trialAvailable={!subscription}
                      currentAccessEndsAt={subscription?.expires_at}
                      onComplete={handleAutopayComplete}
                    />
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* One-time payment. Secondary to AutoPay, so it is compact: both
              terms include the same features, so only price and term differ. */}
          <section aria-labelledby="pay-once-heading">
            <h2 id="pay-once-heading" className="text-base font-semibold text-gray-900">Pay once instead</h2>
            <p className="mt-0.5 text-sm text-gray-600">
              Buy or extend a fixed term without AutoPay. One-time payments don&apos;t renew. Every term includes
              everything — see{' '}
              <Link to="/pricing" className="font-medium text-blue-700 underline underline-offset-2">what&apos;s included</Link>.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {PLAN_ORDER.map((planId) => {
                const plan = PLANS[planId];
                const isCurrentPlan = subscription?.plan === planId && isActive && !isExpired;
                const isProcessing = processingPlan === planId;
                const bestValue = planId === BEST_VALUE_PLAN;
                return (
                  <Card key={planId} className={`flex flex-col p-5 ${bestValue ? 'border-blue-300' : ''}`}>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-gray-900">{plan.label}</h3>
                      {bestValue && <Badge variant="success">Save {formatRupees(YEARLY_SAVING)}</Badge>}
                      {isCurrentPlan && <Badge variant="success">Current</Badge>}
                    </div>
                    <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{formatRupees(plan.price)}</p>
                    <p className="text-xs text-gray-600">{perMonth(planId)} · taxes included</p>
                    <Button
                      className="mt-4 w-full"
                      variant={bestValue ? 'primary' : 'outline'}
                      loading={isProcessing}
                      disabled={processingPlan !== null && !isProcessing}
                      onClick={() => handleCheckout(planId)}
                    >
                      {isProcessing ? 'Opening payment…' : `${isCurrentPlan ? 'Extend' : 'Pay'} ${formatRupees(plan.price)}`}
                    </Button>
                  </Card>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-gray-600">
              Pay by UPI, card, or netbanking. Your plan activates once Razorpay confirms the payment.
            </p>
          </section>

          {/* Invoices / Payment History */}
          <section aria-labelledby="payment-history-heading">
            <h2 id="payment-history-heading" className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <Receipt className="h-4 w-4 text-gray-600" aria-hidden="true" /> Payment history & receipts
            </h2>
            <Card className="mt-3 overflow-hidden">
              {paymentOrders.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-sm font-medium text-gray-800">No payments yet</p>
                  <p className="mt-1 text-sm text-gray-600">
                    Every payment you make — AutoPay charges and one-time payments — is listed here with its Razorpay
                    reference.
                  </p>
                </div>
              ) : (
                <>
                  {/* Phones: one block per payment instead of a sideways-scrolling table. */}
                  <ul className="divide-y divide-gray-100 sm:hidden">
                    {paymentOrders.map((order) => {
                      const status = order.kind === 'autopay' && order.status === 'created'
                        ? { label: 'Scheduled', variant: 'info' as const }
                        : orderStatus[order.status];
                      return (
                        <li key={order.id} className="px-4 py-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold tabular-nums text-gray-900">
                              {formatRupees(order.amount / 100)}
                            </span>
                            <Badge variant={status.variant}>{status.label}</Badge>
                          </div>
                          <p className="mt-0.5 text-xs text-gray-600">
                            {formatDate(order.created_at)} · {PLANS[order.plan].label}
                          </p>
                          <p className="mt-1 break-all font-mono text-xs text-gray-600">{order.payment_id || order.order_id}</p>
                        </li>
                      );
                    })}
                  </ul>
                  <table className="hidden w-full text-left text-sm sm:table">
                    <thead className="border-b border-gray-200 bg-gray-50 text-xs font-medium text-gray-600">
                      <tr>
                        <th scope="col" className="px-4 py-3 font-medium">Date</th>
                        <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                        <th scope="col" className="px-4 py-3 font-medium">Payment reference</th>
                        <th scope="col" className="px-4 py-3 text-right font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {paymentOrders.map((order) => {
                        const status = order.kind === 'autopay' && order.status === 'created'
                          ? { label: 'Scheduled', variant: 'info' as const }
                          : orderStatus[order.status];
                        return (
                          <tr key={order.id}>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">{formatDate(order.created_at)}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-gray-900">{PLANS[order.plan].label}</td>
                            <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums text-gray-900">
                              {formatRupees(order.amount / 100)}
                            </td>
                            <td className="max-w-[16rem] truncate px-4 py-3 font-mono text-xs text-gray-600" title={order.payment_id || order.order_id}>
                              {order.payment_id || order.order_id}
                            </td>
                            <td className="whitespace-nowrap px-4 py-3 text-right">
                              <Badge variant={status.variant}>{status.label}</Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </Card>
          </section>
        </>
      )}

      {/* How payments are handled */}
      <div className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-5">
        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-700" aria-hidden="true" />
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Payments are handled by Razorpay</h2>
          <p className="mt-1 text-sm text-gray-600">
            Your card, UPI, and bank details go directly into Razorpay's checkout and never reach
            Reviyo's servers or database. Razorpay is an RBI-authorised payment aggregator and is
            PCI-DSS Level 1 certified. Which methods appear depends on what Razorpay has enabled
            for this account.
          </p>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-gray-600">
        <p>
          <span className="font-medium text-gray-800">What&apos;s included:</span> one subscription covers 1
          business, 1 location, and 1 Google Business Profile. Prices include applicable taxes.
        </p>
        <p>
          <span className="font-medium text-gray-800">Renewals.</span> With AutoPay on, your plan renews
          automatically until you cancel, and you are notified at least 24 hours before each charge.
          Cancel any time above; you keep access until the end of the period you have paid for.
          One-time payments never renew.
        </p>
        <p>
          Full refund within 7 days of payment, no reason needed. See the{' '}
          <Link to="/refunds" className="font-medium text-blue-700 underline underline-offset-2">
            Refund &amp; Cancellation Policy
          </Link>{' '}
          or email{' '}
          <a
            href={'mailto:' + legal.supportEmail + '?subject=Refund%20request'}
            className="font-medium text-blue-700 underline underline-offset-2"
          >
            {displayValue(legal.supportEmail)}
          </a>
          .
        </p>
      </div>
    </div>
  );
}
