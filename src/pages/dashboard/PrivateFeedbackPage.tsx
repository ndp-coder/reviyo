import { useState, useEffect } from 'react';
import { Link, useOutletContext, useSearchParams } from 'react-router-dom';
import { Star, MessageSquare, Check, RotateCcw, Eye } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { legal } from '@/config/legal';
import { Alert, Card, Skeleton, Badge, EmptyState, Button, PageHeader } from '@/components/ui';
import type { Business, PrivateFeedback, PrivateFeedbackStatus } from '@/lib/types';

type Filter = 'all' | PrivateFeedbackStatus;
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'New' },
  { key: 'seen', label: 'Seen' },
  { key: 'resolved', label: 'Resolved' },
];
const statusLabel: Record<PrivateFeedbackStatus, string> = { new: 'New', seen: 'Seen', resolved: 'Resolved' };
const statusVariants = { new: 'info', seen: 'default', resolved: 'success' } as const;

export function PrivateFeedbackPage() {
  const { business, refreshFeedbackCount } = useOutletContext<{
    business: Business | null;
    refreshFeedbackCount: () => Promise<void>;
  }>();
  const [feedback, setFeedback] = useState<PrivateFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // The filter is kept in the URL so it survives a reload and can be linked to.
  const [searchParams, setSearchParams] = useSearchParams();
  const requested = searchParams.get('status');
  const filter: Filter = FILTERS.some((f) => f.key === requested) ? (requested as Filter) : 'all';
  const setFilter = (next: Filter) => setSearchParams(next === 'all' ? {} : { status: next }, { replace: true });

  useEffect(() => {
    let cancelled = false;
    async function loadFeedback() {
      if (!business) return;
      setLoading(true);
      const { data, error } = await supabase
        .from('private_feedback')
        .select('*')
        .eq('business_id', business.id)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      setLoadError(Boolean(error));
      setFeedback((data as PrivateFeedback[]) ?? []);
      setLoading(false);
    }
    loadFeedback();
    return () => {
      cancelled = true;
    };
  }, [business, reloadKey]);

  // Status changes show immediately and are rolled back if the save fails —
  // they are small, reversible, and never destructive.
  async function updateStatus(id: string, status: PrivateFeedbackStatus) {
    const previous = feedback.find((f) => f.id === id)?.status;
    if (!previous) return;
    setUpdateError(null);
    setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status } : f)));
    const { error } = await supabase.from('private_feedback').update({ status }).eq('id', id);
    if (error) {
      setFeedback((prev) => prev.map((f) => (f.id === id ? { ...f, status: previous } : f)));
      setUpdateError('That change wasn’t saved. Check your connection and try again.');
      return;
    }
    void refreshFeedbackCount();
  }

  const counts = {
    all: feedback.length,
    new: feedback.filter((f) => f.status === 'new').length,
    seen: feedback.filter((f) => f.status === 'seen').length,
    resolved: feedback.filter((f) => f.status === 'resolved').length,
  };
  const filtered = filter === 'all' ? feedback : feedback.filter((f) => f.status === filter);

  return (
    <div>
      <PageHeader title="Private feedback" description="Messages customers sent only to you — never posted publicly." />

      {/* Filter */}
      <div role="group" aria-label="Filter feedback by status" className="mt-6 flex flex-wrap gap-1.5">
        {FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={filter === key}
            onClick={() => setFilter(key)}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-blue-700 text-white'
                : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {label}
            {!loading && (
              <span className={`tabular-nums text-xs ${filter === key ? 'text-blue-100' : 'text-gray-600'}`}>{counts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {loadError && (
        <Alert
          variant="error"
          className="mt-4"
          action={<Button size="sm" variant="outline" onClick={() => setReloadKey((k) => k + 1)}>Try again</Button>}
        >
          We couldn’t load your feedback. Check your connection and try again.
        </Alert>
      )}
      {updateError && <Alert variant="error" className="mt-4">{updateError}</Alert>}

      {/* Feedback list */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div role="status" aria-label="Loading feedback" className="space-y-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : loadError ? null : filtered.length === 0 ? (
          <Card className="p-6">
            {filter === 'all' ? (
              <EmptyState
                icon={<MessageSquare className="h-8 w-8" />}
                title="No private feedback yet"
                description="On your review page, customers can choose to message you privately instead of posting on Google. Those messages land here."
                action={
                  <Link to="/dashboard/qr" className="text-sm font-medium text-blue-700 underline underline-offset-2">
                    Preview your review page
                  </Link>
                }
              />
            ) : (
              <EmptyState
                title={`No ${statusLabel[filter].toLowerCase()} feedback`}
                description={filter === 'new' ? 'You’re all caught up.' : undefined}
                action={<Button size="sm" variant="outline" onClick={() => setFilter('all')}>Show all feedback</Button>}
              />
            )}
          </Card>
        ) : (
          filtered.map((fb) => (
            <Card key={fb.id} className={`p-4 sm:p-5 ${fb.status === 'new' ? 'border-blue-200' : ''}`}>
              <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {fb.rating && (
                  <div className="flex items-center gap-0.5">
                    <span className="sr-only">{fb.rating} out of 5 stars</span>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        aria-hidden="true"
                        className={`h-3.5 w-3.5 ${s <= fb.rating! ? 'fill-star text-star' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                )}
                <time dateTime={fb.created_at} className="text-xs text-gray-600">
                  {new Date(fb.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </time>
                <Badge variant={statusVariants[fb.status]}>{statusLabel[fb.status]}</Badge>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-gray-800">{fb.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {fb.status === 'new' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(fb.id, 'seen')}>
                    <Eye className="h-4 w-4" aria-hidden="true" /> Mark as seen
                  </Button>
                )}
                {fb.status !== 'resolved' && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(fb.id, 'resolved')}>
                    <Check className="h-4 w-4" aria-hidden="true" /> Mark resolved
                  </Button>
                )}
                {fb.status === 'resolved' && (
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(fb.id, 'new')}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reopen
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      <p className="mt-6 text-xs text-gray-600">
        Customers send these knowing only you will read them. Private feedback is deleted
        automatically after {legal.feedbackRetentionDays} days, as stated in our Privacy Policy.
      </p>
    </div>
  );
}
