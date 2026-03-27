import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";
import type { Service } from "./useServices";

/**
 * Lightweight hook for Dashboard metrics.
 * Fetches ONLY the columns needed by MetricsEngine/CoreServiceEngine,
 * avoiding the full `*, client:clients(*)` join used by useServices.
 *
 * This reduces payload size by ~80% compared to the full service query.
 */
export function useDashboardServices() {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  return useQuery({
    queryKey: ["dashboard-services", organizationId, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      let qb = supabase
        .from("services")
        .select("id, status, value, scheduled_date, created_at, document_type, service_type, client_id")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      if (!isDemoMode) {
        qb = qb.eq("is_demo_data", false);
      }

      const { data, error } = await qb.limit(1000);
      if (error) throw error;

      // Cast to Service with only the fields we need (others will be undefined but unused)
      return (data || []) as unknown as Service[];
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });
}
