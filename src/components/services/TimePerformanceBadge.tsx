import { Clock, TrendingDown, TrendingUp, CheckCircle2 } from "lucide-react";
import { calcServiceTimeMetrics, formatMinutes } from "@/hooks/useTimePerformance";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  entryDate: string | null;
  exitDate: string | null;
  estimatedDuration: string | null | undefined;
}

export function TimePerformanceBadge({ entryDate, exitDate, estimatedDuration }: Props) {
  if (!entryDate || !exitDate || !estimatedDuration) return null;

  const metrics = calcServiceTimeMetrics(entryDate, exitDate, estimatedDuration);
  if (!metrics) return null;

  const config = {
    faster: {
      icon: TrendingDown,
      label: "Mais rápido",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    on_time: {
      icon: CheckCircle2,
      label: "No prazo",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950/40",
      border: "border-emerald-200 dark:border-emerald-800",
    },
    slight_delay: {
      icon: Clock,
      label: "Leve atraso",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-50 dark:bg-amber-950/40",
      border: "border-amber-200 dark:border-amber-800",
    },
    big_delay: {
      icon: TrendingUp,
      label: "Atraso significativo",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-50 dark:bg-red-950/40",
      border: "border-red-200 dark:border-red-800",
    },
  };

  const c = config[metrics.status];
  const Icon = c.icon;
  const diffLabel = metrics.diffMin > 0 ? `+${formatMinutes(metrics.diffMin)}` : formatMinutes(metrics.diffMin);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${c.bg} ${c.color} ${c.border}`}>
            <Icon className="h-3.5 w-3.5" />
            <span>{diffLabel}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[220px]">
          <div className="space-y-1 text-xs">
            <p className="font-medium">{c.label}</p>
            <p>Estimado: {formatMinutes(metrics.estimatedMin)}</p>
            <p>Real: {formatMinutes(metrics.actualMin)}</p>
            <p>Variação: {metrics.diffPercent > 0 ? "+" : ""}{metrics.diffPercent}%</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
