import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { BEST_VALUE_PLAN, PLAN_FEATURES, PLAN_ORDER, PLANS, YEARLY_SAVING, formatRupees, perMonth, planTerm } from '@/config/plans';
import { legal } from '@/config/legal';
import { buttonClasses } from '@/components/ui/button-styles';

/**
 * The plans side by side, then one shared list of what every plan
 * includes. All terms include exactly the same features, so repeating the
 * list inside each card only made them look different when they are not.
 */
export function PlanCards({ headingLevel = 'h3' }: { headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3 sm:gap-6">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const bestValue = planId === BEST_VALUE_PLAN;
          return (
            <div
              key={planId}
              className={`flex flex-col rounded-xl border bg-white p-6 sm:p-8 ${
                bestValue ? 'border-brand-900 ring-1 ring-brand-900' : 'border-gray-300'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Heading className="text-lg font-bold text-gray-900">{plan.label}</Heading>
                {bestValue && (
                  <span className="rounded-full bg-accent-100 px-2.5 py-0.5 text-xs font-semibold text-accent-800">
                    Save {formatRupees(YEARLY_SAVING)} vs monthly
                  </span>
                )}
              </div>
              <p className="mt-3 text-5xl md:text-4xl lg:text-5xl font-bold tabular-nums tracking-tight text-gray-900">{formatRupees(plan.price)}</p>
              <p className="mt-1 text-sm text-gray-600">
                {plan.months === 1 ? 'for 1 month, billed monthly with AutoPay' : `for ${planTerm(planId)}, which works out to ${perMonth(planId)}`}
              </p>
              <Link
                to="/signup"
                className={`${buttonClasses({ variant: bestValue ? 'primary' : 'outline', size: 'lg' })} mt-6 w-full`}
              >
                Start {legal.trialDays}-day free trial
              </Link>
            </div>
          );
        })}
      </div>

      <div className="mt-6 rounded-xl border border-gray-300 bg-white p-6">
        <p className="text-sm font-semibold text-gray-900">Every plan includes</p>
        <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
          {PLAN_FEATURES.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-gray-700">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent-700" aria-hidden="true" /> {feature}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
