import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "owner" | "admin" | "member" | "employee";

export function useUserRole() {
  const { user, profile } = useAuth();

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      if (error) throw error;
      return data?.map(r => r.role as AppRole) || [];
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
  });

  const { data: permissions = [] } = useQuery({
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

  const rolePriority: AppRole[] = ["owner", "admin", "member", "employee"];
  const primaryRole = rolePriority.find(r => roles?.includes(r)) || "member";

  const isAdmin = primaryRole === "admin" || primaryRole === "owner";
  const isOwner = primaryRole === "owner";
  const isMember = primaryRole === "member";

  // field_worker flag from profile - independent of role
  const isFieldWorker = !!(profile as any)?.field_worker;

  // Granular permission check with role-based fallback
  const hasPermission = (module: string): boolean => {
    if (isOwner) return true;
    if (permissions.includes("permissions.manage")) return true;
    return permissions.includes(module);
  };

  // Enhanced flags using granular permissions when available
  const hasAnyPermissions = permissions.length > 0;

  const canEdit = hasAnyPermissions
    ? hasPermission("service.edit") || hasPermission("client.edit") || hasPermission("catalog.edit")
    : primaryRole !== "employee";

  const canCreate = hasAnyPermissions
    ? hasPermission("service.create") || hasPermission("client.create") || hasPermission("catalog.create")
    : primaryRole !== "employee";

  const canDelete = hasAnyPermissions
    ? hasPermission("service.delete") || hasPermission("client.delete") || hasPermission("catalog.delete")
    : isOwner || isAdmin;

  // Role label mapping for UI
  const roleLabel = ROLE_LABELS[primaryRole];

  return {
    role: primaryRole,
    isLoading: isLoadingRoles,
    isEmployee: primaryRole === "employee",
    isFieldWorker,
    isMember,
    isAdmin,
    isOwner,
    canEdit,
    canCreate,
    canDelete,
    hasPermission,
    roleLabel,
  };
}

export const ROLE_LABELS: Record<AppRole, string> = {
  owner: "Gestor",
  admin: "ADM",
  member: "Atendente",
  employee: "Funcionário",
};
