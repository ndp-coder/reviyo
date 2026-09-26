import { Link, useOutletContext } from 'react-router-dom';
import { Star, QrCode, ArrowRight, Check, Link2, MessageSquare } from 'lucide-react';
import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { Alert, Button, Card, Skeleton, Badge, PageHeader, Spinner } from '@/components/ui';
import type { Business, PrivateFeedbackStatus } from '@/lib/types';

const statusLabel: Record<PrivateFeedbackStatus, string> = { new: 'New', seen: 'Seen', resolved: 'Resolved' };
const statusVariant = { new: 'info', seen: 'default', resolved: 'success' } as const;

const formatCount = (n: number) => n.toLocaleString('en-IN');

function percent(part: number, whole: number) {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

export function DashboardOverview() {
  const { business } = useOutletContext<{ business: Business | null }>();
  const stats = useDashboardStats(business);

  if (stats.loading) {
    return (
      <div role="status" aria-label="Loading overview">
        <PageHeader title="Overview" description="How your QR code is turning visits into Google reviews." />
        <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="mt-6 h-72" />
      </div>
    );
  }

  if (stats.error) {
    return (
      <div>
        <PageHeader title="Overview" />
        <Alert
          variant="error"
          className="mt-6"
          action={<Button size="sm" variant="outline" onClick={stats.reload}>Try again</Button>}
        >
          {stats.error}
        </Alert>
      </div>
    );
  }

  // Setup the owner still has to do, shown until it is done. A missing Google
  // link is the biggest leak in the funnel, so it comes first.
  const setupSteps = [
    {
      done: Boolean(business?.google_review_url),
      label: 'Add your Google review link',
      detail: 'So customers land straight on your review form.',
      to: '/dashboard/settings?tab=google',
      cta: 'Add link',
      icon: Link2,
    },
    {
      done: stats.totalScans > 0,
      label: 'Print your QR code and put it up',
      detail: 'At the counter, reception, or on the bill. Numbers appear after the first scan.',
      to: '/dashboard/qr',
      cta: 'Get QR code',
      icon: QrCode,
    },
  ];
  const setupRemaining = setupSteps.filter((s) => !s.done).length;

  const scanToGoogle = percent(stats.googleOpened, stats.totalScans);

  const kpis = [
    {
      label: 'Sent to Google',
      value: formatCount(stats.googleOpened),
      context: stats.totalScans > 0 ? `${scanToGoogle}% of scans` : 'Customers who opened Google with a draft',
    },
    {
      label: 'QR scans',
      value: formatCount(stats.totalScans),
      context: stats.reviewStarted > 0 ? `${formatCount(stats.reviewStarted)} started a review` : 'Visits to your review page',
    },
    {
      label: 'Average rating',
      value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : '—',
      context: 'Last 90 days',
      star: stats.avgRating > 0,
    },
    {
      label: 'New private feedback',
      value: formatCount(stats.newFeedbackCount),
      context: `${formatCount(stats.privateFeedbackCount)} in total`,
      to: '/dashboard/feedback',
    },
  ];

  const funnel = [
    { label: 'Scanned the QR code', value: stats.totalScans },
    { label: 'Started a review', value: stats.reviewStarted },
    { label: 'Got an AI draft', value: stats.reviewsGenerated },
    { label: 'Opened Google to post', value: stats.googleOpened },
  ];
  const maxValue = Math.max(...funnel.map((f) => f.value), 1);

  return (
    <div>
      <PageHeader
        title="Overview"
        description="How your QR code is turning visits into Google reviews."
        actions={
          stats.refreshing ? (
            <span role="status" className="flex items-center gap-1.5 text-xs text-gray-600">
              <Spinner className="h-3.5 w-3.5" /> Updating
            </span>
          ) : undefined
        }
      />

      {setupRemaining > 0 && (
        <Card className="mt-6 p-5">
          <h2 className="text-sm font-semibold text-gray-900">
            Finish setting up <span className="font-normal text-gray-600">· {setupRemaining} left</span>
          </h2>
          <ul className="mt-3 divide-y divide-gray-100">
            {setupSteps.map((step) => (
              <li key={step.label} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <span
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                    step.done ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'
                  }`}
                  aria-hidden="true"
                >
                  {step.done ? <Check className="h-4 w-4" /> : <step.icon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium ${step.done ? 'text-gray-600 line-through' : 'text-gray-900'}`}>
                    {step.label}
                    {step.done && <span className="sr-only"> (done)</span>}
                  </p>
                  {!step.done && <p className="text-xs text-gray-600">{step.detail}</p>}
                </div>
                {!step.done && (
                  <Link
                    to={step.to}
                    className="inline-flex min-h-9 flex-shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
                  >
                    {step.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Key numbers. "Sent to Google" is first: it is the outcome the product exists for. */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {kpis.map((kpi, i) => {
          const body = (
            <>
              <p className="text-sm text-gray-600">{kpi.label}</p>
              <p className={`mt-1 flex items-center gap-1.5 font-bold tabular-nums text-gray-900 ${i === 0 ? 'text-3xl' : 'text-2xl'}`}>
                {kpi.value}
                {kpi.star && <Star className="h-5 w-5 fill-amber-400 text-amber-500" aria-hidden="true" />}
              </p>
              <p className="mt-1 text-xs text-gray-600">{kpi.context}</p>
            </>
          );
          return kpi.to ? (
            <Link
              key={kpi.label}
              to={kpi.to}
              className="rounded-2xl border border-gray-200 bg-white p-4 transition-colors hover:border-gray-300 hover:bg-gray-50 sm:p-5"
            >
              {body}
            </Link>
          ) : (
            <Card key={kpi.label} className={`p-4 sm:p-5 ${i === 0 ? 'border-blue-200 bg-blue-50/40' : ''}`}>
              {body}
            </Card>
          );
        })}
      </div>

      {/* Conversion funnel */}
      <Card className="mt-6 p-5 sm:p-6">
        <h2 className="text-sm font-semibold text-gray-900">From scan to Google</h2>
        <p className="mt-0.5 text-xs text-gray-600">Where customers drop off. The biggest drop is usually the best place to improve.</p>
        <ol className="mt-5 space-y-4">
          {funnel.map((stage, i) => {
            const previous = i > 0 ? funnel[i - 1].value : null;
            return (
              <li key={stage.label}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-gray-700">{stage.label}</span>
                  <span className="flex items-baseline gap-2">
                    {previous !== null && previous > 0 && (
                      <span className="text-xs text-gray-600">{percent(stage.value, previous)}% of previous</span>
                    )}
                    <span className="font-semibold tabular-nums text-gray-900">{formatCount(stage.value)}</span>
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-100" aria-hidden="true">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                    style={{ width: `${(stage.value / maxValue) * 100}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 border-t border-gray-100 pt-4 text-xs text-gray-600">
          “Opened Google to post” means the customer opened your Google review page with their draft copied — not
          that the review was published. Google doesn’t tell us that.
        </p>
      </Card>

      {/* Recent private feedback */}
      {stats.recentFeedback.length > 0 && (
        <Card className="mt-6 p-5 sm:p-6">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-gray-600" aria-hidden="true" />
            <h2 className="text-sm font-semibold text-gray-900">Recent private feedback</h2>
            <Link to="/dashboard/feedback" className="ml-auto inline-flex min-h-9 items-center rounded-lg px-2 text-sm font-medium text-blue-700 hover:bg-blue-50">
              View all<span className="sr-only"> private feedback</span>
            </Link>
          </div>
          <ul className="divide-y divide-gray-100">
            {stats.recentFeedback.map((fb) => (
              <li key={fb.id} className="flex flex-col gap-1.5 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-3">
                <div className="flex items-center gap-2 sm:w-32 sm:flex-shrink-0 sm:flex-col sm:items-start sm:gap-1">
                  {fb.rating ? (
                    <div className="flex items-center gap-0.5">
                      <span className="sr-only">{fb.rating} out of 5 stars</span>
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          aria-hidden="true"
                          className={`h-3.5 w-3.5 ${s <= (fb.rating ?? 0) ? 'fill-amber-400 text-amber-500' : 'text-gray-300'}`}
                        />
                      ))}
                    </div>
                  ) : null}
                  <span className="text-xs text-gray-600">
                    {new Date(fb.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                <p className="line-clamp-2 flex-1 text-sm text-gray-700">{fb.message}</p>
                <div className="flex-shrink-0">
                  <Badge variant={statusVariant[fb.status]}>{statusLabel[fb.status]}</Badge>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
