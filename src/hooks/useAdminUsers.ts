import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "./useSuperAdmin";
import { useAuth } from "./useAuth";
import { toast } from "@/hooks/use-toast";

export interface PlatformUser {
  user_id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  organization_id: string | null;
  organization_name: string | null;
  plan: string | null;
  plan_expires_at: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  org_cnpj_cpf: string | null;
  org_city: string | null;
  org_state: string | null;
  roles: string[];
  created_at: string;
  last_access: string | null;
}

export interface SuperAdminGrant {
  id: string;
  user_id: string;
  granted_by: string | null;
  granted_at: string;
  is_root: boolean;
}

export function useAdminUsers() {
  const { isSuperAdmin } = useSuperAdmin();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["admin-platform-users"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_all_platform_users");
      if (error) throw error;
      return (data as unknown as PlatformUser[]) ?? [];
    },
    enabled: isSuperAdmin,
  });

  const { data: grants, isLoading: grantsLoading } = useQuery({
    queryKey: ["admin-super-admin-grants"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("super_admin_grants")
        .select("*")
        .order("granted_at", { ascending: true });
      if (error) throw error;
      return data as SuperAdminGrant[];
    },
    enabled: isSuperAdmin,
  });

  const grantSuperAdmin = useMutation({
    mutationFn: async (targetUserId: string) => {
      // Get the user's org first
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", targetUserId)
        .single();
      if (!profile) throw new Error("Profile not found");
      
      // Insert role
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({ user_id: targetUserId, role: "super_admin", organization_id: profile.organization_id });
      if (roleError) throw roleError;

      // Insert grant record
      const { error: grantError } = await supabase
        .from("super_admin_grants")
        .insert({
          user_id: targetUserId,
          granted_by: user?.id,
          is_root: false,
        });
      if (grantError) throw grantError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-super-admin-grants"] });
      toast({ title: "Super Admin concedido com sucesso" });
    },
    onError: (error) => {
      console.error("Error granting super admin:", error);
      toast({
        title: "Erro ao conceder Super Admin",
        description: "Verifique se o usuário já não possui essa permissão.",
        variant: "destructive",
      });
    },
  });

  const revokeSuperAdmin = useMutation({
    mutationFn: async (targetUserId: string) => {
      // Delete role
      const { error: roleError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", targetUserId)
        .eq("role", "super_admin");
      if (roleError) throw roleError;

      // Delete grant record
      const { error: grantError } = await supabase
        .from("super_admin_grants")
        .delete()
        .eq("user_id", targetUserId);
      if (grantError) throw grantError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-super-admin-grants"] });
      toast({ title: "Super Admin removido com sucesso" });
    },
    onError: (error) => {
      console.error("Error revoking super admin:", error);
      toast({
        title: "Erro ao remover Super Admin",
        description: "Não é possível remover o Super Admin raiz.",
        variant: "destructive",
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (targetUserId: string) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { targetUserId },
        headers: {
          Authorization: `Bearer ${sessionData.session?.access_token}`,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-platform-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-super-admin-grants"] });
      toast({ title: "Usuário excluído com sucesso" });
    },
    onError: (error: Error) => {
      console.error("Error deleting user:", error);
      toast({
        title: "Erro ao excluir usuário",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    users: users ?? [],
    grants: grants ?? [],
    usersLoading,
    grantsLoading,
    grantSuperAdmin,
    revokeSuperAdmin,
    deleteUser,
  };
}
