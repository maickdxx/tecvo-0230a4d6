import { supabase } from "@/integrations/supabase/client";

const PAGE_SIZE = 1000;

/**
 * Fetches ALL rows from a Supabase query by paginating through results.
 * Overcomes the default 1000-row limit.
 *
 * Usage:
 *   const data = await fetchAllRows(
 *     supabase.from("services").select("*, client:clients(*)").eq("organization_id", orgId).is("deleted_at", null),
 *   );
 *
 * @param queryBuilder - A Supabase query builder (before calling .range or executing)
 * @param pageSize - Number of rows per page (default: 1000)
 * @returns All rows combined
 */
export async function fetchAllRows<T = any>(
  queryBuilder: any,
  pageSize: number = PAGE_SIZE
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

/**
 * Same as fetchAllRows but for Supabase Admin client (edge functions).
 * Pass the query builder directly.
 */
export async function fetchAllRowsAdmin<T = any>(
  queryBuilder: any,
  pageSize: number = PAGE_SIZE
): Promise<T[]> {
  return fetchAllRows<T>(queryBuilder, pageSize);
}
