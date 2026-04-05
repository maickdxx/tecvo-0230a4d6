import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";
import type { Service, DocumentType } from "./useServices";

const PAGE_SIZE = 50;

interface UsePaginatedServicesOptions {
  clientId?: string;
  documentType?: DocumentType;
  assignedTo?: string;
  statusFilter?: string;
}

export function usePaginatedServices(options?: UsePaginatedServicesOptions) {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const clientId = options?.clientId;
  const documentType = options?.documentType;
  const assignedTo = options?.assignedTo;
  const statusFilter = options?.statusFilter;

  const result = useInfiniteQuery({
    queryKey: ["services", "paginated", organizationId, clientId, documentType, assignedTo, isDemoMode, statusFilter],
    queryFn: async ({ pageParam = 0 }) => {
      if (!organizationId) return { data: [] as Service[], totalCount: 0, nextCursor: undefined };

      let queryBuilder = supabase
        .from("services")
        .select("*, client:clients(*)", { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!isDemoMode) {
        queryBuilder = queryBuilder.eq("is_demo_data", false);
      }
      if (clientId) queryBuilder = queryBuilder.eq("client_id", clientId);
      if (documentType) queryBuilder = queryBuilder.eq("document_type", documentType);
      if (assignedTo) queryBuilder = queryBuilder.eq("assigned_to", assignedTo);
      if (statusFilter && statusFilter !== "all") {
        queryBuilder = queryBuilder.eq("status", statusFilter as any);
      }

      const { data, error, count } = await queryBuilder.range(pageParam, pageParam + PAGE_SIZE - 1);
      if (error) throw error;

      // Fetch assigned technician names
      const assignedIds = [...new Set((data || []).map(s => s.assigned_to).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};

      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", assignedIds);
        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || ""]));
        }
      }

      const services = (data || []).map(s => ({
        ...s,
        assigned_profile: s.assigned_to && profilesMap[s.assigned_to]
          ? { full_name: profilesMap[s.assigned_to] }
          : null,
      })) as Service[];

      return {
        data: services,
        totalCount: count ?? 0,
        nextCursor: (data?.length ?? 0) === PAGE_SIZE ? pageParam + PAGE_SIZE : undefined,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: 0,
    enabled: !!organizationId,
  });

  const allServices = result.data?.pages.flatMap(p => p.data) ?? [];
  const totalCount = result.data?.pages[0]?.totalCount ?? 0;

  return {
    services: allServices,
    totalCount,
    isLoading: result.isLoading,
    isFetchingNextPage: result.isFetchingNextPage,
    hasNextPage: !!result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
  };
}
