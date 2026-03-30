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
    <div className="space-y-12 mb-12 animate-fade-in">
      {/* SEÇÃO: REALIZADO (FINANCEIRO) */}
      <div className="rounded-[2.5rem] border border-border/40 bg-card p-10 sm:p-14 shadow-[0_8px_30px_rgb(0,0,0,0.04)] relative overflow-hidden transition-all duration-500 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] hover:-translate-y-1 group">
        {/* Decorative background elements for premium feel */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-success/5 rounded-full blur-3xl -mr-32 -mt-32 opacity-50 group-hover:opacity-100 transition-opacity duration-700" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -ml-24 -mb-24 opacity-30 group-hover:opacity-60 transition-opacity duration-700" />
        
        {/* Subtle accent line for distinction */}
        <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-success/40 to-success/10" />
        
        <div className="mb-14 relative">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-muted-foreground/50 flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-success/60 shadow-[0_0_12px_rgba(34,197,94,0.5)] animate-pulse" />
            Performance Financeira
          </h2>
          <p className="text-base text-muted-foreground/60 mt-2 font-medium tracking-tight">Fluxo de caixa consolidado no período ativo</p>
        </div>

        <div className="flex flex-col gap-14 lg:flex-row lg:items-start lg:justify-between relative">
          <div className="flex-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-muted-foreground/40 mb-3">
              {GRANULARITY_LABELS[granularity]} · {periodLabel}
            </p>
            <div className="flex items-baseline gap-4">
              <p className={`text-6xl sm:text-7xl font-black tracking-tighter number-display animate-count-up drop-shadow-sm ${balance >= 0 ? "text-success bg-gradient-to-br from-success to-success/70 bg-clip-text text-transparent" : "text-destructive"}`}>
                {formatCurrency(animatedBalance)}
              </p>
            </div>
            
            <div className="flex items-center gap-5 mt-6">
              {margin > 0 && (
                <div className="px-4 py-1.5 rounded-full bg-muted/30 border border-border/20 shadow-sm">
                  <p className="text-[11px] font-bold text-muted-foreground/80 tracking-wide uppercase">Margem {margin.toFixed(1)}%</p>
                </div>
              )}
              <div className="scale-110">
                <ChangeBadge change={balanceChange} />
              </div>
            </div>

            {showGoal && (
              <div className="mt-14 space-y-4 max-w-lg">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground/60 flex items-center gap-2 font-bold uppercase tracking-wider">
                    <Target className="h-4 w-4 opacity-50 text-primary" /> {goalLabel}: <span className="text-foreground/80">{formatCurrency(effectiveGoal)}</span>
                  </span>
                  <Badge variant="outline" className={`text-[10px] uppercase font-black tracking-[0.15em] px-4 py-1.5 h-7 border-none shadow-none rounded-full ${goalStatus.className}`}>
                    {goalStatus.label}
                  </Badge>
                </div>
                <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-muted/40 p-0.5 border border-border/10">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 cubic-bezier(0.4, 0, 0.2, 1) ${progressColor} shadow-[0_0_15px_rgba(var(--primary),0.3)]`}
                    style={{ width: `${goalPct}%` }}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30">
                    {goalPct}% atingido
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Realized Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-col gap-6 sm:min-w-[320px]">
            <div className="flex items-center gap-5 rounded-[1.5rem] bg-success/[0.01] border border-success/10 p-7 transition-all duration-500 hover:bg-success/[0.03] hover:shadow-[0_8px_20px_rgba(34,197,94,0.06)] hover:-translate-x-1 group/item">
              <div className="rounded-2xl bg-success/10 p-4 group-hover/item:scale-110 transition-all duration-500 shadow-sm shadow-success/10 ring-4 ring-success/5">
                <TrendingUp className="h-6 w-6 text-success" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">Receita</p>
                <p className="text-3xl font-bold tracking-tight number-display text-foreground/90">{formatCurrency(animatedIncome)}</p>
              </div>
              <div className="scale-110">
                <ChangeBadge change={incomeChange} />
              </div>
            </div>
            
            <div className="flex items-center gap-5 rounded-[1.5rem] bg-destructive/[0.01] border border-destructive/10 p-7 transition-all duration-500 hover:bg-destructive/[0.03] hover:shadow-[0_8px_20px_rgba(239,68,68,0.06)] hover:-translate-x-1 group/item">
              <div className="rounded-2xl bg-destructive/10 p-4 group-hover/item:scale-110 transition-all duration-500 shadow-sm shadow-destructive/10 ring-4 ring-destructive/5">
                <TrendingDown className="h-6 w-6 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">Gastos</p>
                <p className="text-3xl font-bold tracking-tight number-display text-foreground/90">{formatCurrency(animatedExpense)}</p>
              </div>
              <div className="scale-110">
                <ChangeBadge change={expenseChange} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO: PREVISÃO */}
      {forecastedRevenue > 0 && (
        <div className="rounded-[2.5rem] border border-primary/10 bg-gradient-to-br from-primary/[0.03] via-primary/[0.01] to-transparent p-10 sm:p-14 shadow-[0_8px_30px_rgb(0,0,0,0.02)] transition-all duration-500 hover:shadow-[0_20px_40px_rgba(var(--primary),0.05)] hover:-translate-y-1 group overflow-hidden relative">
          {/* Bluish accent for forecast */}
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-primary/5 rounded-full blur-[100px] opacity-40 group-hover:opacity-70 transition-opacity duration-700" />
          
          <div className="mb-10 relative">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.25em] text-primary/60 flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-primary/40 shadow-[0_0_12px_rgba(var(--primary),0.4)]" />
              Previsão Estratégica
            </h2>
            <p className="text-base text-muted-foreground/50 mt-2 font-medium tracking-tight">Potencial de faturamento futuro baseado em agendamentos</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-10 relative">
            <div className="flex items-center gap-6 bg-background border border-border/40 rounded-[2rem] p-7 min-w-[340px] shadow-sm transition-all duration-500 group-hover:shadow-md group-hover:border-primary/20">
              <div className="rounded-2xl bg-primary/5 p-4 ring-4 ring-primary/[0.02]">
                <DollarSign className="h-8 w-8 text-primary/60" />
              </div>
              <div>
                <p className="text-[11px] font-black uppercase tracking-[0.2em] text-muted-foreground/40 mb-1">Faturamento previsto</p>
                <p className="text-4xl font-extrabold tracking-tight number-display text-foreground/80">{formatCurrency(forecastedRevenue)}</p>
              </div>
            </div>
            
            <div className="hidden lg:block text-sm text-muted-foreground/40 max-w-[320px] leading-relaxed font-medium italic">
              "Este valor representa o faturamento bruto estimado de todas as ordens de serviço agendadas que ainda não foram concluídas no sistema."
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
