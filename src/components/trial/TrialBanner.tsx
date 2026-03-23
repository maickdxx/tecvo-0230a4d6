import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Clock, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useDemoTour } from "@/hooks/useDemoTour";
import { useDemoMode } from "@/hooks/useDemoMode";

export function TrialBanner() {
  const { isTrial, trialDaysLeft, isTrialExpired } = useSubscription();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    const stored = localStorage.getItem("tecvo_trial_banner_dismissed");
    if (!stored) return false;
    // Re-show after 24 hours
    const dismissedAt = parseInt(stored, 10);
    return Date.now() - dismissedAt < 24 * 60 * 60 * 1000;
  });
  const { showTour } = useDemoTour();
  const { isDemoMode } = useDemoMode();

  if (showTour || isDemoMode || dismissed || (!isTrial && !isTrialExpired)) return null;

  const handleSubscribe = () => {
    navigate("/planos");
  };

  if (isTrialExpired) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
        <div className="container max-w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
            <span className="text-destructive font-medium">
              Seu período de teste expirou. Assine um plano para continuar criando serviços e gerenciando sua equipe.
            </span>
          </div>
          <Button size="sm" onClick={handleSubscribe} className="flex-shrink-0">
            Ativar plano agora
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-primary/10 border-b border-primary/20 px-4 py-2.5">
      <div className="container max-w-full flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-foreground">
            Seu teste gratuito termina em{" "}
            <strong className="text-primary">
              {trialDaysLeft} {trialDaysLeft === 1 ? "dia" : "dias"}
            </strong>
            . Assine agora para continuar usando sem interrupções.
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button size="sm" variant="default" onClick={handleSubscribe}>
            Assinar agora
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
