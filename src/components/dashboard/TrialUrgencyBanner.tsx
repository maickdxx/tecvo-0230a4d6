import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { Crown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrialUrgencyBanner() {
  const {
    isFreePlan,
    hasActiveStripeSubscription,
  } = useSubscription();
  const navigate = useNavigate();

  // Don't show for paying users
  if (hasActiveStripeSubscription || !isFreePlan) return null;

  const handleUpgrade = () => {
    navigate("/planos");
  };

  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-4 sm:p-5 mb-6 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm sm:text-base">
              Comece por apenas R$1 no primeiro mês
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Assine agora e tenha acesso completo a todas as funcionalidades da Tecvo.
            </p>
          </div>
        </div>
        <div className="flex gap-2 shrink-0 w-full sm:w-auto">
          <Button
            onClick={handleUpgrade}
            variant="default"
            className="gap-2 flex-1 sm:flex-initial"
          >
            <Crown className="h-4 w-4" />
            Ver planos
          </Button>
        </div>
      </div>
    </div>
  );
}
