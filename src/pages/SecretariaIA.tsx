import { AppLayout } from "@/components/layout";
import { SecretariaChat, SecretariaStrategicAlerts, DailyRoutineSummary } from "@/components/secretaria";
import { useSubscription } from "@/hooks/useSubscription";
import { useAISettings } from "@/hooks/useAISettings";
import { UpgradeModal } from "@/components/subscription";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Settings, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadTip } from "@/hooks/useUnreadTip";
import { useUserRole } from "@/hooks/useUserRole";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function SecretariaIA() {
  const { plan, isLoading } = useSubscription();
  const { settings, isLoading: settingsLoading } = useAISettings();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const navigate = useNavigate();
  const { clearUnreadTip } = useUnreadTip();
  const { isOwner } = useUserRole();

  useEffect(() => {
    clearUnreadTip();
  }, [clearUnreadTip]);

  const normalizedPlan = plan?.toLowerCase();
  const hasAccess = !isLoading && normalizedPlan && normalizedPlan !== "free" && normalizedPlan !== "starter";
  const showGate = !isLoading && !hasAccess;

  if (isLoading || settingsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground animate-pulse">Consultando dados estratégicos...</p>
        </div>
      </AppLayout>
    );
  }

  // IA desativada
  if (!settings.enabled) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
            <Bot className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm font-medium">A Assistente IA está desativada.</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes?view=ai-settings")}>
            <Settings className="h-4 w-4 mr-2" />
            Ativar IA nas Configurações
          </Button>
        </div>
      </AppLayout>
    );
  }

  const showAlerts = !settings.chat_only_mode && settings.show_alerts;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center ring-1 ring-primary/20">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Secretaria Executiva IA</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                Sua parceira para gestão de alto impacto
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px] text-xs">
                      A IA analisa seus dados diariamente para sugerir ações que maximizam sua receita.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </p>
            </div>
          </div>
          {isOwner && (
            <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => navigate("/configuracoes?view=ai-settings")}>
              <Settings className="h-4 w-4 mr-1.5" />
              Configurar
            </Button>
          )}
        </div>

        {/* New "Daily Routine" Layer */}
        {showAlerts && (
          <div className="grid gap-6">
            <DailyRoutineSummary />
            <div className="space-y-4">
              <SecretariaStrategicAlerts />
            </div>
          </div>
        )}

        {/* Chat Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
              Consultoria IA em Tempo Real
            </span>
          </div>
          <div className="h-[500px] border border-border/50 rounded-2xl overflow-hidden shadow-inner bg-card/30">
            <SecretariaChat />
          </div>
        </div>
      </div>

      <UpgradeModal
        open={showGate}
        onOpenChange={(open) => {
          if (!open && showGate) {
            navigate("/dashboard");
          }
        }}
      />
    </AppLayout>
  );
}
