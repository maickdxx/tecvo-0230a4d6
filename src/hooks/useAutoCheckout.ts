import { useEffect, useRef, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { buildCheckoutSuccessPath, saveCheckoutContext } from "@/lib/checkoutReturn";

const POLL_INTERVAL_MS = 5000;
const POLL_MAX_DURATION_MS = 10 * 60 * 1000; // 10 minutes

export function useAutoCheckout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const hasTriggered = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef<number>(0);

  const [isPendingPayment, setIsPendingPayment] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    setIsPendingPayment(false);
    setPendingPlan(null);
  }, []);

  const cancelPending = useCallback(() => {
    stopPolling();
    toast({ title: "Espera cancelada", description: "Você será notificado quando o pagamento for confirmado." });
  }, [stopPolling]);

  const startPolling = useCallback((plan: string) => {
    if (pollTimerRef.current) return;

    setIsPendingPayment(true);
    setPendingPlan(plan);
    pollStartRef.current = Date.now();

    const poll = async () => {
      if (Date.now() - pollStartRef.current > POLL_MAX_DURATION_MS) {
        stopPolling();
        toast({
          title: "Tempo de espera expirado",
          description: "Se você já pagou, atualize a página ou entre em contato com o suporte.",
        });
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (error) return;

        if (data?.subscribed && data?.plan && data.plan !== "free") {
          stopPolling();
          const returnTo = buildCheckoutSuccessPath(data.plan);
          saveCheckoutContext({ plan: data.plan, returnTo });
          await queryClient.invalidateQueries({ queryKey: ["subscription"] });
          await queryClient.invalidateQueries({ queryKey: ["organization"] });
          navigate(returnTo, { replace: true });
        }
      } catch {
        // silently retry
      }
    };

    poll();
    pollTimerRef.current = setInterval(poll, POLL_INTERVAL_MS);
  }, [stopPolling, queryClient, navigate]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ plan: string }>) => {
      startPolling(e.detail.plan);
    };
    window.addEventListener("tecvo:checkout-started", handler as EventListener);
    return () => window.removeEventListener("tecvo:checkout-started", handler as EventListener);
  }, [startPolling]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  useEffect(() => {
    const checkoutPlan = searchParams.get("checkout");

    if (checkoutPlan && (checkoutPlan === "starter" || checkoutPlan === "essential" || checkoutPlan === "pro") && !hasTriggered.current) {
      hasTriggered.current = true;

      const newParams = new URLSearchParams(searchParams);
      newParams.delete("checkout");
      setSearchParams(newParams, { replace: true });

      startCheckout(checkoutPlan);
    }
  }, [searchParams, setSearchParams]);

  const startCheckout = async (plan: string) => {
    try {
      toast({
        title: "Redirecionando para pagamento...",
        description: "Aguarde enquanto preparamos seu checkout",
      });

      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: { plan },
      });

      if (error) throw error;

      if (data?.url) {
        saveCheckoutContext({ plan, returnTo: buildCheckoutSuccessPath(plan) });
        window.open(data.url, "_blank");
        startPolling(plan);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao iniciar pagamento",
        description: (error as Error).message,
      });
    }
  };

  return {
    isPendingPayment,
    pendingPlan,
    cancelPending,
    startPolling,
  };
}
