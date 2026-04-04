import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Crown, Clock, AlertTriangle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { toast } from "sonner";

export function TrialUrgencyBanner() {
  const {
    isTrial,
    trialDaysLeft,
    isTrialExpired,
    isFreePlan,
    hasActiveStripeSubscription,
    plan,
  } = useSubscription();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Don't show for paying users
  if (hasActiveStripeSubscription) return null;

  // Don't show if not in trial and not expired
  if (!isTrial && !isTrialExpired) return null;

  const handleUpgrade = () => {
    navigate("/pricing");
  };

  const handleQuickCheckout = async (selectedPlan: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId: getPriceId(selectedPlan) },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (err) {
      console.error("Checkout error:", err);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  // Trial expired — most urgent
  if (isTrialExpired) {
    return (
      <div className="relative overflow-hidden rounded-xl border-2 border-destructive/30 bg-gradient-to-r from-destructive/5 via-destructive/10 to-orange-500/5 p-4 sm:p-5 mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="absolute top-0 right-0 w-32 h-32 bg-destructive/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                Seu período de teste terminou
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Seus dados estão salvos, mas o acesso está limitado. Assine agora para continuar usando todas as funcionalidades.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <Button
              onClick={handleUpgrade}
              className="gap-2 flex-1 sm:flex-initial bg-destructive hover:bg-destructive/90"
              disabled={loading}
            >
              <Crown className="h-4 w-4" />
              Assinar agora
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Last 3 days of trial — urgent
  if (isTrial && trialDaysLeft <= 3) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-primary/5 p-4 sm:p-5 mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm sm:text-base">
                {trialDaysLeft === 0
                  ? "Último dia de teste!"
                  : trialDaysLeft === 1
                  ? "Falta 1 dia para o fim do teste"
                  : `Faltam ${trialDaysLeft} dias para o fim do teste`}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Garanta seu plano agora e não perca acesso aos seus clientes e serviços cadastrados.
              </p>
            </div>
          </div>
          <div className="flex gap-2 shrink-0 w-full sm:w-auto">
            <Button
              onClick={handleUpgrade}
              variant="default"
              className="gap-2 flex-1 sm:flex-initial"
              disabled={loading}
            >
              <Zap className="h-4 w-4" />
              Ver planos
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Normal trial (4+ days left) — soft reminder
  if (isTrial && trialDaysLeft > 3) {
    return (
      <div className="flex items-center gap-3 rounded-lg border bg-primary/5 border-primary/20 px-4 py-3 mb-6 animate-in fade-in duration-300">
        <Crown className="h-4 w-4 text-primary shrink-0" />
        <p className="text-xs sm:text-sm text-foreground flex-1">
          <span className="font-medium">Teste grátis</span> — {trialDaysLeft} dias restantes.{" "}
          <button
            onClick={handleUpgrade}
            className="text-primary font-medium underline underline-offset-2 hover:text-primary/80 transition-colors"
          >
            Ver planos e preços
          </button>
        </p>
      </div>
    );
  }

  return null;
}

function getPriceId(plan: string): string {
  const priceIds: Record<string, string> = {
    starter: "price_1TDFwCDojFnaEswEMumjlWaT",
    essential: "price_1TDFwEDojFnaEswE98ByPgQo",
    pro: "price_1TDFwFDojFnaEswEA0rf4ZBr",
  };
  return priceIds[plan] || priceIds.essential;
}
