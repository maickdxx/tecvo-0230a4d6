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

export function useAICredits() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();
  const [purchasing, setPurchasing] = useState(false);

  const { data: credits, isLoading } = useQuery({
    queryKey: ["ai-credits", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from("ai_credits")
        .select("balance, updated_at")
        .eq("organization_id", organizationId)
        .single();

      if (error) {
        console.error("Error fetching AI credits:", error);
        return { balance: 0, updated_at: null };
      }
      return data;
    },
    enabled: !!organizationId,
    refetchInterval: 120_000,
  });

  // Realtime subscription — auto-refresh balance after purchase
  useEffect(() => {
    if (!organizationId) return;

    const channel = supabase
      .channel(`ai-credits-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ai_credits",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["ai-credits", organizationId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, queryClient]);

  const balance = credits?.balance ?? 0;
  const isLow = balance > 0 && balance <= 200;
  const isEmpty = balance <= 0;

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
    queryClient.invalidateQueries({ queryKey: ["ai-credits"] });
  };

  return {
    balance,
    isLow,
    isEmpty,
    isLoading,
    purchaseCredits,
    purchasing,
    refresh,
  };
}
