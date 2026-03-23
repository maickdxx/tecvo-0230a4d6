import { useNavigate } from "react-router-dom";
import type { WeeklyImpactMetrics, WeeklyInsight } from "@/hooks/useWeeklyInsights";
import { DollarSign, Clock, AlertTriangle, ArrowRight, MessageSquare, CalendarClock, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface PontoImpactSummaryProps {
  impact: WeeklyImpactMetrics;
  insights?: WeeklyInsight[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtTime = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}min`;
};

interface ActionSuggestion {
  label: string;
  icon: typeof Clock;
  route?: string;
  secondary?: string;
}

function getOvertimeActions(minutes: number, cost: number | null): ActionSuggestion[] {
  if (minutes <= 0) return [];
  const actions: ActionSuggestion[] = [
    { label: "Revisar escalas", icon: CalendarClock, route: "/ponto-admin/escalas", secondary: "Ajustar jornada para reduzir extras" },
  ];
  if (minutes > 120) {
    actions.push({ label: "Redistribuir carga", icon: CalendarClock, route: "/ponto-admin/funcionarios", secondary: "Balancear equipe" });
  }
  return actions;
}

function getLatenessActions(lateDays: number): ActionSuggestion[] {
  if (lateDays < 2) return [];
  const actions: ActionSuggestion[] = [];
  if (lateDays >= 2) {
    actions.push({ label: "Revisar horário de entrada", icon: CalendarClock, route: "/ponto-admin/escalas", secondary: "Adequar escala ao perfil" });
  }
  if (lateDays >= 3) {
    actions.push({ label: "Conversar com funcionário", icon: MessageSquare, secondary: "Atrasos recorrentes detectados" });
  }
  return actions;
}

function getIncompleteActions(count: number): ActionSuggestion[] {
  if (count <= 0) return [];
  return [
    { label: "Corrigir registros pendentes", icon: ClipboardCheck, route: "/ponto-admin/ajustes", secondary: "Revisar antes do fechamento" },
  ];
}

export function PontoImpactSummary({ impact, insights = [] }: PontoImpactSummaryProps) {
  const navigate = useNavigate();
  const [expandedAction, setExpandedAction] = useState<string | null>(null);
  const { totalOvertimeMinutes, totalLateMinutes, totalIncompleteRecords, estimatedOvertimeCost } = impact;

  const hasOvertime = totalOvertimeMinutes > 0;
  const hasLate = totalLateMinutes > 0;
  const hasIncomplete = totalIncompleteRecords > 0;

  if (!hasOvertime && !hasLate && !hasIncomplete) return null;

  // Determine lateness days from insights
  const latenessInsight = insights.find(i => i.type === "recurring_lateness");
  const lateDayCount = latenessInsight ? (latenessInsight.severity === "critical" ? 3 : 2) : (hasLate ? 1 : 0);

  // Build impact items with actions
  const items: { icon: typeof Clock; label: string; value: string; color: string; actions: ActionSuggestion[] }[] = [];

  if (hasOvertime) {
    const valueStr = estimatedOvertimeCost != null
      ? `+${fmtTime(totalOvertimeMinutes)} (~${fmt(estimatedOvertimeCost)})`
      : `+${fmtTime(totalOvertimeMinutes)}`;
    items.push({
      icon: DollarSign,
      label: "Extras na semana",
      value: valueStr,
      color: "text-amber-600 dark:text-amber-400",
      actions: getOvertimeActions(totalOvertimeMinutes, estimatedOvertimeCost),
    });
  }

  if (hasLate) {
    items.push({
      icon: Clock,
      label: "Atrasos acumulados",
      value: fmtTime(totalLateMinutes),
      color: "text-orange-600 dark:text-orange-400",
      actions: getLatenessActions(lateDayCount),
    });
  }

  if (hasIncomplete) {
    items.push({
      icon: AlertTriangle,
      label: "Registros incompletos",
      value: `${totalIncompleteRecords} ${totalIncompleteRecords > 1 ? "podem impactar" : "pode impactar"} fechamento`,
      color: "text-red-500 dark:text-red-400",
      actions: getIncompleteActions(totalIncompleteRecords),
    });
  }

  // Executive alert — show only when multiple issues combine
  const issueCount = [hasOvertime, lateDayCount >= 2, hasIncomplete].filter(Boolean).length;
  const showExecutiveAlert = issueCount >= 2;

  return (
    <div className="rounded-lg border border-border/30 bg-muted/10 p-2.5 space-y-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 px-1">
        Impacto operacional
      </p>

      {showExecutiveAlert && (
        <div className="flex items-center gap-2 rounded-md bg-destructive/5 border border-destructive/20 px-2.5 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-destructive" />
          <span className="text-[11px] text-destructive font-medium">
            Atenção: comportamento recorrente pode impactar produtividade da equipe
          </span>
        </div>
      )}

      <div className="grid gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const key = item.label;
          const isExpanded = expandedAction === key;
          const hasActions = item.actions.length > 0;

          return (
            <div key={key} className="space-y-0.5">
              <button
                type="button"
                onClick={() => hasActions && setExpandedAction(isExpanded ? null : key)}
                className={cn(
                  "flex items-center gap-2 rounded-md bg-background/50 border border-border/20 px-2.5 py-1.5 w-full text-left transition-colors",
                  hasActions && "hover:bg-muted/30 cursor-pointer",
                  !hasActions && "cursor-default"
                )}
              >
                <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", item.color)} />
                <div className="flex items-baseline gap-1.5 min-w-0 flex-wrap flex-1">
                  <span className="text-[11px] text-muted-foreground">{item.label}:</span>
                  <span className={cn("text-xs font-medium", item.color)}>{item.value}</span>
                </div>
                {hasActions && (
                  <ArrowRight className={cn(
                    "h-3 w-3 text-muted-foreground/50 transition-transform flex-shrink-0",
                    isExpanded && "rotate-90"
                  )} />
                )}
              </button>

              {isExpanded && item.actions.length > 0 && (
                <div className="pl-6 space-y-0.5">
                  {item.actions.map((action) => {
                    const ActionIcon = action.icon;
                    return (
                      <div
                        key={action.label}
                        className="flex items-center gap-2 rounded-md bg-muted/20 px-2 py-1"
                      >
                        <ActionIcon className="h-3 w-3 text-muted-foreground/60 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium text-foreground/80">{action.label}</p>
                          {action.secondary && (
                            <p className="text-[10px] text-muted-foreground/60">{action.secondary}</p>
                          )}
                        </div>
                        {action.route && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 px-1.5 text-[10px]"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(action.route!);
                            }}
                          >
                            Ir <ArrowRight className="h-2.5 w-2.5 ml-0.5" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
