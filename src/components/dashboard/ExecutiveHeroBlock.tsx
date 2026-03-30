import { TrendingUp, TrendingDown, DollarSign, Target, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRef, useState, useMemo, useEffect } from "react";
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
    <div className="space-y-8 mb-8 animate-fade-in">
      {/* SEÇÃO: REALIZADO (FINANCEIRO) */}
      <div className="rounded-2xl border border-border/50 bg-card p-8 sm:p-10 shadow-sm relative overflow-hidden transition-all duration-300 hover:shadow-md">
        {/* Subtle accent line for distinction */}
        <div className="absolute top-0 left-0 w-1.5 h-full bg-success/30" />
        
        <div className="mb-10">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-success/80 shadow-[0_0_8px_rgba(34,197,94,0.4)]" />
            Realizado (Financeiro)
          </h2>
          <p className="text-sm text-muted-foreground/60 mt-1.5 font-medium">Fluxo de caixa consolidado no período</p>
        </div>

        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50 mb-2">
              {GRANULARITY_LABELS[granularity]} · {periodLabel}
            </p>
            <p className={`text-5xl sm:text-6xl font-extrabold tracking-tighter number-display animate-count-up ${balance >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(animatedBalance)}
            </p>
            <div className="flex items-center gap-4 mt-4">
              {margin > 0 && (
                <div className="px-2.5 py-1 rounded-full bg-muted/50 border border-border/30">
                  <p className="text-xs font-semibold text-muted-foreground">Margem {margin.toFixed(1)}%</p>
                </div>
              )}
              <ChangeBadge change={balanceChange} />
            </div>

            {showGoal && (
              <div className="mt-10 space-y-3 max-w-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground/70 flex items-center gap-1.5 font-semibold">
                    <Target className="h-3.5 w-3.5 opacity-70" /> {goalLabel}: {formatCurrency(effectiveGoal)}
                  </span>
                  <Badge variant="outline" className={`text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 h-6 border-none shadow-none ${goalStatus.className}`}>
                    {goalStatus.label}
                  </Badge>
                </div>
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/40">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-in-out ${progressColor} shadow-[0_0_10px_rgba(var(--primary),0.2)]`}
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40">
                  {goalPct}% atingido
                </p>
              </div>
            )}
          </div>

          {/* Realized Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-5 sm:min-w-[280px]">
            <div className="flex items-center gap-4 rounded-2xl bg-success/[0.02] border border-success/10 p-5 transition-all duration-300 hover:bg-success/[0.04] hover:shadow-sm group">
              <div className="rounded-xl bg-success/10 p-3 group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Receita</p>
                <p className="text-2xl font-bold tracking-tight number-display text-foreground">{formatCurrency(animatedIncome)}</p>
              </div>
              <ChangeBadge change={incomeChange} />
            </div>
            
            <div className="flex items-center gap-4 rounded-2xl bg-destructive/[0.02] border border-destructive/10 p-5 transition-all duration-300 hover:bg-destructive/[0.04] hover:shadow-sm group">
              <div className="rounded-xl bg-destructive/10 p-3 group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Gastos</p>
                <p className="text-2xl font-bold tracking-tight number-display text-foreground">{formatCurrency(animatedExpense)}</p>
              </div>
              <ChangeBadge change={expenseChange} />
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO: PREVISÃO */}
      {forecastedRevenue > 0 && (
        <div className="rounded-2xl border border-border/40 bg-muted/30 p-8 shadow-sm transition-all duration-300 hover:bg-muted/40">
          <div className="mb-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground/70 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-primary/40" />
              Previsão
            </h2>
            <p className="text-sm text-muted-foreground/60 mt-1.5 font-medium">Estimativa de faturamento para serviços agendados</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-5 bg-background border border-border/50 rounded-2xl p-5 min-w-[280px] shadow-sm">
              <div className="rounded-xl bg-primary/5 p-3">
                <DollarSign className="h-6 w-6 text-primary/70" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-0.5">Faturamento previsto</p>
                <p className="text-3xl font-bold tracking-tight number-display text-foreground/90">{formatCurrency(forecastedRevenue)}</p>
              </div>
            </div>
            
            <div className="hidden sm:block text-xs text-muted-foreground/50 max-w-[280px] leading-relaxed italic">
              Este valor representa o faturamento bruto estimado de todas as ordens de serviço agendadas que ainda não foram concluídas.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
