// Claude (Anthropic) text generation for the AI Edge Functions, selected with
// AI_PROVIDER=anthropic. The model comes from AI_MODEL when it names a Claude
// model, otherwise Claude Haiku 4.5: fast and inexpensive for short drafts.

import Anthropic from "npm:@anthropic-ai/sdk@0.129.0";

export { Anthropic };

export const DEFAULT_CLAUDE_MODEL = "claude-haiku-4-5";

export function claudeModel(): string {
  const configured = Deno.env.get("AI_MODEL")?.trim() ?? "";
  // AI_MODEL may still name a Gemini or OpenAI model from before the switch.
  return configured.startsWith("claude-") ? configured : DEFAULT_CLAUDE_MODEL;
}

/**
 * One Messages API call; returns the reply text. API failures surface as
 * Anthropic.APIError (with the HTTP status, or none for a connection error)
 * so each function can map them to its own retry and error handling.
 */
export async function claudeGenerate(options: {
  system: string;
  prompt: string;
  maxTokens: number;
  /** SDK retries on 408/409/429/5xx and connection errors. */
  maxRetries?: number;
}): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) throw new Error("Anthropic API key (ANTHROPIC_API_KEY) is not configured");

  // Needed only for an API key that is not scoped to one workspace: the
  // request must then name the workspace (Console > Workspaces, its ID).
  const workspaceId = Deno.env.get("ANTHROPIC_WORKSPACE_ID")?.trim();
  const client = new Anthropic({
    apiKey,
    maxRetries: options.maxRetries ?? 2,
    timeout: 30_000,
    ...(workspaceId ? { defaultHeaders: { "anthropic-workspace-id": workspaceId } } : {}),
  });
  const response = await client.messages.create({
    model: claudeModel(),
    max_tokens: options.maxTokens,
    system: options.system,
    messages: [{ role: "user", content: options.prompt }],
  });

  // A reply cut off mid-sentence is worse than a retry.
  if (response.stop_reason === "max_tokens") throw new Error("Claude stopped at the token limit");
  if (response.stop_reason === "refusal") throw new Error("Claude declined the request");
  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
  if (!text) throw new Error(`Claude returned an empty response (stop_reason: ${response.stop_reason})`);
  return text;
}
