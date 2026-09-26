import { Link, useOutletContext } from 'react-router-dom';
import { Star, TrendingUp, BarChart3, Lightbulb, QrCode } from 'lucide-react';
import { useDashboardStats } from '@/lib/use-dashboard-stats';
import { Alert, Button, Card, Skeleton, EmptyState, PageHeader } from '@/components/ui';
import { sourceLabel } from '@/lib/review-source';
import type { Business } from '@/lib/types';

export function AnalyticsPage() {
  const { business } = useOutletContext<{ business: Business | null }>();
  const stats = useDashboardStats(business);

  if (stats.loading) {
    return (
      <div role="status" aria-label="Loading analytics">
        <PageHeader title="Analytics" description="What customers rate you and what they mention." />
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="mt-4 h-64" />
      </div>
    );
  }

  if (stats.error) {
    return (
      <div>
        <PageHeader title="Analytics" />
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

  // Rating distribution
  const totalRatings = stats.ratingDistribution.reduce((a, b) => a + b, 0);
  // Events over last 7 days
  const last7Days = [...Array(7)].map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    return date;
  });

  const dailyEvents = last7Days.map((date) => {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    // QR scans only: mixing every event type into one bar said "something
    // happened" without saying what.
    const count = stats.events.filter((e) => {
      if (e.event_type !== 'qr_page_view') return false;
      const eventDate = new Date(e.created_at);
      return eventDate >= dayStart && eventDate <= dayEnd;
    }).length;
    return { date: date.toLocaleDateString('en', { weekday: 'short' }), count };
  });
  const maxDaily = Math.max(...dailyEvents.map((d) => d.count), 1);
  const weekScans = dailyEvents.reduce((sum, d) => sum + d.count, 0);

  // Insights derived by plain arithmetic over the business's own rows.
  const insights: string[] = [];
  if (stats.topTopics.length > 0) {
    insights.push(`Customers most frequently mention "${stats.topTopics[0].label}".`);
  }
  if (stats.topTopics.length > 1) {
    const second = stats.topTopics[1];
    const pct = totalRatings > 0 ? Math.round((second.count / totalRatings) * 100) : 0;
    insights.push(`"${second.label}" was picked in about ${pct}% of rated visits.`);
  }
  if (stats.avgRating > 0) {
    insights.push(`Your average customer rating is ${stats.avgRating.toFixed(1)} out of 5.`);
  }
  if (stats.googleOpened > 0 && stats.reviewsGenerated > 0) {
    const conversionRate = Math.round((stats.googleOpened / stats.reviewsGenerated) * 100);
    insights.push(`${conversionRate}% of generated reviews led to opening Google.`);
  }
  if (stats.privateFeedbackCount > 0) {
    insights.push(`You've received ${stats.privateFeedbackCount} private feedback message${stats.privateFeedbackCount > 1 ? 's' : ''}.`);
  }

  return (
    <div>
      <PageHeader title="Analytics" description="What customers rate you and what they mention." />

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
      {/* Rating distribution */}
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <Star className="h-4 w-4 text-gray-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900">Ratings</h2>
          <span className="ml-auto text-xs text-gray-600">
            {totalRatings > 0 ? `${totalRatings} in the last 90 days` : 'Last 90 days'}
          </span>
        </div>
        {totalRatings === 0 ? (
          <EmptyState
            title="No ratings yet"
            description="Each customer who scans your QR code and taps a star shows up here."
          />
        ) : (
          <div className="space-y-2.5">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = stats.ratingDistribution[star - 1];
              const pct = totalRatings > 0 ? (count / totalRatings) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <div className="flex w-10 items-center gap-1">
                    <span className="text-sm text-gray-700">{star}</span>
                    <Star className="h-3 w-3 text-amber-500 fill-amber-400" aria-hidden="true" />
                    <span className="sr-only">stars</span>
                  </div>
                  <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-amber-400 transition-[width] duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm tabular-nums text-gray-700">{count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Scans over 7 days */}
      <Card className="p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-gray-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900">QR scans, last 7 days</h2>
          <span className="ml-auto text-xs text-gray-600">{weekScans} this week</span>
        </div>
        <div className="flex items-end justify-between gap-1.5 sm:gap-2 h-32">
          {dailyEvents.map((day) => (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end h-24">
                <div
                  className="w-full rounded-t-md bg-blue-600 transition-[height] duration-500"
                  style={{ height: `${(day.count / maxDaily) * 100}%`, minHeight: day.count > 0 ? '8px' : '0' }}
                />
              </div>
              <span className="text-xs text-gray-600">{day.date}</span>
              <span className="text-xs font-medium tabular-nums text-gray-700">{day.count}</span>
            </div>
          ))}
        </div>
      </Card>
      </div>

      {/* Per-QR-code comparison. Shown once there is more than one way in;
          until then it explains how to get one. */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <QrCode className="h-4 w-4 text-gray-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900">Which QR code works best</h2>
          <span className="ml-auto text-xs text-gray-600">Last 90 days</span>
        </div>
        {stats.sources.length > 1 ? (
          <table className="w-full table-fixed text-left text-sm">
            <thead className="text-xs text-gray-600">
              <tr>
                <th scope="col" className="pb-2 font-medium">Source</th>
                <th scope="col" className="w-14 pb-2 text-right font-medium sm:w-20">Scans</th>
                <th scope="col" className="w-16 pb-2 text-right font-medium sm:w-24">To Google</th>
                <th scope="col" className="w-12 pb-2 text-right font-medium sm:w-16">Rate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {stats.sources.map((row) => (
                <tr key={row.id ?? 'main'}>
                  <td className="max-w-0 truncate py-2.5 pr-3 text-gray-900" title={sourceLabel(row.id)}>
                    {sourceLabel(row.id)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-gray-700">{row.scans.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 text-right tabular-nums text-gray-700">{row.googleOpened.toLocaleString('en-IN')}</td>
                  <td className="py-2.5 text-right tabular-nums font-medium text-gray-900">
                    {row.scans > 0 ? `${Math.round((row.googleOpened / row.scans) * 100)}%` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState
            title="Only one QR code so far"
            description="Make a separate QR code for each table, desk, or staff member, or send your link on WhatsApp — this table then shows which one brings in the most reviews."
            action={
              <Link to="/dashboard/qr" className="text-sm font-medium text-blue-700 underline underline-offset-2">
                Create QR codes
              </Link>
            }
          />
        )}
      </Card>

      {/* Most mentioned topics */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="mb-5 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-gray-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900">Most mentioned topics</h2>
          <span className="ml-auto text-xs text-gray-600">Last 90 days</span>
        </div>
        {stats.topTopics.length === 0 ? (
          <EmptyState
            title="No topics picked yet"
            description="When customers tap topics like “Staff” or “Cleanliness” during a review, the most popular ones are ranked here."
          />
        ) : (
          <div className="space-y-2.5">
            {stats.topTopics.map((topic) => {
              const maxCount = stats.topTopics[0]?.count ?? 1;
              return (
                <div key={topic.label} className="flex items-center gap-3">
                  <span className="w-28 truncate text-sm text-gray-700 sm:w-40" title={topic.label}>{topic.label}</span>
                  <div className="flex-1 h-3 rounded-full bg-gray-100 overflow-hidden" aria-hidden="true">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-[width] duration-500"
                      style={{ width: `${(topic.count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm tabular-nums text-gray-700">{topic.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Insights */}
      <Card className="mt-4 p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-gray-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-gray-900">What stands out</h2>
        </div>
        {insights.length === 0 ? (
          <EmptyState
            title="Nothing to point out yet"
            description="Short, plain observations appear here once a few customers have reviewed."
          />
        ) : (
          <ul className="list-disc space-y-2 pl-5 text-sm text-gray-700 marker:text-blue-600">
            {insights.map((insight) => (
              <li key={insight}>{insight}</li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-gray-600">
          Worked out from your own customers’ activity. Nothing here is estimated or invented.
        </p>
      </Card>
    </div>
  );
}
