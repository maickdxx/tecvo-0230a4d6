import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "./useSuperAdmin";

export interface SystemLog {
  id: string;
  action: string;
  user_id: string;
  organization_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
  user_email?: string;
  organization_name?: string;
}

export function useSystemLogs(filters?: {
  action?: string;
  userId?: string;
  organizationId?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const { isSuperAdmin } = useSuperAdmin();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["system-logs", filters],
    queryFn: async (): Promise<SystemLog[]> => {
      let query = supabase
        .from("audit_logs")
        .select(`
          id,
          action,
          user_id,
          organization_id,
          metadata,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.action) {
        query = query.eq("action", filters.action);
      }

      if (filters?.userId) {
        query = query.eq("user_id", filters.userId);
      }

      if (filters?.organizationId) {
        query = query.eq("organization_id", filters.organizationId);
      }

      if (filters?.startDate) {
        query = query.gte("created_at", filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte("created_at", filters.endDate);
      }

      const { data, error } = await query;

      if (error) throw error;

      const logsWithDetails = await Promise.all(
        (data || []).map(async (log) => {
          const userEmail = log.user_id
            ? (await supabase.auth.admin.getUserById(log.user_id)).data.user?.email
            : undefined;

          const orgName = log.organization_id
            ? (await supabase.from("organizations").select("name").eq("id", log.organization_id).single()).data?.name
            : undefined;

          return {
            ...log,
            user_email: userEmail,
            organization_name: orgName,
          };
        })
      );

      return logsWithDetails;
    },
    enabled: isSuperAdmin,
  });

  return {
    logs: logs || [],
    isLoading,
  };
}
