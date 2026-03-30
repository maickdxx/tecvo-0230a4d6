import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { toast } from "sonner";

const SERVICE_THRESHOLD = 3;

export function ValueMilestoneBanner() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { isDemoMode } = useDemoMode();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["profile-onboarding", userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("onboarding_completed, organization_id")
        .eq("user_id", userId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: realServiceCount = 0 } = useQuery({
    queryKey: ["real-service-count", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return 0;

      const { count } = await supabase
        .from("services")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", profile.organization_id)
        .eq("is_demo_data", false)
        .is("deleted_at", null);

      return count ?? 0;
    },
    enabled: !!profile?.organization_id && !isDemoMode && !profile?.onboarding_completed,
    staleTime: 5 * 60 * 1000,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from("profiles")
        .update({ onboarding_completed: true })
        .eq("user_id", userId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile-onboarding", userId] });
    },
    onError: () => {
      toast.error("Erro ao atualizar status de onboarding");
    }
  });

  if (profileLoading || isDemoMode || profile?.onboarding_completed || realServiceCount < SERVICE_THRESHOLD) {
    return null;
  }

  const handleDismiss = () => {
    completeOnboardingMutation.mutate();
  };

  return (
    <div className="relative rounded-xl border border-primary/20 bg-primary/5 p-5 mb-4 animate-blur-in">
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full hover:bg-muted/60 text-muted-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
          <TrendingUp className="h-5 w-5 text-primary" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="font-medium text-foreground mb-0.5">
            Você já começou a organizar sua operação
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            Agora acompanhe seus resultados e veja quanto está faturando
          </p>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => { handleDismiss(); navigate("/financeiro"); }}>
              Ver financeiro
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDismiss}>
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
