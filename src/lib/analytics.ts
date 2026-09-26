import { supabase } from '@/lib/supabase';
import type { AnalyticsEventType } from '@/lib/types';

export async function trackEvent(
  businessSlug: string,
  sessionToken: string | null,
  eventType: AnalyticsEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    // supabase.rpc reports failures in its result rather than throwing.
    const { error } = await supabase.rpc('track_event', {
      p_business_slug: businessSlug,
      p_session_token: sessionToken,
      p_event_type: eventType,
      p_metadata: metadata,
    });
    if (error) console.warn(`Event ${eventType} was not recorded:`, error.message);
  } catch (err) {
    console.error('Failed to track event:', err);
  }
}
