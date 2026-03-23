import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentPendingOverlayProps {
  pendingPlan: string | null;
  onCancel: () => void;
}

export function PaymentPendingOverlay({ pendingPlan, onCancel }: PaymentPendingOverlayProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border bg-card p-5 shadow-lg animate-in slide-in-from-bottom-4">
      <button
        onClick={onCancel}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-full bg-primary/10 p-2">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-foreground">
            Aguardando confirmação do pagamento...
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Você pode continuar usando a plataforma. Avisaremos quando o pagamento for confirmado.
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="mt-3 h-7 text-xs px-2"
          >
            Cancelar espera
          </Button>
        </div>
      </div>
    </div>
  );
}
