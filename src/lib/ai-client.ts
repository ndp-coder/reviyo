import type { AIReviewRequest, AIReviewResponse } from '@/lib/types';
import { supabase, supabasePublicKey, supabaseUrl } from '@/lib/supabase';
import { readFunctionError } from '@/lib/function-errors';

const EDGE_FUNCTION_URL = `${supabaseUrl}/functions/v1/generate-review`;


export async function generateReview(
  sessionToken: string,
  request: AIReviewRequest
): Promise<AIReviewResponse> {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabasePublicKey || '',
    },
    body: JSON.stringify({
      sessionToken,
      ...request,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error ?? `Request failed (${response.status})`;
    return { review: '', error: message };
  }

  const data = await response.json();
  return { review: data.review ?? '', error: data.error };
}

/**
 * Asks the suggest-topics Edge Function for review topics that fit this
 * business. Requires a signed-in owner; supabase-js attaches their session.
 */
export async function suggestTopics(request: {
  businessName: string;
  category: string;
  existingTopics: string[];
}): Promise<{ topics: string[]; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke<{ topics?: string[]; error?: string }>(
      'suggest-topics',
      { body: request }
    );
    if (error) {
      return { topics: [], error: await readFunctionError(error, 'Could not suggest topics. Please try again.') };
    }
    const topics = Array.isArray(data?.topics) ? data.topics.filter((t): t is string => typeof t === 'string') : [];
    return topics.length > 0 ? { topics } : { topics: [], error: data?.error ?? 'No new topics were suggested.' };
  } catch {
    return { topics: [], error: 'Could not reach the server. Check your connection and try again.' };
  }
}
