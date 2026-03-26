import { useMemo } from "react";
import { Clock, TrendingUp, Users, BarChart3, Timer, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Progress } from "@/components/ui/progress";
import { useTimePerformance, formatMinutes } from "@/hooks/useTimePerformance";
import { SERVICE_TYPE_LABELS } from "@/hooks/useServices";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  startDate?: string;
  endDate?: string;
}

export function TimePerformanceDashboard({ startDate, endDate }: Props) {
  const { summary, isLoading } = useTimePerformance(startDate, endDate);

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Timer className="h-4 w-4 text-primary" />
            Performance de Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (summary.totalAnalyzed === 0) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Timer className="h-4 w-4 text-primary" />
            Performance de Tempo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma OS finalizada com tempo estimado e horários registrados neste período.
          </p>
        </CardContent>
      </Card>
    );
  }

  const overviewCards = [
    {
      icon: Clock,
      label: "Tempo médio estimado",
      value: formatMinutes(summary.avgEstimatedMin),
      color: "text-primary",
      bg: "bg-primary/10",
      tip: "Média do tempo estimado das OS finalizadas",
    },
    {
      icon: Timer,
      label: "Tempo médio real",
      value: formatMinutes(summary.avgActualMin),
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      tip: "Média do tempo real de execução (entrada → saída)",
    },
    {
      icon: TrendingUp,
      label: "Variação média",
      value: `${summary.avgDiffMin > 0 ? "+" : ""}${formatMinutes(summary.avgDiffMin)}`,
      color: summary.avgDiffMin > 0 ? "text-amber-500" : "text-emerald-500",
      bg: summary.avgDiffMin > 0 ? "bg-amber-500/10" : "bg-emerald-500/10",
      tip: "Diferença média entre tempo real e estimado",
    },
    {
      icon: AlertTriangle,
      label: "Taxa de atraso",
      value: `${summary.delayRate}%`,
      color: summary.delayRate > 30 ? "text-red-500" : summary.delayRate > 15 ? "text-amber-500" : "text-emerald-500",
      bg: summary.delayRate > 30 ? "bg-red-500/10" : summary.delayRate > 15 ? "bg-amber-500/10" : "bg-emerald-500/10",
      tip: `${summary.delayRate}% das OS levaram mais tempo que o estimado (>10% de variação)`,
    },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Timer className="h-4 w-4 text-primary" />
          Performance de Tempo
          <span className="text-xs font-normal text-muted-foreground ml-auto">
            {summary.totalAnalyzed} OS analisadas
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Overview cards */}
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-4">
            {overviewCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 cursor-help">
                      <div className={`rounded-lg p-2 ${card.bg}`}>
                        <Icon className={`h-4 w-4 ${card.color}`} />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">{card.label}</p>
                        <p className="text-xl font-bold text-card-foreground">{card.value}</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs max-w-[200px]">{card.tip}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>

        {/* By technician */}
        {summary.byTechnician.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ranking por Técnico</p>
            </div>
            <div className="space-y-2.5">
              {summary.byTechnician.map((tech, i) => (
                <div key={tech.userId} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-muted-foreground w-5">{i + 1}º</span>
                      <span className="font-medium text-foreground truncate max-w-[140px]">{tech.fullName}</span>
                      <span className="text-[10px] text-muted-foreground">({tech.serviceCount} OS)</span>
                    </div>
                    <span className={`text-xs font-semibold ${tech.efficiencyPercent >= 90 ? "text-emerald-600 dark:text-emerald-400" : tech.efficiencyPercent >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                      {tech.efficiencyPercent}%
                    </span>
                  </div>
                  <Progress
                    value={Math.min(tech.efficiencyPercent, 100)}
                    className="h-1.5"
                  />
                  <div className="flex gap-3 text-[10px] text-muted-foreground">
                    <span>Est: {formatMinutes(tech.avgEstimatedMin)}</span>
                    <span>Real: {formatMinutes(tech.avgActualMin)}</span>
                    <span>Dif: {tech.avgDiffMin > 0 ? "+" : ""}{formatMinutes(tech.avgDiffMin)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By service type */}
        {summary.byType.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-2.5">
              <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duração por Tipo</p>
            </div>
            <div className="space-y-2">
              {summary.byType.map((t) => {
                const label = (SERVICE_TYPE_LABELS as Record<string, string>)[t.serviceType] || t.serviceType;
                const isOver = t.avgDiffMin > 0;
                return (
                  <div key={t.serviceType} className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{label}</p>
                      <p className="text-[10px] text-muted-foreground">{t.count} OS</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatMinutes(t.avgActualMin)}
                      </p>
                      <p className={`text-[10px] font-medium ${isOver ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        {isOver ? "+" : ""}{formatMinutes(t.avgDiffMin)} vs estimado
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
