import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
  description: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pack_1000", credits: 1000, price: 9.90, label: "1.000 interações", description: "Ideal para começar" },
  { id: "pack_2000", credits: 2000, price: 19.90, label: "2.000 interações", description: "Mais popular" },
  { id: "pack_5000", credits: 5000, price: 49.90, label: "5.000 interações", description: "Melhor custo-benefício" },
];

interface FranchiseStatus {
  franchise_total: number;
  franchise_used: number;
  franchise_remaining: number;
  credits_balance: number;
  period_start: string;
  plan_slug: string;
}

export function useAICredits() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState(false);

  const { data: franchiseData, isLoading } = useQuery({
    queryKey: ["ai-franchise", organizationId],
    queryFn: async (): Promise<FranchiseStatus | null> => {
      if (!organizationId) return null;
      const { data, error } = await supabase.rpc("get_franchise_status", {
        _org_id: organizationId,
      });
      if (error) {
        console.error("Error fetching franchise status:", error);
        return null;
      }
      return data as unknown as FranchiseStatus;
    },
    enabled: !!organizationId,
    refetchInterval: 120_000,
  });

  // Realtime subscription — auto-refresh on franchise or credits changes
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`ai-status-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ai_credits",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ai-franchise", organizationId] });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "ai_franchise",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ai-franchise", organizationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  const franchiseRemaining = franchiseData?.franchise_remaining ?? 0;
  const franchiseTotal = franchiseData?.franchise_total ?? 0;
  const creditsBalance = franchiseData?.credits_balance ?? 0;
  const totalAvailable = franchiseRemaining + creditsBalance;
  
  // For display: show total available capacity
  const balance = totalAvailable;
  const hasFranchise = franchiseTotal > 0;
  // Low = less than 10% of franchise remaining AND no extra credits
  const isLow = hasFranchise
    ? franchiseRemaining < franchiseTotal * 0.1 && creditsBalance < 200
    : creditsBalance > 0 && creditsBalance <= 200;
  const isEmpty = totalAvailable <= 0 && !hasFranchise;

  const purchaseCredits = async (packageId: string) => {
    setPurchasing(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("Não autenticado");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-credits-checkout`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ packageId }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao criar checkout");
      }

      const { url } = await resp.json();
      if (url) {
        window.open(url, "_blank");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao processar compra");
    } finally {
      setPurchasing(false);
    }
  };

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["ai-franchise"] });
  };

  return {
    balance,
    isLow,
    isEmpty,
    isLoading,
    purchaseCredits,
    purchasing,
    refresh,
    // Detailed info for advanced UI
    franchiseRemaining,
    franchiseTotal,
    creditsBalance,
    hasFranchise,
  };
}
