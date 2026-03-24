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
        .from("data_audit_log")
        .select(`
          id,
          operation,
          user_id,
          organization_id,
          metadata,
          created_at
        `)
        .order("created_at", { ascending: false })
        .limit(filters?.limit || 100);

      if (filters?.action) {
        query = query.eq("operation", filters.action);
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

      // Map data_audit_log fields to SystemLog interface
      const logs: SystemLog[] = (data || []).map((log) => ({
        id: log.id,
        action: log.operation,
        user_id: log.user_id || "",
        organization_id: log.organization_id,
        metadata: (log.metadata as Record<string, any>) || {},
        created_at: log.created_at,
      }));

      return logs;
    },
    enabled: isSuperAdmin,
  });

  return {
    logs: logs || [],
    isLoading,
  };
}
