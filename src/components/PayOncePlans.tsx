import { useState } from 'react';
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

  async function handleCheckout(planId: SubscriptionPlan) {
    onFeedback(null);
    setProcessingPlan(planId);

    try {
      const { order, error: orderError } = await createRazorpayOrder(businessId, planId);

      if (orderError || !order) {
        onFeedback({
          type: 'error',
          message: orderError || 'We couldn’t start the payment. Please try again.',
        });
        setProcessingPlan(null);
        return;
      }

      await startRazorpayCheckout({
        order,
        userName,
        userEmail,
        onSuccess: async (paymentResponse: RazorpayCheckoutSuccessResponse) => {
          onFeedback({
            type: 'info',
            message: 'Confirming your payment with Razorpay…',
          });

          const verifyRes = await verifyRazorpayPayment({
            business_id: businessId,
            plan: planId,
            razorpay_order_id: paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
          });

          if (verifyRes.success) {
            onFeedback({
              type: 'success',
              message: 'Payment received. Your plan is active.',
            });
          } else {
            onFeedback({
              type: 'error',
              message:
                verifyRes.error ||
                'We couldn’t confirm the payment yet. If money was debited, your plan activates automatically within a few minutes — no need to pay again.',
            });
          }
          await onFinished(Boolean(verifyRes.success));
          setProcessingPlan(null);
        },
        onError: (errMsg: string) => {
          onFeedback({
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
      onFeedback({
        type: 'error',
        message: 'We couldn’t open the payment window. Check your connection and try again.',
      });
      setProcessingPlan(null);
    }
  }

  // Both terms include the same features, so only price and term differ.
  return (
    <section aria-labelledby="pay-once-heading">
      <h2 id="pay-once-heading" className="text-base font-semibold text-gray-900">{heading}</h2>
      <p className="mt-0.5 text-sm text-gray-600">
        Buy or extend a fixed term without AutoPay. One-time payments don&apos;t renew. Every term includes
        everything — see{' '}
        <Link to="/pricing" className="font-medium text-brand-700 underline underline-offset-2">what&apos;s included</Link>.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const isCurrentPlan = currentPlan === planId;
          const isProcessing = processingPlan === planId;
          const bestValue = planId === BEST_VALUE_PLAN;
          return (
            <Card key={planId} className={`flex flex-col p-5 ${bestValue ? 'border-brand-300' : ''}`}>
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
  );
}
