/**
 * Fetches ALL rows from a Supabase query by paginating through results.
 * Overcomes the default 1000-row limit in Edge Functions.
 */
export async function fetchAllRows<T = any>(
  queryBuilder: any,
  pageSize: number = 1000
): Promise<T[]> {
  const allRows: T[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await queryBuilder.range(from, from + pageSize - 1);
    if (error) throw error;
    if (data && data.length > 0) {
      allRows.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  return allRows;
}
