import { AppLayout } from "@/components/layout";
import { TimeClockSettings } from "@/components/settings/TimeClockSettings";
import { useNavigate } from "react-router-dom";
import { useWorkSchedules } from "@/hooks/useWorkSchedule";
import { useOrganization } from "@/hooks/useOrganization";
import { useSubscription } from "@/hooks/useSubscription";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Circle, AlertCircle, ArrowRight, Lock } from "lucide-react";

function PlanGate() {
  const navigate = useNavigate();
  const { hasTimeClock } = useSubscription();

  if (hasTimeClock) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 mb-4">
      <CardContent className="p-5">
        <div className="flex items-start gap-3">
          <Lock className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <div className="space-y-2">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Recurso exclusivo do plano Empresa
            </p>
            <p className="text-sm text-amber-800 dark:text-amber-200">
              O controle de ponto está disponível apenas no plano Empresa. Faça upgrade para liberar essa funcionalidade.
            </p>
            <Button size="sm" variant="default" onClick={() => navigate("/planos")} className="mt-1">
              Ver planos <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConfigSteps() {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { hasSchedules, hasSettings, isConfigured } = useWorkSchedules();
  const { hasTimeClock } = useSubscription();
  const isEnabled = !!(organization as any)?.time_clock_enabled;

  if (!hasTimeClock) return null;

  const steps = [
    { label: "Ativar sistema de ponto", done: isEnabled, action: null },
    { label: "Configurar escala de trabalho", done: hasSchedules, action: () => navigate("/ponto-admin/escalas"), actionLabel: "Configurar" },
    { label: "Configurar jornada/horário", done: hasSettings, action: null /* current page */, actionLabel: "Ver abaixo" },
    { label: "Operação ativa", done: isEnabled && isConfigured, action: null },
  ];

  const completedCount = steps.filter(s => s.done).length;
  const allDone = completedCount === steps.length;

  if (allDone) return null;

  return (
    <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20 mb-4">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
            Etapas de configuração ({completedCount}/{steps.length})
          </p>
        </div>
        <div className="space-y-2">
          {steps.map((step, i) => (
            <div key={i} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {step.done ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={`text-sm ${step.done ? "text-muted-foreground line-through" : "text-foreground"}`}>
                  {step.label}
                </span>
              </div>
              {!step.done && step.action && (
                <Button size="sm" variant="ghost" className="text-xs text-blue-600" onClick={step.action}>
                  {step.actionLabel} <ArrowRight className="h-3 w-3 ml-1" />
                </Button>
              )}
            </div>
          ))}
        </div>
        {!hasSchedules && isEnabled && (
          <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
            ⚠️ Sem escala configurada, os cálculos de atraso, falta e pendências não serão gerados corretamente.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function PontoConfiguracoes() {
  const navigate = useNavigate();
  return (
    <AppLayout>
      <PlanGate />
      <ConfigSteps />
      <TimeClockSettings onBack={() => navigate("/ponto-admin")} />
    </AppLayout>
  );
}
