import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfWeek, endOfWeek, format } from "date-fns";

export interface RankingEntry {
  userId: string;
  fullName: string;
  completedCount: number;
  revenue: number;
}

export function useWeeklyRanking() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ["weekly-ranking", organizationId],
    queryFn: async (): Promise<RankingEntry[]> => {
      if (!organizationId) return [];

      const now = new Date();
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

      // Get completed services this week
      const { data: services } = await supabase
        .from("services")
        .select("assigned_to, value, completed_date")
        .eq("status", "completed")
        .is("deleted_at", null)
        .gte("completed_date", weekStart.toISOString())
        .lte("completed_date", weekEnd.toISOString());

      if (!services || services.length === 0) return [];

      // Aggregate by assigned_to (only field technicians / employees)
      // Get employee role users to filter
      const { data: employeeRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "employee");

      const employeeIds = new Set((employeeRoles || []).map(r => r.user_id));

      if (!services || services.length === 0) return [];

      // Aggregate by assigned_to
      const map = new Map<string, { count: number; revenue: number }>();
      // Only count field technicians (employees) in ranking
      for (const s of services) {
        if (!s.assigned_to) continue;
        if (employeeIds.size > 0 && !employeeIds.has(s.assigned_to)) continue;
        const entry = map.get(s.assigned_to) || { count: 0, revenue: 0 };
        entry.count++;
        entry.revenue += s.value || 0;
        map.set(s.assigned_to, entry);
      }

      // Get profile names
      const userIds = [...map.keys()];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);

      const nameMap = new Map(
        (profiles || []).map((p) => [p.user_id, p.full_name || "Sem nome"])
      );

      return userIds
        .map((uid) => ({
          userId: uid,
          fullName: nameMap.get(uid) || "Sem nome",
          completedCount: map.get(uid)!.count,
          revenue: map.get(uid)!.revenue,
        }))
        .sort((a, b) => b.completedCount - a.completedCount);
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });
}
