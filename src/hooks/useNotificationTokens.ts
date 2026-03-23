import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PushTokenInfo {
  userIds: Set<string>;
  deviceCounts: Map<string, number>;
}

export function useNotificationTokens(enabled: boolean) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-notification-tokens"],
    queryFn: async (): Promise<PushTokenInfo> => {
      const { data, error } = await supabase
        .from("notification_tokens")
        .select("user_id");

      if (error) throw error;

      const userIds = new Set<string>();
      const deviceCounts = new Map<string, number>();

      (data || []).forEach((row) => {
        userIds.add(row.user_id);
        deviceCounts.set(row.user_id, (deviceCounts.get(row.user_id) || 0) + 1);
      });

      return { userIds, deviceCounts };
    },
    enabled,
  });

  return {
    pushInfo: data ?? { userIds: new Set<string>(), deviceCounts: new Map<string, number>() },
    isLoading,
  };
}
