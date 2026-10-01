import { Card, EmptyState } from '@/components/ui';
import { developerDate, type DeveloperOperations } from '@/pages/admin/developer-types';

export function DeveloperActivity({ rows }: { rows: DeveloperOperations['activity'] }) {
  return <section className="mt-6 space-y-4" aria-labelledby="developer-activity-heading"><h2 id="developer-activity-heading" className="text-lg font-semibold">Developer activity</h2><p className="text-sm text-gray-600">The latest 30 review-page access changes, with who made the change and why.</p>{!rows.length ? <Card><EmptyState title="No access changes yet" description="Business pauses and restores will be recorded here." /></Card> : <ol className="space-y-3">{rows.map((a) => <li key={a.id}><Card className="p-4"><p className="font-semibold">{a.business_name} · {a.action === 'pause_business' ? 'Review page paused' : 'Review page restored'}</p><p className="mt-2 break-words text-sm text-gray-700">{a.reason}</p><p className="mt-3 break-all text-xs text-gray-600">{a.actor_email || 'Former developer account'} · {developerDate(a.created_at)}</p></Card></li>)}</ol>}</section>;
}
