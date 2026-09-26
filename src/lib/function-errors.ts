/**
 * supabase.functions.invoke() reports any non-2xx reply as "Edge Function
 * returned a non-2xx status code" and hides the function's own message. Our
 * functions always reply with { error: "..." }, so read that for the user.
 */
export async function readFunctionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === 'function') {
    const body = (await context.json().catch(() => null)) as { error?: unknown } | null;
    if (body && typeof body.error === 'string' && body.error) return body.error;
  }
  return fallback;
}
