import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "./useSuperAdmin";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

export interface AdminProfile {
  id: string;
  user_id: string;
  full_name: string | null;
  phone: string | null;
  last_access: string | null;
  organization_id: string;
}

export interface AdminOrganization {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  plan: string | null;
  plan_expires_at: string | null;
  created_at: string;
  onboarding_completed: boolean | null;
  cnpj_cpf: string | null;
  city: string | null;
  state: string | null;
  trial_started_at: string | null;
  trial_ends_at: string | null;
  cancel_at_period_end: boolean;
  profiles: AdminProfile[];
}

export interface UsageData {
  currentMonthServices: number;
  totalServices: number;
}

export function useAdminOrganizations() {
  const { isSuperAdmin } = useSuperAdmin();
  const queryClient = useQueryClient();

  const currentMonthYear = format(new Date(), "yyyy-MM");

  const { data: organizations, isLoading, error } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select(`
          id,
          name,
          email,
          phone,
          plan,
          plan_expires_at,
          created_at,
          onboarding_completed,
          cnpj_cpf,
          city,
          state,
          trial_started_at,
          trial_ends_at,
          cancel_at_period_end,
          profiles (
            id,
            user_id,
            full_name,
            phone,
            last_access,
            organization_id
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AdminOrganization[];
    },
    enabled: isSuperAdmin,
  });

  // Fetch usage data
  const { data: usageMap } = useQuery({
    queryKey: ["admin-usage-data", currentMonthYear],
    queryFn: async () => {
      // Current month usage
      const { data: currentUsage } = await supabase
        .from("organization_usage")
        .select("organization_id, services_created")
        .eq("month_year", currentMonthYear);

      // Total services per org
      const { data: totalServices } = await supabase
        .from("organization_usage")
        .select("organization_id, services_created");

      const map = new Map<string, UsageData>();

      // Aggregate totals
      const totalsMap = new Map<string, number>();
      totalServices?.forEach((row) => {
        const prev = totalsMap.get(row.organization_id) || 0;
        totalsMap.set(row.organization_id, prev + (row.services_created || 0));
      });

      // Build final map
      const currentMap = new Map<string, number>();
      currentUsage?.forEach((row) => {
        currentMap.set(row.organization_id, row.services_created || 0);
      });

      const allOrgIds = new Set([...totalsMap.keys(), ...currentMap.keys()]);
      allOrgIds.forEach((orgId) => {
        map.set(orgId, {
          currentMonthServices: currentMap.get(orgId) || 0,
          totalServices: totalsMap.get(orgId) || 0,
        });
      });

      return map;
    },
    enabled: isSuperAdmin,
  });

  const updateOrganizationPlan = useMutation({
    mutationFn: async ({ 
      orgId, 
      plan, 
      expiresAt 
    }: { 
      orgId: string; 
      plan: string; 
      expiresAt: string | null;
    }) => {
      const { error } = await supabase
        .from("organizations")
        .update({ 
          plan, 
          plan_expires_at: expiresAt 
        })
        .eq("id", orgId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      toast({
        title: "Plano atualizado",
        description: "O plano da organização foi atualizado com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error updating plan:", error);
      toast({
        title: "Erro ao atualizar plano",
        description: "Não foi possível atualizar o plano.",
        variant: "destructive",
      });
    },
  });

  const deleteOrganization = useMutation({
    mutationFn: async (orgId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-organization", {
        body: { organizationId: orgId },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-organizations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast({
        title: "Organização excluída",
        description: "A organização e todos os dados vinculados foram excluídos com sucesso.",
      });
    },
    onError: (error) => {
      console.error("Error deleting organization:", error);
      toast({
        title: "Erro ao excluir",
        description: error instanceof Error ? error.message : "Não foi possível excluir a organização.",
        variant: "destructive",
      });
    },
  });

  // Calculate stats
  const now = new Date();
  const activeSubscribers = organizations?.filter(o => {
    const hasPaidPlan = o.plan && o.plan !== "free";
    if (!hasPaidPlan) return false;
    const hasValidExpiry = o.plan_expires_at && new Date(o.plan_expires_at) > now;
    const isNotCancelled = !o.cancel_at_period_end;
    // Active = paid plan + valid expiry OR no expiry set (lifetime/manual)
    return hasValidExpiry || (!o.plan_expires_at && !o.trial_ends_at);
  }) ?? [];

  const stats = {
    total: organizations?.length ?? 0,
    free: organizations?.filter(o => o.plan === "free" || !o.plan).length ?? 0,
    essential: organizations?.filter(o => o.plan === "essential").length ?? 0,
    pro: organizations?.filter(o => o.plan === "pro").length ?? 0,
    totalUsers: organizations?.reduce((acc, org) => acc + org.profiles.length, 0) ?? 0,
    activeSubscribers: activeSubscribers.length,
    cancelledCount: organizations?.filter(o => o.cancel_at_period_end).length ?? 0,
  };

  return {
    organizations: organizations ?? [],
    isLoading,
    error,
    stats,
    usageMap: usageMap ?? new Map<string, UsageData>(),
    updateOrganizationPlan,
    deleteOrganization,
  };
}
