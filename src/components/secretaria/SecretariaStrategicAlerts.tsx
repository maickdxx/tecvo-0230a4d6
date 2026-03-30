import { useNavigate } from "react-router-dom";
import { useStrategicAlerts, type StrategicAlert } from "@/hooks/useStrategicAlerts";
import { AlertTriangle, TrendingUp, TrendingDown, CheckCircle, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const navigate = useNavigate();

  if (isLoading) return null;

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-border bg-card p-4">
        <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Sem alertas estratégicos no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const cfg = levelConfig[alert.level];
        const Icon = cfg.icon;

        return (
          <div
            key={alert.id}
            className={cn(
              "rounded-lg border border-border border-l-4 p-3 cursor-pointer hover:shadow-md transition-shadow",
              cfg.border,
              cfg.bg
            )}
            onClick={() => navigate(alert.actionRoute)}
          >
            <div className="flex items-start gap-3">
              <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", cfg.iconColor)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground truncate">
                    {alert.title}
                  </h3>
                  <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                    {alert.financialImpact}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {alert.consequence}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 px-2 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(alert.actionRoute);
                }}
              >
                {alert.actionLabel}
                <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
