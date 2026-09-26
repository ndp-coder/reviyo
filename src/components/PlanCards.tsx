import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { BEST_VALUE_PLAN, PLAN_FEATURES, PLAN_ORDER, PLANS, YEARLY_SAVING, formatRupees, perMonth } from '@/config/plans';
import { legal } from '@/config/legal';

/**
 * The two plans side by side, then one shared list of what every plan
 * includes. Both terms include exactly the same features, so repeating the
 * list inside each card only made them look different when they are not.
 */
export function PlanCards({
  headingLevel = 'h3',
  showFeatures = true,
}: {
  headingLevel?: 'h2' | 'h3';
  /** Off where the page already lists what is included. */
  showFeatures?: boolean;
}) {
  const Heading = headingLevel;
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 sm:gap-6">
        {PLAN_ORDER.map((planId) => {
          const plan = PLANS[planId];
          const bestValue = planId === BEST_VALUE_PLAN;
          return (
            <div
              key={planId}
              className={`flex flex-col rounded-lg bg-white p-6 sm:p-8 ${
                bestValue ? 'border-2 border-ink' : 'border border-line'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Heading className="text-lg font-semibold text-ink first-letter:uppercase">{plan.label}</Heading>
                {bestValue && (
                  <span className="rounded bg-green-100 px-2 py-0.5 text-sm font-semibold text-green-800">
                    Save {formatRupees(YEARLY_SAVING)}
                  </span>
                )}
              </div>
              <p className="mt-4 font-wide text-5xl font-bold tabular-nums tracking-[-0.02em] text-ink">
                {formatRupees(plan.price)}
              </p>
              <p className="mt-2 text-muted">
                for {plan.months} months, about {perMonth(planId).replace('/month', '')} a month
              </p>
              <Link
                to="/signup"
                className={`mt-8 inline-flex min-h-12 w-full items-center justify-center rounded-lg px-6 text-base font-semibold transition-colors ${
                  bestValue ? 'bg-blue-600 text-white hover:bg-blue-700' : 'border border-ink/25 bg-white text-ink hover:border-ink'
                }`}
              >
                Start {legal.trialDays}-day free trial
              </Link>
            </div>
          );
        })}
      </div>

      {showFeatures && (
        <div className="mt-10">
          <p className="font-semibold text-ink">Every plan includes</p>
          <ul className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {PLAN_FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5 text-muted">
                <Check className="mt-1 h-4 w-4 flex-shrink-0 text-blue-600" aria-hidden="true" /> {feature}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
