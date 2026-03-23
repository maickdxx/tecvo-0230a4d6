import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export function useDemoMode() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: isDemoMode = false, isLoading } = useQuery({
    queryKey: ["demo-mode", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return false;

      const { data, error } = await supabase
        .from("organizations")
        .select("is_demo_mode")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return (data as any)?.is_demo_mode ?? false;
    },
    enabled: !!profile?.organization_id,
  });

  const exitDemoMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("exit-demo-mode", {
        body: { confirm: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ["demo-mode"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast({
        title: "🎉 Ambiente pronto!",
        description: "Agora sua empresa começa aqui.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao sair do modo demonstração",
        description: error.message,
      });
    },
  });

  return {
    isDemoMode,
    isLoading,
    exitDemoMode: exitDemoMutation.mutateAsync,
    isExiting: exitDemoMutation.isPending,
  };
}
