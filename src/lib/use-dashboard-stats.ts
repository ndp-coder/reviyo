import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { AnalyticsEvent, PrivateFeedback, Business } from '@/lib/types';

export interface DashboardStats {
  totalScans: number;
  reviewStarted: number;
  reviewsGenerated: number;
  googleOpened: number;
  privateFeedbackCount: number;
  newFeedbackCount: number;
  avgRating: number;
  ratingDistribution: number[];
  topTopics: { label: string; count: number }[];
  recentFeedback: (PrivateFeedback & { rating: number | null })[];
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
  avgRating: 0,
  ratingDistribution: [0, 0, 0, 0, 0],
  topTopics: [],
  recentFeedback: [],
  events: [],
  loading: true,
  refreshing: false,
  error: null,
};

// Last result per business, kept for this browser tab. Moving between Overview
// and Analytics shows these numbers immediately while fresh ones load, instead
// of a skeleton every time.
const cache = new Map<string, DashboardStats>();

async function fetchStats(business: Business): Promise<DashboardStats> {
  const eventCount = (types: string[]) =>
    supabase
      .from('analytics_events')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', business.id)
      .in('event_type', types);

  // Totals are exact counts. (They used to be counted from the latest 500
  // events, which silently capped every number for busier businesses.)
  const [scansRes, startedRes, generatedRes, googleRes, feedbackCountRes, newFeedbackRes, eventsRes, feedbackRes, sessionsRes] =
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
      // Only the rating is needed; sessions are purged after 90 days.
      supabase.from('review_sessions').select('rating').eq('business_id', business.id).not('rating', 'is', null).order('created_at', { ascending: false }).limit(2000),
    ]);

  const queryError =
    scansRes.error ?? startedRes.error ?? generatedRes.error ?? googleRes.error ??
    feedbackCountRes.error ?? newFeedbackRes.error ?? eventsRes.error ?? feedbackRes.error ?? sessionsRes.error;
  if (queryError) throw queryError;

  const events = (eventsRes.data as DashboardStats['events']) ?? [];
  const feedback = (feedbackRes.data as PrivateFeedback[]) ?? [];
  const ratedSessions = (sessionsRes.data as { rating: number | null }[]) ?? [];
  const avgRating = ratedSessions.length > 0
    ? ratedSessions.reduce((sum, s) => sum + (s.rating ?? 0), 0) / ratedSessions.length
    : 0;

  const ratingDistribution = [1, 2, 3, 4, 5].map((star) =>
    ratedSessions.filter((s) => s.rating === star).length
  );

  // Topic counts in one request, filtered through the session's business.
  // Sessions are purged after 90 days, so this covers recent visits.
  let topTopics: { label: string; count: number }[] = [];
  if (ratedSessions.length > 0) {
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
    avgRating,
    ratingDistribution,
    topTopics,
    recentFeedback: feedback,
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
