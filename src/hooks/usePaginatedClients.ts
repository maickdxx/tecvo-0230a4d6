import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";
import type { Client } from "./useClients";

const PAGE_SIZE = 50;

export function usePaginatedClients(searchTerm: string = "") {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  const result = useInfiniteQuery({
    queryKey: ["clients", "paginated", organizationId, isDemoMode, searchTerm],
    queryFn: async ({ pageParam = 0 }) => {
      if (!organizationId) return { data: [] as Client[], totalCount: 0, nextCursor: undefined };

      let queryBuilder = supabase
        .from("clients")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .order("name");

      if (!isDemoMode) {
        queryBuilder = queryBuilder.eq("is_demo_data", false);
      }

      if (searchTerm) {
        queryBuilder = queryBuilder.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`);
      }

      const { data, error, count } = await queryBuilder.range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;

      return {
        data: (data ?? []) as Client[],
        totalCount: count ?? 0,
        nextCursor: (data?.length ?? 0) === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!organizationId,
  });

  const allClients = result.data?.pages.flatMap(p => p.data) ?? [];
  const totalCount = result.data?.pages[0]?.totalCount ?? 0;

  return {
    clients: allClients,
    totalCount,
    isLoading: result.isLoading,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: !!result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    refetch: result.refetch,
  };
}
