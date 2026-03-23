import { useState } from "react";
import { Sparkles, AlertTriangle, ShoppingCart, Loader2, Zap, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAICredits, CREDIT_PACKAGES } from "@/hooks/useAICredits";

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
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className={`text-xs font-medium ${isEmpty ? "text-destructive" : isLow ? "text-amber-600" : "text-foreground"}`}>
          {balance}
        </span>
        {isLow && !isEmpty && (
          <AlertTriangle className="h-3 w-3 text-amber-500" />
        )}
        {isEmpty && (
          <AlertTriangle className="h-3 w-3 text-destructive" />
        )}
      </button>

      <Dialog open={showPurchase} onOpenChange={setShowPurchase}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Créditos de IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Current balance */}
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Saldo atual</p>
              <p className={`text-3xl font-bold ${isEmpty ? "text-destructive" : isLow ? "text-amber-600" : "text-foreground"}`}>
                {balance}
              </p>
              <p className="text-xs text-muted-foreground">créditos</p>
            </div>

            {isEmpty && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-xs text-destructive">
                  Seus créditos de IA acabaram. Recarregue para continuar usando os recursos de inteligência artificial.
                </p>
              </div>
            )}

            {isLow && !isEmpty && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Seus créditos de IA estão acabando. Recarregue para continuar usando sem interrupções.
                </p>
              </div>
            )}

            {/* Usage reference */}
            <div className="rounded-lg border border-border/40 p-3 space-y-1.5">
              <p className="text-xs font-medium text-foreground">Consumo por ação</p>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Copiloto de resposta</span>
                <span className="font-medium text-foreground">1 crédito</span>
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Analisar conversa / Criar OS</span>
                <span className="font-medium text-foreground">3 créditos</span>
              </div>
            </div>

            {/* Packages */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">Recarregar créditos</p>
              {CREDIT_PACKAGES.map((pack) => (
                <button
                  key={pack.id}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all group"
                  onClick={() => purchaseCredits(pack.id)}
                  disabled={purchasing}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                      <Zap className="h-4 w-4 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{pack.label}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {pack.price.toFixed(2).replace(".", ",")}
                      </p>
                    </div>
                  </div>
                  {purchasing ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <ShoppingCart className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
