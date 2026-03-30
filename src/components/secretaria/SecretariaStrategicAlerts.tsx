import { useNavigate } from "react-router-dom";
import { useStrategicAlerts, type StrategicAlert } from "@/hooks/useStrategicAlerts";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, ChevronRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useDailyRoutine } from "@/hooks/useDailyRoutine";

const levelConfig: Record<
  StrategicAlert["level"],
  { border: string; bg: string; icon: typeof AlertTriangle; iconColor: string; label: string }
> = {
  critical: {
    border: "border-l-red-500",
    bg: "bg-red-500/5",
    icon: AlertTriangle,
    iconColor: "text-red-500",
    label: "Alerta Crítico",
  },
  opportunity: {
    border: "border-l-emerald-500",
    bg: "bg-emerald-500/5",
    icon: TrendingUp,
    iconColor: "text-emerald-500",
    label: "Oportunidade",
  },
  trend: {
    border: "border-l-amber-500",
    bg: "bg-amber-500/5",
    icon: TrendingDown,
    iconColor: "text-amber-500",
    label: "Tendência",
  },
};

export function SecretariaStrategicAlerts() {
  const { alerts, isLoading } = useStrategicAlerts();
  const { markAlertAsCompleted, completedAlerts } = useDailyRoutine();
  const navigate = useNavigate();

  if (isLoading) return null;

  if (alerts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-muted p-8 text-center bg-card/50">
        <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center animate-bounce duration-1000">
          <CheckCircle className="h-8 w-8 text-emerald-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-base font-bold text-foreground">Tudo sob controle!</h3>
          <p className="text-sm text-muted-foreground max-w-[240px]">
            Não encontramos pontos críticos para ajuste hoje. Ótima gestão!
          </p>
        </div>
      </div>
    );
  }

  const handleAction = (alert: StrategicAlert) => {
    markAlertAsCompleted(alert.id);
    navigate(alert.actionRoute);
  };

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
          Ações Recomendadas
        </span>
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
          {alerts.length} pendentes
        </span>
      </div>
      
      {alerts.map((alert) => {
        const cfg = levelConfig[alert.level];
        const Icon = cfg.icon;
        const isCompleted = completedAlerts.includes(alert.id);

        return (
          <div
            key={alert.id}
            className={cn(
              "group relative rounded-xl border border-border border-l-4 p-4 cursor-pointer hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all duration-300",
              cfg.border,
              cfg.bg,
              isCompleted && "opacity-60 bg-muted/10 border-l-muted hover:shadow-none hover:scale-100 cursor-default"
            )}
            onClick={() => !isCompleted && handleAction(alert)}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                isCompleted ? "bg-muted" : "bg-white/10 dark:bg-black/10"
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Icon className={cn("h-5 w-5", cfg.iconColor)} />
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className={cn(
                    "text-sm font-bold truncate",
                    isCompleted ? "text-muted-foreground line-through decoration-muted-foreground/40" : "text-foreground"
                  )}>
                    {alert.title}
                  </h3>
                  <span className={cn(
                    "text-xs font-bold whitespace-nowrap px-1.5 py-0.5 rounded",
                    isCompleted ? "text-muted-foreground bg-muted/50" : "text-foreground bg-white/20"
                  )}>
                    {alert.financialImpact}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {alert.consequence}
                </p>
              </div>

              {!isCompleted && (
                <div className="shrink-0 flex items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </div>

            {!isCompleted && (
              <div className="mt-3 pt-3 border-t border-border/50 flex justify-end">
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-primary font-bold text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAction(alert);
                  }}
                >
                  {alert.actionLabel}
                  <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
