import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { ROLE_PRESETS } from "@/lib/permissionsConfig";
import type { AppRole } from "@/hooks/useUserRole";

export function useMemberPermissions() {
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const loadPermissions = useCallback(async (userId: string) => {
    if (!organization?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("member_permissions")
        .select("module")
        .eq("user_id", userId)
        .eq("organization_id", organization.id);

      if (error) throw error;
      setPermissions(data?.map(r => r.module) || []);
    } catch {
      toast({ title: "Erro", description: "Erro ao carregar permissões.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [organization?.id]);

  const savePermissions = useCallback(async (userId: string, modules: string[]) => {
    if (!organization?.id) return;
    setIsSaving(true);
    try {
      // Delete all current permissions
      const { error: delError } = await supabase
        .from("member_permissions")
        .delete()
        .eq("user_id", userId)
        .eq("organization_id", organization.id);

      if (delError) throw delError;

      // Insert new permissions
      if (modules.length > 0) {
        const rows = modules.map(module => ({
          user_id: userId,
          organization_id: organization.id,
          module,
        }));
        const { error: insError } = await supabase
          .from("member_permissions")
          .insert(rows);

        if (insError) throw insError;
      }

      setPermissions(modules);
      queryClient.invalidateQueries({ queryKey: ["member-permissions"] });
      toast({ title: "Permissões salvas", description: "As permissões foram atualizadas." });
    } catch {
      toast({ title: "Erro", description: "Não foi possível salvar as permissões.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  }, [organization?.id, queryClient]);

  const applyPreset = useCallback((role: AppRole) => {
    setPermissions(ROLE_PRESETS[role] || []);
  }, []);

  return {
    permissions,
    setPermissions,
    isLoading,
    isSaving,
    loadPermissions,
    savePermissions,
    applyPreset,
  };
}
