import { useMemo } from "react";
import { CheckCircle2, TrendingUp, Wallet, ArrowRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useStrategicAlerts } from "@/hooks/useStrategicAlerts";
import { useDailyRoutine } from "@/hooks/useDailyRoutine";

export function DailyRoutineSummary() {
  const { alerts, isLoading } = useStrategicAlerts();
  const { completedAlerts } = useDailyRoutine();

  const metrics = useMemo(() => {
    if (isLoading || !alerts) return { 
      total: 0, 
      completed: 0, 
      percentage: 0, 
      impactActed: 0, 
      impactPending: 0 
    };

    const total = alerts.length;
    // We consider an alert completed if it's in our daily routine "completed" list
    const completed = alerts.filter(a => completedAlerts.includes(a.id)).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    const impactActed = alerts
      .filter(a => completedAlerts.includes(a.id))
      .reduce((sum, a) => sum + a._impactValue, 0);

    const impactPending = alerts
      .filter(a => !completedAlerts.includes(a.id))
      .reduce((sum, a) => sum + a._impactValue, 0);

    return { total, completed, percentage, impactActed, impactPending };
  }, [alerts, completedAlerts, isLoading]);

  if (isLoading) return null;

  const isComplete = metrics.total > 0 && metrics.completed === metrics.total;

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">Seu Dia na Tecvo</h2>
        <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </span>
      </div>

      <Card className={cn(
        "border-none shadow-sm transition-all duration-500",
        isComplete ? "bg-emerald-500/10 dark:bg-emerald-500/5 ring-1 ring-emerald-500/20" : "bg-card"
      )}>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {isComplete ? "Dia concluído! 🎉" : "Progresso das ações recomendadas"}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-foreground">
                  {metrics.completed}/{metrics.total}
                </span>
                <span className="text-sm text-muted-foreground">ações concluídas</span>
              </div>
            </div>
            <div className="h-14 w-14 rounded-full border-4 border-muted flex items-center justify-center relative">
               <svg className="h-full w-full -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-muted/20"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="24"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={150.8}
                  strokeDashoffset={150.8 - (150.8 * metrics.percentage) / 100}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-1000",
                    isComplete ? "text-emerald-500" : "text-primary"
                  )}
                />
              </svg>
              <span className="absolute text-[10px] font-bold">
                {Math.round(metrics.percentage)}%
              </span>
            </div>
          </div>

          <Progress value={metrics.percentage} className="h-2" />

          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Impacto Gerado</span>
              </div>
              <p className="text-lg font-bold">
                R$ {metrics.impactActed.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <TrendingUp className="h-3.5 w-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Potencial de Recuperação</span>
              </div>
              <p className="text-lg font-bold">
                R$ {metrics.impactPending.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {isComplete && (
            <div className="pt-2 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 animate-pulse">
              <CheckCircle2 className="h-4 w-4" />
              <p className="text-xs font-semibold">Tudo sob controle por aqui!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
