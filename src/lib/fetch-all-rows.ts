/**
 * Supabase's API returns at most 1,000 rows per request (the project's
 * max_rows setting) whatever .limit() asks for, and says nothing when it stops
 * short. Lists that can grow past that are read a page at a time instead.
 */
export const PAGE_SIZE = 1000;

type PageResult<T> = PromiseLike<{ data: T[] | null; error: unknown }>;

/**
 * Reads every row a query matches, up to maxRows. `page(from, to)` must return
 * rows from..to (inclusive) of a query with a stable, unique order, or pages
 * could overlap or skip rows.
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PageResult<T>,
  maxRows = 50_000
): Promise<T[]> {
  const rows: T[] = [];
  while (rows.length < maxRows) {
    const from = rows.length;
    const { data, error } = await page(from, Math.min(from + PAGE_SIZE, maxRows) - 1);
    if (error) throw error;
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }
  return rows;
}
