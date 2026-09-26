import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { dashboardStatsCache } from '@/lib/dashboard-stats-cache';
import type { AnalyticsEvent, PrivateFeedback, Business } from '@/lib/types';

export interface DashboardStats {
  totalScans: number;
  reviewStarted: number;
  reviewsGenerated: number;
  googleOpened: number;
  privateFeedbackCount: number;
  newFeedbackCount: number;
  /** What customers tapped as liked, most first (last 90 days of sessions). */
  topTopics: { label: string; count: number }[];
  recentFeedback: (PrivateFeedback & { rating: number | null })[];
  /** Scans and Google hand-offs per QR code or link (?src), last 90 days. */
  sources: { id: string | null; scans: number; googleOpened: number }[];
  /** QR scans from the last 7 days, for the daily chart. */
  events: Pick<AnalyticsEvent, 'event_type' | 'created_at'>[];
  loading: boolean;
  /** True while cached numbers are shown and fresh ones are on the way. */
  refreshing: boolean;
  error: string | null;
}

interface SessionTopicRow {
  topic_id: string;
  review_topics: { label: string } | { label: string }[] | null;
}

const EMPTY: DashboardStats = {
  totalScans: 0,
  reviewStarted: 0,
  reviewsGenerated: 0,
  googleOpened: 0,
  privateFeedbackCount: 0,
  newFeedbackCount: 0,
  topTopics: [],
  recentFeedback: [],
  sources: [],
  events: [],
  loading: true,
  refreshing: false,
  error: null,
};

const cache = dashboardStatsCache;

async function fetchStats(business: Business): Promise<DashboardStats> {
  const eventCount = (types: string[]) =>
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .in('event_type', types);

  // Totals are exact counts. (They used to be counted from the latest 500
  // events, which silently capped every number for busier businesses.)
  const [scansRes, startedRes, generatedRes, googleRes, feedbackCountRes, newFeedbackRes, eventsRes, feedbackRes, sourcesRes] =
    await Promise.all([
      eventCount(['qr_page_view']),
      eventCount(['review_started']),
      eventCount(['review_generated', 'review_regenerated']),
      eventCount(['google_review_opened']),
      supabase.from('private_feedback').select('id', { count: 'exact', head: true }).eq('business_id', business.id),
      supabase
        .from('private_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', business.id)
        .eq('status', 'new'),
      supabase
        .from('analytics_events')
        .select('event_type, created_at')
        .eq('business_id', business.id)
        .eq('event_type', 'qr_page_view')
        .gte('created_at', new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString())
        .limit(10000),
      supabase.from('private_feedback').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(5),
      // Only the event type and its ?src tag, for the per-QR-code breakdown.
      supabase
        .from('analytics_events')
        .select('event_type, source:metadata->>source')
        .eq('business_id', business.id)
        .in('event_type', ['qr_page_view', 'google_review_opened'])
        .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .limit(20000),
    ]);

  const queryError =
    scansRes.error ?? startedRes.error ?? generatedRes.error ?? googleRes.error ??
    feedbackCountRes.error ?? newFeedbackRes.error ?? eventsRes.error ?? feedbackRes.error ?? sourcesRes.error;
  if (queryError) throw queryError;

  const events = (eventsRes.data as DashboardStats['events']) ?? [];
  const feedback = (feedbackRes.data as PrivateFeedback[]) ?? [];

  const bySource = new Map<string | null, { id: string | null; scans: number; googleOpened: number }>();
  for (const row of (sourcesRes.data as { event_type: string; source: string | null }[]) ?? []) {
    const id = row.source || null;
    const entry = bySource.get(id) ?? { id, scans: 0, googleOpened: 0 };
    if (row.event_type === 'qr_page_view') entry.scans += 1;
    else entry.googleOpened += 1;
    bySource.set(id, entry);
  }
  const sources = [...bySource.values()].sort((a, b) => b.scans - a.scans);

  // Topic counts in one request, filtered through the session's business.
  // Sessions are purged after 90 days, so this covers recent visits. Skipped
  // until the first review has been started, when there cannot be any.
  let topTopics: { label: string; count: number }[] = [];
  if ((startedRes.count ?? 0) > 0) {
    const { data: sessionTopics, error: sessionTopicsError } = await supabase
      .from('review_session_topics')
      .select('topic_id, review_topics(label), review_sessions!inner(business_id)')
      .eq('review_sessions.business_id', business.id)
      .limit(5000);
    if (sessionTopicsError) throw sessionTopicsError;

    const counts = new Map<string, { label: string; count: number }>();
    for (const row of (sessionTopics ?? []) as SessionTopicRow[]) {
      const joined = Array.isArray(row.review_topics) ? row.review_topics[0] : row.review_topics;
      const entry = counts.get(row.topic_id) ?? { label: joined?.label ?? 'Removed topic', count: 0 };
      entry.count += 1;
      counts.set(row.topic_id, entry);
    }
    topTopics = [...counts.values()].sort((x, y) => y.count - x.count).slice(0, 10);
  }

  return {
    totalScans: scansRes.count ?? 0,
    reviewStarted: startedRes.count ?? 0,
    reviewsGenerated: generatedRes.count ?? 0,
    googleOpened: googleRes.count ?? 0,
    privateFeedbackCount: feedbackCountRes.count ?? 0,
    newFeedbackCount: newFeedbackRes.count ?? 0,
    topTopics,
    recentFeedback: feedback,
    sources,
    events,
    loading: false,
    refreshing: false,
    error: null,
  };
}

export function useDashboardStats(business: Business | null): DashboardStats & { reload: () => void } {
  const cached = business ? cache.get(business.id) : undefined;
  const [stats, setStats] = useState<DashboardStats>(cached ? { ...cached, refreshing: true } : EMPTY);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!business) return;
    let cancelled = false;

    fetchStats(business)
      .then((fresh) => {
        cache.set(business.id, fresh);
        if (!cancelled) setStats(fresh);
      })
      .catch(() => {
        if (cancelled) return;
        // Cached numbers stay on screen if a background refresh fails; the
        // error only replaces the page when there is nothing to show.
        setStats((prev) =>
          prev.loading
            ? { ...prev, loading: false, refreshing: false, error: 'We couldn’t load your numbers. Check your connection and try again.' }
            : { ...prev, refreshing: false }
        );
      });

    return () => {
      cancelled = true;
    };
  }, [business, attempt]);

  const reload = useCallback(() => {
    setStats((prev) => ({ ...prev, loading: !cache.has(business?.id ?? ''), refreshing: true, error: null }));
    setAttempt((n) => n + 1);
  }, [business]);

  return { ...stats, reload };
}
