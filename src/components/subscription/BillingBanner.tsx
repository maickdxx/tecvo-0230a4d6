import { useState, useEffect } from "react";
import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Clock, CreditCard, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoTour } from "@/hooks/useDemoTour";
import { useDemoMode } from "@/hooks/useDemoMode";

const DISMISS_KEY = "billing_banner_dismissed";
const DISMISS_DURATION_MS = 12 * 60 * 60 * 1000; // 12h

function isDismissed(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const { ts } = JSON.parse(raw);
    return Date.now() - ts < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function dismiss() {
  localStorage.setItem(DISMISS_KEY, JSON.stringify({ ts: Date.now() }));
}

export function BillingBanner() {
  const {
    isFreePlan,
    planExpiresAt,
    subscriptionStatus,
    isCancelledAtPeriodEnd,
    daysUntilExpiration,
    isPastDue,
    isPastDueGraceExpired,
    pastDueDaysLeft,
    isTrial,
    isTrialExpired,
    hasActiveStripeSubscription,
  } = useSubscription();
  const navigate = useNavigate();
  const { showTour } = useDemoTour();
  const { isDemoMode } = useDemoMode();
  const [dismissed, setDismissed] = useState(isDismissed);

  // Re-check dismiss on mount
  useEffect(() => {
    setDismissed(isDismissed());
  }, []);

  if (showTour || isDemoMode || dismissed) return null;
  // Don't show for trial users (TrialBanner handles that)
  if (isTrial || isTrialExpired) return null;
  // Don't show for free users with no subscription history
  if (isFreePlan && !planExpiresAt && subscriptionStatus === "inactive") return null;

  const handleDismiss = () => {
    dismiss();
    setDismissed(true);
  };

  const handleGoToPlans = () => navigate("/planos");

  // === PAST DUE ===
  if (isPastDue) {
    const isUrgent = pastDueDaysLeft <= 3;
    return (
      <div className={`${isUrgent ? "bg-destructive/10 border-destructive/20" : "bg-warning/10 border-warning/20"} border-b px-4 py-3`}>
        <div className="container max-w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <CreditCard className={`h-4 w-4 flex-shrink-0 ${isUrgent ? "text-destructive" : "text-warning"}`} />
            <span className={`font-medium ${isUrgent ? "text-destructive" : "text-warning-foreground"}`}>
              {isPastDueGraceExpired
                ? "Seu pagamento está vencido e o acesso foi restrito. Regularize para continuar usando a plataforma."
                : `Pagamento pendente — regularize em até ${pastDueDaysLeft} ${pastDueDaysLeft === 1 ? "dia" : "dias"} para manter seu acesso completo.`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant={isUrgent ? "destructive" : "default"} onClick={handleGoToPlans}>
              Regularizar pagamento
            </Button>
            {!isPastDueGraceExpired && (
              <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // === CANCELLED AT PERIOD END ===
  if (isCancelledAtPeriodEnd && planExpiresAt) {
    const isUrgent = daysUntilExpiration <= 3;
    return (
      <div className={`${isUrgent ? "bg-destructive/10 border-destructive/20" : "bg-warning/10 border-warning/20"} border-b px-4 py-3`}>
        <div className="container max-w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${isUrgent ? "text-destructive" : "text-warning"}`} />
            <span className={`font-medium ${isUrgent ? "text-destructive" : "text-warning-foreground"}`}>
              {daysUntilExpiration === 0
                ? "Seu plano expira hoje. Renove agora para não perder acesso."
                : daysUntilExpiration === 1
                ? "Seu plano expira amanhã. Renove para continuar usando sem interrupção."
                : `Seu plano expira em ${daysUntilExpiration} dias. Renove para manter todos os recursos.`}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button size="sm" variant={isUrgent ? "destructive" : "default"} onClick={handleGoToPlans}>
              Renovar plano
            </Button>
            <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // === EXPIRED (was paid, now free) ===
  if (isFreePlan && planExpiresAt && subscriptionStatus !== "inactive") {
    const expiredDate = new Date(planExpiresAt);
    const now = new Date();
    const daysSinceExpiry = Math.floor((now.getTime() - expiredDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysSinceExpiry >= 0 && daysSinceExpiry <= 30) {
      return (
        <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-3">
          <div className="container max-w-full flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />
              <span className="text-destructive font-medium">
                {daysSinceExpiry === 0
                  ? "Seu plano expirou hoje. Assine novamente para recuperar o acesso completo."
                  : daysSinceExpiry === 1
                  ? "Seu plano expirou há 1 dia. Assine novamente para continuar usando todos os recursos."
                  : `Seu plano expirou há ${daysSinceExpiry} dias. Assine novamente para recuperar o acesso completo.`}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" variant="destructive" onClick={handleGoToPlans}>
                Reativar plano
              </Button>
              <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  // === APPROACHING RENEWAL (active sub, < 7 days) ===
  if (hasActiveStripeSubscription && !isCancelledAtPeriodEnd && daysUntilExpiration > 0 && daysUntilExpiration <= 7) {
    return (
      <div className="bg-muted/50 border-b border-border px-4 py-2.5">
        <div className="container max-w-full flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">
              Sua assinatura será renovada automaticamente em {daysUntilExpiration} {daysUntilExpiration === 1 ? "dia" : "dias"}.
            </span>
          </div>
          <button onClick={handleDismiss} className="text-muted-foreground hover:text-foreground p-1" aria-label="Fechar">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return null;
}
