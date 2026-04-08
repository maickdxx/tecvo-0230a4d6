import { useState } from "react";
import { Sparkles, AlertTriangle, Loader2, Zap, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAICredits, CREDIT_PACKAGES } from "@/hooks/useAICredits";

function StatusDot({ isEmpty, isLow }: { isEmpty: boolean; isLow: boolean }) {
  if (isEmpty) return <span className="h-2 w-2 rounded-full bg-destructive animate-pulse" />;
  if (isLow) return <span className="h-2 w-2 rounded-full bg-amber-500" />;
  return <span className="h-2 w-2 rounded-full bg-emerald-500" />;
}

function StatusLabel({ isEmpty, isLow }: { isEmpty: boolean; isLow: boolean }) {
  if (isEmpty) return <span className="text-destructive">Pausada</span>;
  if (isLow) return <span className="text-amber-600">Limitada</span>;
  return <span className="text-emerald-600">Ativa</span>;
}

export function AICreditsDisplay() {
  const { balance, isLow, isEmpty, isLoading, purchaseCredits, purchasing } = useAICredits();
  const [showPurchase, setShowPurchase] = useState(false);

  if (isLoading) return null;

  return (
    <>
      <button
        onClick={() => setShowPurchase(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <StatusDot isEmpty={isEmpty} isLow={isLow} />
        <span className="text-xs font-medium text-foreground">IA</span>
        <StatusLabel isEmpty={isEmpty} isLow={isLow} />
      </button>

      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Recursos de IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Status */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <StatusDot isEmpty={isEmpty} isLow={isLow} />
                <p className="text-xs text-muted-foreground">
                  {isEmpty ? "IA pausada" : isLow ? "Capacidade limitada" : "IA ativa"}
                </p>
              </div>
              <p className={`text-3xl font-bold ${isEmpty ? "text-destructive" : isLow ? "text-amber-600" : "text-foreground"}`}>
                {balance}
              </p>
              <p className="text-xs text-muted-foreground">interações disponíveis</p>
            </div>

            {isEmpty && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">
                  A IA da Laura está pausada. Recarregue para continuar usando todos os recursos inteligentes do sistema.
                </p>
              </div>
            )}

            {isLow && !isEmpty && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Sua capacidade de IA está acabando. Recarregue para evitar interrupções.
                </p>
              </div>
            )}

            {/* Usage reference */}
            <div className="rounded-lg border border-border/40 p-3 space-y-1.5">
              <p className="text-xs font-medium text-foreground">Uso por recurso</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Resposta inteligente</span>
                <span className="font-medium text-foreground">1 interação</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Análise completa / Criar OS</span>
                <span className="font-medium text-foreground">3 interações</span>
              </div>
            </div>

            {/* Packages */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Recarregar capacidade</p>
              {CREDIT_PACKAGES.map((pack, idx) => (
                <button
                  key={pack.id}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all group relative"
                  onClick={() => purchaseCredits(pack.id)}
                  disabled={purchasing}
                >
                  {idx === 1 && (
                    <span className="absolute -top-2 left-4 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                      Popular
                    </span>
                  )}
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{pack.label}</p>
                      <p className="text-xs text-muted-foreground">{pack.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      R$ {pack.price.toFixed(2).replace(".", ",")}
                    </span>
                    {purchasing ? (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
