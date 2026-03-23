import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "@/hooks/use-toast";
import { ROLE_PRESETS } from "@/lib/permissionsConfig";
import type { AppRole } from "@/hooks/useUserRole";

export interface TeamMember {
  id: string;
  user_id: string;
  full_name: string | null;
  role: AppRole;
  field_worker: boolean;
}

export function useTeamMembers() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading, error: membersError } = useQuery({
    queryKey: ["team-members", organization?.id],
    queryFn: async () => {
      // Get profiles in organization
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, field_worker")
        .eq("organization_id", organization!.id);

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      if (!profiles || profiles.length === 0) {
        console.warn("No profiles found for organization:", organization!.id);
        return [];
      }

      // Get roles for each user
      const userIds = profiles.map((p) => p.user_id);
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
        throw rolesError;
      }

      // Combine profiles with roles - pick best role (exclude super_admin from display)
      const rolePriority: AppRole[] = ["owner", "admin", "member", "employee"];
      
      return profiles.map((profile) => {
        const userRoles = (roles || []).filter((r) => r.user_id === profile.user_id);
        const bestRole = rolePriority.find(r => userRoles.some(ur => ur.role === r)) || "member";
        return {
          id: profile.id,
          user_id: profile.user_id,
          full_name: profile.full_name,
          role: bestRole as AppRole,
          field_worker: !!(profile as any).field_worker,
        };
      });
    },
    enabled: !!organization?.id,
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Delete existing app roles (keep super_admin if present)
      const { error: delError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .in("role", ["owner", "admin", "member", "employee"]);

      if (delError) throw delError;

      // Insert the new role (scoped to organization)
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userId)
        .single();
      if (!profile) throw new Error("Profile not found");

      const { error: insError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role, organization_id: profile.organization_id });

      if (insError) throw insError;

      // Apply preset permissions for the new role
      if (organization?.id) {
        // Delete existing permissions
        await supabase
          .from("member_permissions")
          .delete()
          .eq("user_id", userId)
          .eq("organization_id", organization.id);

        // Insert preset permissions
        const preset = ROLE_PRESETS[role] || [];
        if (preset.length > 0) {
          const rows = preset.map(module => ({
            user_id: userId,
            organization_id: organization.id,
            module,
          }));
          await supabase.from("member_permissions").insert(rows);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: "Função atualizada",
        description: "A função do membro foi atualizada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a função.",
        variant: "destructive",
      });
    },
  });

  const updateFieldWorkerMutation = useMutation({
    mutationFn: async ({ userId, fieldWorker }: { userId: string; fieldWorker: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ field_worker: fieldWorker } as any)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: "Atualizado",
        description: "Atuação em campo atualizada com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a atuação em campo.",
        variant: "destructive",
      });
    },
  });

  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error("Não autenticado");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/remove-team-member`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId }),
        }
      );

      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast({
        title: "Membro removido",
        description: "O membro foi removido da equipe com sucesso.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro",
        description: error.message || "Não foi possível remover o membro.",
        variant: "destructive",
      });
    },
  });

  // Get field workers for assignment dropdown (independent of role)
  const fieldWorkers = members.filter((m) => m.field_worker);
  // Legacy: employees by role
  const employees = members.filter((m) => m.role === "employee");

  return {
    members,
    employees,
    fieldWorkers,
    isLoading,
    error: membersError,
    updateRole: updateRoleMutation.mutate,
    isUpdating: updateRoleMutation.isPending,
    updateFieldWorker: updateFieldWorkerMutation.mutate,
    isUpdatingFieldWorker: updateFieldWorkerMutation.isPending,
    deleteMember: deleteMemberMutation.mutate,
    isDeleting: deleteMemberMutation.isPending,
  };
}
