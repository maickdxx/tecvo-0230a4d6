import { AppLayout } from "@/components/layout";
import { SecretariaChat, SecretariaStrategicAlerts } from "@/components/secretaria";
import { useSubscription } from "@/hooks/useSubscription";
import { useAISettings } from "@/hooks/useAISettings";
import { UpgradeModal } from "@/components/subscription";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUnreadTip } from "@/hooks/useUnreadTip";
import { useUserRole } from "@/hooks/useUserRole";

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
          <p className="text-muted-foreground">Carregando...</p>
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
          <p className="text-muted-foreground text-sm">A Laura está desativada.</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes")}>
            <Settings className="h-4 w-4 mr-2" />
            Ir para Configurações
          </Button>
        </div>
      </AppLayout>
    );
  }

  const showAlerts = !settings.chat_only_mode && settings.show_alerts;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Laura</h1>
              <p className="text-sm text-muted-foreground">
                Sua assistente operacional inteligente
              </p>
            </div>
          </div>
          {isOwner && (
            <Button variant="outline" size="sm" onClick={() => navigate("/configuracoes?view=ai-settings")}>
              <Settings className="h-4 w-4 mr-2" />
              Configurar
            </Button>
          )}
        </div>

        {/* Strategic Alerts */}
        {showAlerts && <SecretariaStrategicAlerts />}

        {/* Chat */}
        <div className="h-[500px]">
          <SecretariaChat />
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
