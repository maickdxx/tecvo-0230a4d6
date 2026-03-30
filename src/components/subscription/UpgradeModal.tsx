import { useState } from "react";
import { analytics } from "@/lib/analytics";
import { trackFBEvent } from "@/lib/fbPixel";
import { Crown, Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PLAN_CONFIG } from "@/lib/planConfig";
import { buildCheckoutSuccessPath, saveCheckoutContext } from "@/lib/checkoutReturn";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicesUsed?: number;
  servicesLimit?: number;
}

const NEXT_PLAN_BENEFITS: Record<string, string[]> = {
  starter: [
    "WhatsApp completo com conversas e etiquetas",
    "Chatbots simples",
    "Relatórios avançados",
    "Até 5 usuários",
    "Clientes e OS ilimitadas",
  ],
  essential: [
    "Usuários ilimitados",
    "Múltiplos números de WhatsApp",
    "Automação avançada",
    "Gestão de equipe e permissões",
    "Suporte prioritário",
  ],
  pro: [
    "Você já está no plano mais completo!",
  ],
};

export function UpgradeModal({ open, onOpenChange, servicesUsed = 15, servicesLimit = 15 }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const getNextPlan = () => {
    if (servicesLimit <= 10) return "starter";
    if (servicesLimit <= 30) return "essential";
    return "pro";
  };

  const nextPlan = getNextPlan();
  const nextPlanConfig = PLAN_CONFIG[nextPlan as keyof typeof PLAN_CONFIG];
  const benefits = NEXT_PLAN_BENEFITS[nextPlan] || NEXT_PLAN_BENEFITS.essential;

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: { plan: nextPlan },
      });
      if (error) throw error;

      if (data?.url) {
        analytics.track("payment_initiated", null, null, { plan: nextPlan, page_section: "upgrade_modal", button_label: "Fazer upgrade", interaction_type: "click" });
        saveCheckoutContext({ plan: nextPlan, returnTo: buildCheckoutSuccessPath(nextPlan) });
        window.open(data.url, "_blank");
        window.dispatchEvent(new CustomEvent("tecvo:checkout-started", { detail: { plan: nextPlan } }));
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao iniciar pagamento",
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Limite de Serviços Atingido</DialogTitle>
          <DialogDescription className="text-base">
            Você já criou {servicesUsed} de {servicesLimit} serviços este mês.
            Faça upgrade para continuar crescendo!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {nextPlanConfig && (
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-bold text-primary">Plano {nextPlanConfig.name}</span>
                <span className="text-2xl font-bold">
                  {nextPlanConfig.price}
                  <span className="text-sm font-normal text-muted-foreground">{nextPlanConfig.period}</span>
                </span>
              </div>

              <ul className="space-y-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button onClick={handleUpgrade} disabled={isLoading} className="w-full gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {isLoading ? "Carregando..." : "Assinar agora"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Agora não
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Cancele a qualquer momento. Sem compromisso.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
