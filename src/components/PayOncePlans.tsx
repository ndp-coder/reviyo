import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BEST_VALUE_PLAN, PLAN_ORDER, PLANS, YEARLY_SAVING, perMonth } from '@/config/plans';
import { Badge, Button, Card } from '@/components/ui';
import { formatRupees } from '@/lib/autopay';
import { createRazorpayOrder, verifyRazorpayPayment, startRazorpayCheckout } from '@/lib/razorpay';
import type { RazorpayCheckoutSuccessResponse, SubscriptionPlan } from '@/lib/types';

export interface PaymentFeedback {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface PayOncePlansProps {
  businessId: string;
  userName: string;
  userEmail: string;
  /** The paid plan the business is on now, if any: marked "Current" and offered as "Extend". */
  currentPlan?: SubscriptionPlan | null;
  heading?: string;
  onFeedback: (feedback: PaymentFeedback | null) => void;
  /** Called once Razorpay's payment has been checked, whether or not it could be confirmed yet. */
  onFinished: (paid: boolean) => void | Promise<void>;
}

type PendingPayment = { plan: SubscriptionPlan; response: RazorpayCheckoutSuccessResponse };

/** One-time purchase of a fixed term through Razorpay Checkout. Used on Billing and in onboarding. */
export function PayOncePlans({
  businessId,
  userName,
  userEmail,
  currentPlan,
  heading = 'Pay once instead',
  onFeedback,
  onFinished,
}: PayOncePlansProps) {
  const [processingPlan, setProcessingPlan] = useState<SubscriptionPlan | null>(null);
  const [pendingPayment, setPendingPayment] = useState<PendingPayment | null>(null);
  const checkoutBusy = useRef(false);
  const confirming = useRef(false);
  const receivedPayment = useRef(false);

  async function confirmPayment(payment: PendingPayment) {
    if (confirming.current) return;
    confirming.current = true;
    setProcessingPlan(payment.plan);
    onFeedback({ type: 'info', message: 'Confirming your payment with Razorpay…' });
    try {
      const result = await verifyRazorpayPayment({
        business_id: businessId,
        plan: payment.plan,
        ...payment.response,
      });
      onFeedback(result.success
        ? { type: 'success', message: 'Payment received. Your plan is active.' }
        : { type: 'error', message: result.error || 'Your payment is awaiting confirmation. Check its status below; you do not need to pay again.' });
      await onFinished(result.success);
      if (result.success) { setPendingPayment(null); checkoutBusy.current = false; }
    } catch {
      onFeedback({ type: 'error', message: 'We could not finish confirming your payment. Check its status below; you do not need to pay again.' });
    } finally {
      confirming.current = false;
      setProcessingPlan(null);
    }
  }

  async function handleCheckout(planId: SubscriptionPlan) {
    if (checkoutBusy.current) return;
    checkoutBusy.current = true;
    receivedPayment.current = false;
    onFeedback(null);
    setProcessingPlan(planId);

    try {
      const { order, error: orderError } = await createRazorpayOrder(businessId, planId);

      if (orderError || !order) {
        onFeedback({
          type: 'error',
          message: orderError || 'We couldn’t start the payment. Please try again.',
        });
        checkoutBusy.current = false;
        setProcessingPlan(null);
        return;
      }

      await startRazorpayCheckout({
        order,
        userName,
        userEmail,
        onSuccess: async (paymentResponse: RazorpayCheckoutSuccessResponse) => {
          if (receivedPayment.current) return;
          receivedPayment.current = true;
          const payment = { plan: planId, response: paymentResponse };
          setPendingPayment(payment);
          await confirmPayment(payment);
        },
        onError: (errMsg: string) => {
          if (receivedPayment.current) return;
          onFeedback({
            type: 'error',
            message: errMsg || 'The payment wasn’t completed, and you haven’t been charged. Please try again.',
          });
          checkoutBusy.current = false;
          setProcessingPlan(null);
        },
        onDismiss: () => {
          if (receivedPayment.current) return;
          checkoutBusy.current = false;
          setProcessingPlan(null);
        },
      });
    } catch (err) {
      if (receivedPayment.current) return;
      console.error('Checkout error:', err);
      onFeedback({
        type: 'error',
        message: 'We couldn’t open the payment window. Check your connection and try again.',
      });
      checkoutBusy.current = false;
      setProcessingPlan(null);
    }
  }

  // All terms include the same features, so only price and term differ.
  return (
    <section aria-labelledby="pay-once-heading">
      <h2 id="pay-once-heading" className="text-base font-semibold text-gray-900">{heading}</h2>
      <p className="mt-0.5 text-sm text-gray-600">
        Buy or extend a fixed term without AutoPay. One-time payments don&apos;t renew. Every term includes
        everything — see{' '}
        <Link to="/pricing" className="font-medium text-brand-700 underline underline-offset-2">what&apos;s included</Link>.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const isCurrentPlan = currentPlan === planId;
          const isProcessing = processingPlan === planId;
          const bestValue = planId === BEST_VALUE_PLAN;
          return (
            <Card key={planId} className={`flex flex-col p-5 ${bestValue ? 'border-brand-300' : ''}`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">{plan.label}</h3>
                {bestValue && <Badge variant="success">Save {formatRupees(YEARLY_SAVING)} vs monthly</Badge>}
                {isCurrentPlan && <Badge variant="success">Current</Badge>}
              </div>
              <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">{formatRupees(plan.price)}</p>
              <p className="text-xs text-gray-600">{perMonth(planId)} · taxes included</p>
              <Button
                className="mt-4 w-full"
                variant={bestValue ? 'primary' : 'outline'}
                loading={isProcessing}
                disabled={pendingPayment !== null || (processingPlan !== null && !isProcessing)}
                onClick={() => handleCheckout(planId)}
              >
                {isProcessing ? 'Opening payment…' : `${isCurrentPlan ? 'Extend' : 'Pay'} ${formatRupees(plan.price)}`}
              </Button>
            </Card>
          );
        })}
      </div>
      {pendingPayment && <div className="mt-4 space-y-2">
        <p className="text-sm text-gray-700">Your payment was submitted. Check its status before making another payment.</p>
        <Button variant="outline" loading={processingPlan !== null} onClick={() => void confirmPayment(pendingPayment)}>Check payment status</Button>
      </div>}
      <p className="mt-2 text-xs text-gray-600">
        Pay by UPI, card, or netbanking. Your plan activates once Razorpay confirms the payment.
      </p>
    </section>
  );
}
