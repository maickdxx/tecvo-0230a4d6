import { useState } from "react";
import { Sparkles, Loader2, Zap, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAICredits, CREDIT_PACKAGES } from "@/hooks/useAICredits";
import { Progress } from "@/components/ui/progress";

function StatusDot({ isEmpty, isLow }: { isEmpty: boolean; isLow: boolean }) {
  if (isEmpty) return <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />;
  if (isLow) return <span className="h-2 w-2 rounded-full bg-amber-500" />;
  return <span className="h-2 w-2 rounded-full bg-emerald-500" />;
}

export function AICreditsDisplay() {
  const {
    isLow, isEmpty, isLoading, purchaseCredits, purchasing,
    franchiseRemaining, franchiseTotal, creditsBalance, hasFranchise,
  } = useAICredits();
  const [showDialog, setShowDialog] = useState(false);

  if (isLoading) return null;

  // For users with franchise: show simple active status, no numbers
  const statusLabel = isEmpty ? "Pausada" : isLow ? "Atenção" : "Ativa";
  const statusColor = isEmpty ? "text-amber-600" : isLow ? "text-amber-600" : "text-emerald-600";

  const franchisePercent = franchiseTotal > 0
    ? Math.round((franchiseRemaining / franchiseTotal) * 100)
    : 0;

  return (
    <>
      <button
        onClick={() => setShowDialog(true)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <StatusDot isEmpty={isEmpty} isLow={isLow} />
        <span className="text-xs font-medium text-foreground">IA</span>
        <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
      </button>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Laura — Inteligência Artificial
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Franchise status */}
            {hasFranchise && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Incluído no seu plano</p>
                  <span className="text-xs text-muted-foreground">
                    {franchisePercent}% disponível
                  </span>
                </div>
                <Progress value={franchisePercent} className="h-2" />
                <p className="text-xs text-muted-foreground">
                  A IA está funcionando normalmente dentro do seu plano.
                </p>
              </div>
            )}

            {/* Extra credits (only show if they have some or no franchise) */}
            {(creditsBalance > 0 || !hasFranchise) && (
              <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">
                  {hasFranchise ? "Capacidade extra adquirida" : "Capacidade disponível"}
                </p>
                <p className="text-2xl font-bold text-foreground">
                  {creditsBalance.toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">interações extras</p>
              </div>
            )}

            {/* Soft message when low */}
            {isLow && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="text-xs text-amber-700">
                  {hasFranchise
                    ? "A capacidade do mês está chegando ao fim. Adicione interações extras para garantir continuidade."
                    : "A capacidade está reduzindo. Amplie para manter tudo funcionando."}
                </p>
              </div>
            )}

            {/* Packages */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-foreground">
                {hasFranchise ? "Adicionar interações extras" : "Ampliar capacidade"}
              </p>
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
