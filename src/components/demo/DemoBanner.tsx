import { useDemoMode } from "@/hooks/useDemoMode";
import { useDemoTour } from "@/hooks/useDemoTour";
import { Eye, Rocket, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function DemoBanner() {
  const { isDemoMode, isLoading, exitDemoMode, isExiting } = useDemoMode();
  const { restartTour, showTour } = useDemoTour();
  const navigate = useNavigate();

  if (isLoading || !isDemoMode || showTour) return null;

  const handleExit = async () => {
    await exitDemoMode();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="bg-primary/8 border-b border-primary/20 px-4 py-2.5">
      <div className="container max-w-full flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm">
          <Eye className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="text-primary font-medium">
            🔵 Você está explorando uma empresa modelo.
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
            onClick={restartTour}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reiniciar tour
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="sm"
                className="flex-shrink-0 gap-1.5"
                disabled={isExiting}
              >
                {isExiting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Rocket className="h-3.5 w-3.5" />
                )}
                Começar minha empresa agora
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Pronto para começar de verdade?</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso apagará os dados de demonstração e iniciará sua empresa do zero. Deseja continuar?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Continuar explorando</AlertDialogCancel>
                <AlertDialogAction onClick={handleExit}>
                  <Rocket className="h-4 w-4 mr-2" />
                  Começar agora
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
