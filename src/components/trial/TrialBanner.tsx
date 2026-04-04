import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useDemoTour } from "@/hooks/useDemoTour";
import { useDemoMode } from "@/hooks/useDemoMode";

export function TrialBanner() {
  const { isFreePlan, hasActiveStripeSubscription } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    const stored = localStorage.getItem("tecvo_trial_banner_dismissed");
    if (!stored) return false;
    const dismissedAt = parseInt(stored, 10);
    return Date.now() - dismissedAt < 24 * 60 * 60 * 1000;
  });
  const { showTour } = useDemoTour();
  const { isDemoMode } = useDemoMode();

  // Only show for free users without active subscription
  if (showTour || isDemoMode || dismissed || hasActiveStripeSubscription || !isFreePlan) return null;

  const handleSubscribe = () => {
    navigate("/planos");
  };

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5">
      <div className="container max-w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-foreground">
            Assine um plano para acessar todos os recursos.{" "}
            <strong className="text-primary">Comece por apenas R$1 no primeiro mês!</strong>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="default" onClick={handleSubscribe}>
            Ver planos
          </Button>
          <button
            onClick={() => { setDismissed(true); localStorage.setItem("tecvo_trial_banner_dismissed", Date.now().toString()); }}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
