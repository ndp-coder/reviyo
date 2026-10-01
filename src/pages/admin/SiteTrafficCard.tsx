import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Alert, Card, Skeleton } from '@/components/ui';

interface TrafficSummary {
  today: number;
  last_7_days: number;
  period_total: number;
  days: number;
  top_pages: { path: string; views: number }[];
  top_sources: { source: string; views: number }[];
}

const DAYS = 30;

function sourceLabel(source: string): string {
  if (!source) return 'Direct, WhatsApp, or unknown';
  return source;
}

/** Page views of revio.in's public pages, from the site_page_views counts. */
export function SiteTrafficCard() {
  const [summary, setSummary] = useState<TrafficSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.rpc('site_traffic_summary', { p_days: DAYS }).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) setFailed(true);
      else setSummary(data as TrafficSummary);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Card className="mt-6 p-5 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-900">Website visits</h2>
      <p className="mt-0.5 text-xs text-gray-600">
        Page views of revio.in&apos;s public pages. Counts only: no cookies, and nothing that identifies a
        visitor. Customer review pages are not included.
      </p>

      {failed ? (
        <Alert variant="info" className="mt-4">
          Visit counts aren&apos;t available yet. They start once the latest database update is applied
          (<code>supabase db push</code>).
        </Alert>
      ) : !summary ? (
        <div role="status" aria-label="Loading website visits" className="mt-4 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : (
        <>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            {[
              { label: 'Today', value: summary.today },
              { label: 'Last 7 days', value: summary.last_7_days },
              { label: `Last ${summary.days} days`, value: summary.period_total },
            ].map((stat) => (
              <div key={stat.label} className="rounded-lg bg-gray-50 p-3">
                <dt className="text-xs text-gray-600">{stat.label}</dt>
                <dd className="mt-1 text-xl font-bold tabular-nums text-gray-900">{stat.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {[
              {
                title: 'Top pages',
                rows: summary.top_pages.map((p) => ({ key: p.path, label: p.path === '/' ? 'Home (/)' : p.path, views: p.views })),
              },
              {
                title: 'Where visitors came from',
                rows: summary.top_sources.map((s) => ({ key: s.source || 'direct', label: sourceLabel(s.source), views: s.views })),
              },
            ].map((list) => (
              <div key={list.title}>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{list.title}</h3>
                {list.rows.length === 0 ? (
                  <p className="mt-2 text-sm text-gray-600">No visits in the last {summary.days} days yet.</p>
                ) : (
                  <ol className="mt-2 divide-y divide-gray-100">
                    {list.rows.map((row) => (
                      <li key={row.key} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                        <span className="min-w-0 truncate text-gray-700">{row.label}</span>
                        <span className="font-semibold tabular-nums text-gray-900">{row.views}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
