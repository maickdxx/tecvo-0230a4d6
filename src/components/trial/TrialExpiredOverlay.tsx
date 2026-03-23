import { useSubscription } from "@/hooks/useSubscription";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PAID_PLANS } from "@/lib/planConfig";
import { useDemoTour } from "@/hooks/useDemoTour";

export function TrialExpiredOverlay() {
  const { isTrialExpired } = useSubscription();
  const navigate = useNavigate();
  const { showTour } = useDemoTour();

  if (showTour || !isTrialExpired) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-xl">
        <CardContent className="pt-8 pb-6 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-destructive" />
          </div>
          <h2 className="text-xl font-bold text-foreground">
            Seu período de teste terminou
          </h2>
          <p className="text-muted-foreground text-sm">
            Para continuar criando serviços, orçamentos e gerenciando sua equipe, 
            ative um plano. Seus dados estão seguros e você ainda pode consultá-los.
          </p>
          <div className="space-y-2 pt-2">
            <Button className="w-full" size="lg" onClick={() => navigate("/planos")}>
              Ativar plano agora
            </Button>
            <p className="text-xs text-muted-foreground">
              A partir de {PAID_PLANS[0].price}/mês
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
