import { type WeeklyInsight } from "@/hooks/useWeeklyInsights";
import {
  AlertTriangle,
  Clock,
  LogOut,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Clock> = {
  recurring_lateness: Clock,
  recurring_incomplete: LogOut,
  weekly_summary: BarChart3,
};

const SEVERITY_STYLES: Record<string, string> = {
  info: "border-border/40 bg-muted/20",
  warning: "border-amber-200/60 bg-amber-50/30 dark:border-amber-800/40 dark:bg-amber-950/15",
  critical: "border-red-200/70 bg-red-50/40 dark:border-red-700/40 dark:bg-red-950/20",
};

const SEVERITY_ICON: Record<string, string> = {
  info: "text-muted-foreground",
  warning: "text-amber-500/80",
  critical: "text-red-500/80",
};

const SEVERITY_TITLE: Record<string, string> = {
  info: "text-muted-foreground text-xs",
  warning: "text-foreground/80 text-xs font-medium",
  critical: "text-foreground text-xs font-semibold",
};

interface PontoWeeklyInsightsProps {
  insights: WeeklyInsight[];
}

export function PontoWeeklyInsights({ insights }: PontoWeeklyInsightsProps) {
  if (insights.length === 0) return null;

  // Show patterns first, summary last
  const sorted = [...insights].sort((a, b) => {
    if (a.type === "weekly_summary") return 1;
    if (b.type === "weekly_summary") return -1;
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <div className="space-y-1 rounded-lg border border-border/30 bg-muted/10 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/60 px-1 mb-1">
        Últimos 7 dias
      </p>
      {sorted.map((insight) => {
        const Icon = ICONS[insight.type] || AlertTriangle;
        return (
          <div
            key={insight.id}
            className={cn(
              "flex items-start gap-2 rounded-md border px-2.5 py-1.5",
              SEVERITY_STYLES[insight.severity]
            )}
          >
            <Icon className={cn("h-3.5 w-3.5 mt-0.5 flex-shrink-0", SEVERITY_ICON[insight.severity])} />
            <div className="min-w-0">
              <p className={SEVERITY_TITLE[insight.severity]}>{insight.title}</p>
              <p className="text-[11px] text-muted-foreground/70 leading-tight">{insight.description}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
