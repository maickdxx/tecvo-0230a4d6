import { useMemo } from "react";
import { CheckCircle2, TrendingUp, Calendar } from "lucide-react";
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
      <div className="flex items-center justify-between px-1">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          Seu Dia na Tecvo
        </h2>
        <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border/50">
          <Calendar className="h-3 w-3" />
          {new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
        </div>
      </div>

      <Card className={cn(
        "border-none shadow-md transition-all duration-500 overflow-hidden relative",
        isComplete ? "bg-emerald-500/10 dark:bg-emerald-500/5 ring-2 ring-emerald-500/20" : "bg-gradient-to-br from-card to-muted/30"
      )}>
        {/* Progress Background */}
        <div 
          className="absolute top-0 left-0 h-1 bg-primary/20 transition-all duration-1000" 
          style={{ width: `${metrics.percentage}%` }}
        />

        <CardContent className="p-6 space-y-5">
          <div className="flex items-center justify-between gap-6">
            <div className="space-y-1.5">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {isComplete ? "Objetivo Alcançado" : "Checklist do Dia"}
              </p>
              <div className="space-y-0.5">
                <p className="text-2xl font-black text-foreground tracking-tight">
                  {metrics.total} {metrics.total === 1 ? 'ação recomendada' : 'ações recomendadas'} hoje
                </p>
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  {metrics.completed} concluídas
                </p>
              </div>
            </div>
            
            <div className="relative h-20 w-20 flex items-center justify-center shrink-0">
               <svg className="h-full w-full -rotate-90 drop-shadow-sm">
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted/20"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="34"
                  fill="transparent"
                  stroke="currentColor"
                  strokeWidth="6"
                  strokeDasharray={213.6}
                  strokeDashoffset={213.6 - (213.6 * metrics.percentage) / 100}
                  strokeLinecap="round"
                  className={cn(
                    "transition-all duration-1000",
                    isComplete ? "text-emerald-500" : "text-primary"
                  )}
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-xl font-black">{Math.round(metrics.percentage)}%</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-border/50">
            <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 space-y-1">
              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Impacto Gerado
              </p>
              <p className="text-xl font-black text-foreground">
                Hoje você já atuou sobre R$ {metrics.impactActed.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 space-y-1">
              <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest">
                Pendente
              </p>
              <p className="text-xl font-black text-foreground">
                Você pode ainda recuperar R$ {metrics.impactPending.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}
              </p>
            </div>
          </div>

          {isComplete && (
            <div className="pt-2 flex items-center justify-center gap-2 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 py-3 rounded-xl animate-bounce">
              <CheckCircle2 className="h-5 w-5" />
              <p className="text-sm font-black uppercase tracking-tight">Dia sob controle. Nenhuma pendência crítica!</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
