import { useState } from 'react';
import { Lightbulb, Plus } from 'lucide-react';
import { Button } from '@/components/ui';
import { suggestTopics } from '@/lib/ai-client';

interface AiTopicSuggestionsProps {
  businessName: string;
  /** The category label or the owner's own typed category. */
  category: string;
  existingTopics: string[];
  onAdd: (topics: string[]) => void;
  /** How many more topics may be added; suggestions beyond this are disabled. */
  remaining?: number;
}

/**
 * "Suggest topics with AI" button plus the suggestions it returns. Nothing is
 * added until the owner picks a suggestion, so their own list is never
 * overwritten.
 */
export function AiTopicSuggestions({
  businessName,
  category,
  existingTopics,
  onAdd,
  remaining = Infinity,
}: AiTopicSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const taken = new Set(existingTopics.map((t) => t.trim().toLowerCase()));
  const visible = suggestions.filter((s) => !taken.has(s.toLowerCase()));
  const canAdd = remaining > 0;

  async function handleSuggest() {
    setLoading(true);
    setError(null);
    const result = await suggestTopics({
      businessName: businessName.trim(),
      category: category.trim(),
      existingTopics,
    });
    setLoading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSuggestions(result.topics);
  }

  return (
    <div className="rounded-lg border border-accent-200 bg-accent-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-accent-900">
          Not sure what to add? Let AI suggest topics for your kind of business.
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSuggest}
          loading={loading}
          disabled={loading || !businessName.trim() || !category.trim()}
        >
          <Lightbulb className="h-4 w-4 text-accent-700" aria-hidden="true" />
          {suggestions.length > 0 ? 'Suggest more' : 'Suggest topics with AI'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-red-800">
          {error}
        </p>
      )}

      {visible.length > 0 && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-1.5" aria-label="AI suggested topics" role="group">
            {visible.map((topic) => (
              <button
                key={topic}
                type="button"
                onClick={() => onAdd([topic])}
                disabled={!canAdd}
                aria-label={`Add suggested topic ${topic}`}
                className="inline-flex items-center gap-1 rounded-full border border-accent-300 bg-white px-2.5 py-1 text-xs text-accent-900 hover:bg-accent-100 disabled:opacity-50"
              >
                <Plus className="h-3 w-3" aria-hidden="true" /> {topic}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={() => onAdd(visible.slice(0, Math.max(0, remaining)))}
              disabled={!canAdd}
              className="text-xs font-medium text-accent-900 underline underline-offset-2 disabled:opacity-50"
            >
              Add all
            </button>
            {!canAdd && (
              <span role="status" className="text-xs text-gray-700">
                You've reached the 20-topic limit. Remove one to add another.
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
