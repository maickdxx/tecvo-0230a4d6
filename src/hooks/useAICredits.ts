import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { useState } from "react";

export interface CreditPackage {
  id: string;
  credits: number;
  price: number;
  label: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  { id: "pack_100", credits: 100, price: 9.90, label: "100 créditos" },
  { id: "pack_500", credits: 500, price: 39.90, label: "500 créditos" },
  { id: "pack_1000", credits: 1000, price: 69.90, label: "1.000 créditos" },
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
    refetchInterval: 120_000, // refresh every 2min
  });

  const balance = credits?.balance ?? 0;
  const isLow = balance > 0 && balance <= 20;
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
