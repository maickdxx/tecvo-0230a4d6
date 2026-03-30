import { useMemo } from "react";
import { CheckCircle2, Calendar, LayoutDashboard, ArrowRight, Zap, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useStrategicAlerts } from "@/hooks/useStrategicAlerts";
import { useDailyRoutine } from "@/hooks/useDailyRoutine";
import { TodayActionsBlock } from "./TodayActionsBlock";

export function FocoDoDia() {
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
    const completed = alerts.filter(a => completedAlerts.includes(a.id)).length;
    const percentage = total > 0 ? (completed / total) * 100 : 0;

    const impactActed = alerts
      .filter(a => completedAlerts.includes(a.id))
      .reduce((sum, a) => sum + (a._impactValue || 0), 0);

    const impactPending = alerts
      .filter(a => !completedAlerts.includes(a.id))
      .reduce((sum, a) => sum + (a._impactValue || 0), 0);

    return { total, completed, percentage, impactActed, impactPending };
  }, [alerts, completedAlerts, isLoading]);

  if (isLoading) return null;

  const isComplete = metrics.total > 0 && metrics.completed === metrics.total;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          FOCO DO DIA
        </h2>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-full border border-border/50">
          <Calendar className="h-3.5 w-3.5" />
          {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <Card className={cn(
          "border-none shadow-lg transition-all duration-500 overflow-hidden relative h-full",
          isComplete ? "bg-success/10 dark:bg-success/5 ring-1 ring-success/20" : "bg-gradient-to-br from-card to-muted/20"
        )}>
          {/* Progress Background */}
          <div 
            className="absolute top-0 left-0 h-1.5 bg-primary/20 transition-all duration-1000" 
            style={{ width: `${metrics.percentage}%` }}
          />

          <CardContent className="p-6 space-y-6">
            <div className="flex flex-col gap-4">
              <div className="space-y-1">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                  {isComplete ? "Objetivo Alcançado" : "Progresso das Ações"}
                </p>
                <div className="flex items-end justify-between">
                  <p className="text-3xl font-black text-foreground tracking-tight">
                    {metrics.total} {metrics.total === 1 ? 'Ação' : 'Ações'}
                  </p>
                  <p className="text-2xl font-black text-primary">{Math.round(metrics.percentage)}%</p>
                </div>
              </div>
              
              <div className="relative h-2.5 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    isComplete ? "bg-emerald-500" : "bg-primary"
                  )}
                  style={{ width: `${metrics.percentage}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Atuado</p>
                <p className="text-lg font-black text-foreground">
                  R$ {metrics.impactActed.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">Pendente</p>
                <p className="text-lg font-black text-foreground">
                  R$ {metrics.impactPending.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            {isComplete && (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-xl">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-xs font-bold uppercase tracking-tight">Tudo sob controle. Nenhuma pendência crítica!</p>
              </div>
            )}
            
            {!isComplete && metrics.total > 0 && (
              <div className="flex items-center gap-2 text-primary bg-primary/10 p-3 rounded-xl">
                <Zap className="h-5 w-5 shrink-0 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-tight">Você ainda tem {metrics.total - metrics.completed} ações pendentes.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="h-full">
          <TodayActionsBlock isLeanView />
        </div>
      </div>
    </div>
  );
}
