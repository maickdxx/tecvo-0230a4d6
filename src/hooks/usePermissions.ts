import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

export function usePermissions() {
  const { user } = useAuth();
  const { role, isOwner } = useUserRole();

  const { data: permissions = [], isLoading } = useQuery({
    queryKey: ["member-permissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_permissions")
        .select("module")
        .eq("user_id", user!.id);

      if (error) throw error;
      return data?.map(r => r.module) || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const hasPermission = (module: string): boolean => {
    // Owner always has full access
    if (isOwner) return true;
    // If permissions loaded and user has permissions.manage, full access
    if (permissions.includes("permissions.manage")) return true;
    // Check specific permission
    return permissions.includes(module);
  };

  return {
    permissions,
    hasPermission,
    isLoading,
  };
}
