import { validateGoogleReviewUrl } from '@/lib/url-safety';

export const MAX_PARTNER_TOPICS = 20;
export const MAX_PARTNER_TOPIC_LENGTH = 80;

/** Keep the first spelling and order, while ignoring empty and repeated lines. */
export function parsePartnerTopics(value: string): string[] {
  const seen = new Set<string>();
  return value.split('\n').map((topic) => topic.trim()).filter((topic) => {
    const key = topic.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function validatePartnerDetails(name: string, category: string, google: string, topics: string[]): string | null {
  if (!name.trim() || name.trim().length > 200) return 'Enter a business name with 1–200 characters.';
  if (!category.trim() || category.trim().length > 100) return 'Choose a business category or describe the business.';
  const urlProblem = validateGoogleReviewUrl(google);
  if (urlProblem) return urlProblem;
  if (topics.length < 1 || topics.length > MAX_PARTNER_TOPICS) return 'Add between 1 and 20 review topics.';
  if (topics.some((topic) => !topic.trim() || topic.length > MAX_PARTNER_TOPIC_LENGTH)) return 'Keep each review topic between 1 and 80 characters.';
  return null;
}
