import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "./useSuperAdmin";

export interface UserEngagementMetrics {
  user_id: string;
  avg_session_seconds: number;
  last_session_duration_seconds: number;
  accesses_7d: number;
  accesses_30d: number;
  services_created_30d: number;
  used_agenda: boolean;
  used_finance: boolean;
  used_weather_art: boolean;
  has_any_action: boolean;
  engagement_score: number;
  engagement_level: "active" | "warm" | "risk";
}

export function useEngagementMetrics() {
  const { isSuperAdmin } = useSuperAdmin();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-engagement-metrics"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_user_engagement_metrics");
      if (error) throw error;
      return (data as unknown as UserEngagementMetrics[]) ?? [];
    },
    enabled: isSuperAdmin,
  });

  const metricsMap = new Map<string, UserEngagementMetrics>();
  (data ?? []).forEach((m) => metricsMap.set(m.user_id, m));

  return { metricsMap, isLoading };
}
