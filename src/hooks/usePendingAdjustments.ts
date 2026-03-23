import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePendingAdjustmentsCount() {
  const { profile } = useAuth();
  const orgId = (profile as any)?.organization_id;

  const { data: count = 0 } = useQuery({
    queryKey: ["pending-adjustments-count", orgId],
    queryFn: async () => {
      const [adjRes, incRes] = await Promise.all([
        supabase
          .from("time_clock_adjustments")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "pending"),
        supabase
          .from("time_clock_inconsistencies")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("status", "pending"),
      ]);
      return (adjRes.count || 0) + (incRes.count || 0);
    },
    enabled: !!orgId,
    refetchInterval: 30000,
  });

  return count;
}
