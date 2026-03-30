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
    <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <LayoutDashboard className="h-5 w-5 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground tracking-tight uppercase opacity-90">
            Foco do Dia
          </h2>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground bg-muted/30 px-4 py-2 rounded-full border border-border/40 backdrop-blur-sm">
          <Calendar className="h-4 w-4 text-primary/60" />
          <span className="capitalize">
            {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <Card className={cn(
          "border-none shadow-xl transition-all duration-700 overflow-hidden relative h-full",
          isComplete 
            ? "bg-success/5 ring-1 ring-success/20" 
            : "bg-gradient-to-br from-card via-card to-primary/5 ring-1 ring-border/40"
        )}>
          {/* Progress Indicator Accent */}
          <div 
            className={cn(
              "absolute top-0 left-0 h-1 transition-all duration-1000 ease-in-out",
              isComplete ? "bg-success" : "bg-primary"
            )}
            style={{ width: `${metrics.percentage}%` }}
          />

          <CardContent className="p-8 space-y-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.25em] opacity-70">
                  {isComplete ? "Objetivo Concluído" : "Progresso Estratégico"}
                </p>
                <div className="flex items-baseline justify-between">
                  <h3 className="text-4xl font-black text-foreground tracking-tighter">
                    {metrics.total} <span className="text-xl font-medium text-muted-foreground">{metrics.total === 1 ? 'ação' : 'ações'}</span>
                  </h3>
                  <div className="flex flex-col items-end">
                    <span className={cn(
                      "text-3xl font-black tabular-nums tracking-tighter",
                      isComplete ? "text-success" : "text-primary"
                    )}>
                      {Math.round(metrics.percentage)}%
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="relative h-2.5 w-full bg-muted/40 rounded-full overflow-hidden shadow-inner">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden",
                    isComplete ? "bg-success" : "bg-primary shadow-[0_0_12px_rgba(var(--primary-rgb),0.4)]"
                  )}
                  style={{ width: `${metrics.percentage}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-8 py-6 border-y border-border/40">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 opacity-70">
                  <div className="w-1.5 h-1.5 rounded-full bg-success" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Executado</p>
                </div>
                <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">
                  R$ {metrics.impactActed.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 opacity-70">
                  <div className="w-1.5 h-1.5 rounded-full bg-warning" />
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pendente</p>
                </div>
                <p className="text-2xl font-black text-foreground tracking-tight tabular-nums">
                  R$ {metrics.impactPending.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
                </p>
              </div>
            </div>

            <div className="pt-2">
              {isComplete ? (
                <div className="flex items-center gap-3 text-success bg-success/10 p-4 rounded-2xl border border-success/20 animate-in zoom-in-95 duration-500">
                  <div className="p-2 rounded-full bg-success/20">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-tight">Excelente trabalho!</p>
                    <p className="text-[11px] opacity-80 font-medium leading-tight">Suas metas críticas para hoje foram alcançadas.</p>
                  </div>
                </div>
              ) : metrics.total > 0 ? (
                <div className="flex items-center gap-3 text-primary bg-primary/5 p-4 rounded-2xl border border-primary/10">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Zap className="h-5 w-5 shrink-0 animate-pulse text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-tight">Ações pendentes</p>
                    <p className="text-[11px] text-muted-foreground font-medium leading-tight">Você ainda tem <span className="text-primary font-bold">{metrics.total - metrics.completed} tarefas</span> para finalizar hoje.</p>
                  </div>
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <div className="h-full">
          <TodayActionsBlock isLeanView />
        </div>
      </div>
    </div>
  );
}
