import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ROLE_PRESETS } from "@/lib/permissionsConfig";

export type AppRole = "owner" | "admin" | "member" | "employee" | "super_admin";

export function useUserRole() {
  const { user, profile, isLoading: isLoadingAuth } = useAuth();
  const organizationId = profile?.organization_id;

  const { data: roles, isLoading: isLoadingRoles } = useQuery({
    queryKey: ["user-role", user?.id, organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("organization_id", organizationId!);

      if (error) throw error;
      return data?.map(r => r.role as AppRole) || [];
    },
    enabled: !!user && !!organizationId,
    staleTime: 1000 * 60 * 5,
  });

  const { data: permissions = [], isLoading: isLoadingPermissions } = useQuery({
    queryKey: ["member-permissions", user?.id, organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_permissions")
        .select("module")
        .eq("user_id", user!.id)
        .eq("organization_id", organizationId!);

      if (error) throw error;
      return data?.map(r => r.module) || [];
    },
    enabled: !!user && !!organizationId,
    staleTime: 1000 * 60 * 5,
  });

  const rolePriority: AppRole[] = ["super_admin", "owner", "admin", "member", "employee"];
  const isActuallyLoading = isLoadingRoles || isLoadingPermissions || isLoadingAuth;
  const primaryRole = roles?.length ? (rolePriority.find(r => roles.includes(r)) || "member") : (isActuallyLoading ? null : "member");

  const isSuperAdmin = primaryRole === "super_admin";
  const isOwner = primaryRole === "owner" || isSuperAdmin;
  const isAdmin = primaryRole === "admin" || isOwner;
  const isMember = primaryRole === "member";

  // field_worker flag from profile - independent of role
  const isFieldWorker = !!profile?.field_worker;

  const rolePresetPermissions = primaryRole ? ROLE_PRESETS[primaryRole] ?? [] : [];
  const effectivePermissions = permissions.length > 0 ? permissions : rolePresetPermissions;

  // Granular permission check with role-based fallback
  const hasPermission = (module: string): boolean => {
    if (isOwner) return true;
    if (effectivePermissions.includes("permissions.manage")) return true;
    return effectivePermissions.includes(module);
  };

  // Enhanced flags using granular permissions when available
  const hasAnyPermissions = effectivePermissions.length > 0;

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
  const roleLabel = primaryRole ? ROLE_LABELS[primaryRole] : "Carregando...";

  return {
    role: primaryRole,
    isLoading: isActuallyLoading,
    isEmployee: primaryRole === "employee",
    isFieldWorker,
    isMember,
    isAdmin,
    isOwner,
    isSuperAdmin,
    canEdit,
    canCreate,
    canDelete,
    hasPermission,
    roleLabel,
  };
}

export const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super ADM",
  owner: "Gestor",
  admin: "ADM",
  member: "Atendente",
  employee: "Funcionário",
};
