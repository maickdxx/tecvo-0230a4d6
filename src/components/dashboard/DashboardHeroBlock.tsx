import { TrendingUp, TrendingDown, DollarSign, Sparkles } from "lucide-react";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";

interface DashboardHeroBlockProps {
  income: number;
  expense: number;
  balance: number;
  margin: number;
  forecastedRevenue: number;
  periodLabel: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function useQuickInsight(): string | null {
  const { weather } = useWeatherForecast();
  if (!weather?.days?.length) return null;
  const avgMax = weather.days.reduce((s, d) => s + d.tempMax, 0) / weather.days.length;
  const rainyDays = weather.days.filter((d) => d.precipProbability > 60);
  if (avgMax > 30) return "🔥 Semana quente → boa para limpezas e instalações";
  if (rainyDays.length >= 3) return "🌧️ Chuva prevista → priorize serviços internos";
  if (avgMax < 18) return "❄️ Semana fria → foque em contratos e manutenções";
  return "☀️ Clima favorável → ideal para todas as operações";
}

export function DashboardHeroBlock({
  income,
  expense,
  balance,
  margin,
  forecastedRevenue,
  periodLabel,
}: DashboardHeroBlockProps) {
  const insight = useQuickInsight();

  return (
    <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 sm:p-7 shadow-card mb-6">
      {/* Decorative accent */}
      <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-primary via-primary/60 to-transparent" />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Main metric: Lucro Real */}
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
            Lucro Real · {periodLabel}
          </p>
          <p className={`text-4xl sm:text-5xl font-bold tracking-tight ${balance >= 0 ? "text-success" : "text-destructive"}`}>
            {formatCurrency(balance)}
          </p>
          {margin > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              Margem {margin.toFixed(1)}%
            </p>
          )}
        </div>

        {/* Side metrics */}
        <div className="flex flex-col gap-3 sm:min-w-[220px]">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-success/10 p-2">
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Receita</p>
              <p className="text-lg font-bold text-card-foreground">{formatCurrency(income)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-destructive/10 p-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">Gastos</p>
              <p className="text-lg font-bold text-card-foreground">{formatCurrency(expense)}</p>
            </div>
          </div>
          {forecastedRevenue > 0 && (
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2">
                <DollarSign className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">Previsto</p>
                <p className="text-lg font-bold text-card-foreground">{formatCurrency(forecastedRevenue)}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* AI Insight */}
      {insight && (
        <div className="mt-4 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2">
          <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
          <p className="text-xs text-muted-foreground">{insight}</p>
        </div>
      )}
    </div>
  );
}
