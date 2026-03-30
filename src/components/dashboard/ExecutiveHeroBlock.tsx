import { TrendingUp, TrendingDown, DollarSign, Target, Sparkles, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import { useEffect, useRef, useState, useMemo } from "react";
import type { Granularity } from "@/lib/periodoGlobal";

interface ExecutiveHeroBlockProps {
  income: number;
  expense: number;
  balance: number;
  margin: number;
  forecastedRevenue: number;
  periodLabel: string;
  monthlyGoal?: number | null;
  suggestedGoal?: number;
  incomeChange?: number | null;
  expenseChange?: number | null;
  balanceChange?: number | null;
  granularity: Granularity;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function useCountUp(target: number, duration = 800) {
  const [value, setValue] = useState(0);
  const prevTarget = useRef(0);

  useEffect(() => {
    const start = prevTarget.current;
    prevTarget.current = target;
    const diff = target - start;
    if (diff === 0) { setValue(target); return; }

    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(start + diff * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);

  return value;
}

function ChangeBadge({ change }: { change?: number | null }) {
  if (change == null || change === 0) return null;
  const isUp = change > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-success" : "text-destructive"}`}>
      {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isUp ? "+" : ""}{change.toFixed(0)}%
    </span>
  );
}

const GRANULARITY_LABELS: Record<Granularity, string> = {
  day: "Lucro do Dia",
  week: "Lucro da Semana",
  month: "Lucro do Mês",
};


export function ExecutiveHeroBlock({
  income,
  expense,
  balance,
  margin,
  forecastedRevenue,
  periodLabel,
  monthlyGoal,
  suggestedGoal,
  incomeChange,
  expenseChange,
  balanceChange,
  granularity,
}: ExecutiveHeroBlockProps) {
  // Goal logic — only show for month; proportional for week; hidden for day
  const { effectiveGoal, showGoal } = useMemo(() => {
    const rawGoal = monthlyGoal ?? suggestedGoal ?? (income > 0 ? Math.round(income * 1.2) : 0);

    if (granularity === "month") {
      return { effectiveGoal: rawGoal, showGoal: rawGoal > 0 };
    }
    if (granularity === "week") {
      const now = new Date();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const weeksInMonth = Math.ceil(daysInMonth / 7);
      return { effectiveGoal: Math.round(rawGoal / weeksInMonth), showGoal: rawGoal > 0 };
    }
    // day — hide goal
    return { effectiveGoal: 0, showGoal: false };
  }, [monthlyGoal, suggestedGoal, income, granularity]);

  const insight = useQuickInsight(income, effectiveGoal, granularity);
  const animatedBalance = useCountUp(balance);
  const animatedIncome = useCountUp(income);
  const animatedExpense = useCountUp(expense);

  const goalPct = effectiveGoal > 0 ? Math.min(Math.round((income / effectiveGoal) * 100), 100) : 0;
  const isManualGoal = monthlyGoal != null && monthlyGoal > 0;

  const goalStatus =
    goalPct >= 100
      ? { label: "Acima da meta", className: "bg-success/10 text-success border-success/20" }
      : goalPct >= 60
        ? { label: "Dentro da meta", className: "bg-primary/10 text-primary border-primary/20" }
        : { label: "Abaixo da meta", className: "bg-destructive/10 text-destructive border-destructive/20" };

  const progressColor =
    goalPct >= 100 ? "bg-success" : goalPct >= 60 ? "bg-primary" : "bg-destructive";

  const goalLabel = granularity === "week" ? "Meta de receita da semana" : `Meta de receita${isManualGoal ? "" : " (sugerida)"}`;

  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8 shadow-card mb-6 animate-fade-in">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            {GRANULARITY_LABELS[granularity]} · {periodLabel}
          </p>
          <p className={`text-4xl sm:text-5xl number-display animate-count-up ${balance >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(animatedBalance)}
          </p>
          <div className="flex items-center gap-3 mt-1">
            {margin > 0 && (
              <p className="text-sm text-muted-foreground">Margem {margin.toFixed(1)}%</p>
            )}
            <ChangeBadge change={balanceChange} />
          </div>

          {showGoal && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Target className="h-3 w-3" /> {goalLabel}: {formatCurrency(effectiveGoal)}
                </span>
                <Badge variant="outline" className={goalStatus.className}>
                  {goalStatus.label}
                </Badge>
              </div>
              <div className="relative h-3 w-full overflow-hidden rounded-full bg-secondary/80">
                <div
                  className={`h-full rounded-full transition-all duration-500 ease-out ${progressColor}`}
                  style={{ width: `${goalPct}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                {goalPct}% atingido
              </p>
            </div>
          )}
        </div>

        {/* Side metrics */}
        <div className="flex flex-col gap-3 sm:min-w-[220px]">
          <div className="flex items-center gap-3 rounded-xl bg-success/5 border border-success/10 p-3 transition-all duration-200 hover:bg-success/10 hover:shadow-sm">
            <div className="rounded-lg bg-success/10 p-2">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Receita</p>
              <p className="text-lg number-display text-card-foreground">{formatCurrency(animatedIncome)}</p>
            </div>
            <ChangeBadge change={incomeChange} />
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-destructive/5 border border-destructive/10 p-3 transition-all duration-200 hover:bg-destructive/10 hover:shadow-sm">
            <div className="rounded-lg bg-destructive/10 p-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Gastos</p>
              <p className="text-lg number-display text-card-foreground">{formatCurrency(animatedExpense)}</p>
            </div>
            <ChangeBadge change={expenseChange} />
          </div>
          {forecastedRevenue > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-primary/5 border border-primary/10 p-3 transition-all duration-200 hover:bg-primary/10 hover:shadow-sm">
              <div className="rounded-lg bg-primary/10 p-2">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Previsto</p>
                <p className="text-lg number-display text-card-foreground">{formatCurrency(forecastedRevenue)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Insight */}
      {insight && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-primary/10 bg-primary/5 px-4 py-2.5">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">{insight}</p>
        </div>
      )}
    </div>
  );
}
