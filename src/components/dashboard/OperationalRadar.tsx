import { Brain, Flame, CloudRain, Snowflake, Sun } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useWeatherForecast } from "@/hooks/useWeatherForecast";
import type { DayForecast } from "@/hooks/useWeatherForecast";

interface Insight {
  icon: React.ReactNode;
  text: string;
  colorClass: string;
}

function generateInsights(days: DayForecast[]): Insight[] {
  const insights: Insight[] = [];
  const avgMax = days.reduce((s, d) => s + d.tempMax, 0) / days.length;
  const avgMin = days.reduce((s, d) => s + d.tempMin, 0) / days.length;
  const maxTemp = Math.max(...days.map((d) => d.tempMax));
  const rainyDays = days.filter((d) => d.precipProbability > 60);
  const coldDays = days.filter((d) => d.tempMin < 12);

  // 1. Weekly summary
  if (avgMax > 30) {
    insights.push({
      icon: <Flame className="h-3.5 w-3.5 shrink-0" />,
      text: `Semana quente (${maxTemp}°C) → limpezas e instalações`,
      colorClass: "text-orange-600 dark:text-orange-400",
    });
  } else if (avgMin < 15) {
    insights.push({
      icon: <Snowflake className="h-3.5 w-3.5 shrink-0" />,
      text: `Semana fria (${Math.min(...days.map((d) => d.tempMin))}°C) → contratos e manutenções`,
      colorClass: "text-blue-600 dark:text-blue-400",
    });
  } else {
    insights.push({
      icon: <Sun className="h-3.5 w-3.5 shrink-0" />,
      text: `Clima ameno (${Math.round(avgMin)}°–${Math.round(avgMax)}°C) → operação normal`,
      colorClass: "text-emerald-600 dark:text-emerald-400",
    });
  }

  // 2. Critical days
  if (rainyDays.length > 0) {
    const dayNames = rainyDays.slice(0, 2).map((d) => d.dayName).join(" e ");
    insights.push({
      icon: <CloudRain className="h-3.5 w-3.5 shrink-0" />,
      text: `${dayNames} com chuva → evite serviços externos`,
      colorClass: "text-sky-600 dark:text-sky-400",
    });
  }

  if (coldDays.length > 0 && avgMax <= 30) {
    insights.push({
      icon: <Snowflake className="h-3.5 w-3.5 shrink-0" />,
      text: `${coldDays.length} dia${coldDays.length > 1 ? "s" : ""} frio${coldDays.length > 1 ? "s" : ""} → atenção equipamentos`,
      colorClass: "text-blue-600 dark:text-blue-400",
    });
  }

  // 3. HVAC tip
  if (avgMax > 30) {
    insights.push({
      icon: <Brain className="h-3.5 w-3.5 shrink-0" />,
      text: "Dica → ofereça manutenções preventivas",
      colorClass: "text-muted-foreground",
    });
  } else if (rainyDays.length >= 3) {
    insights.push({
      icon: <Brain className="h-3.5 w-3.5 shrink-0" />,
      text: "Dica → priorize serviços internos",
      colorClass: "text-muted-foreground",
    });
  } else if (avgMin < 15) {
    insights.push({
      icon: <Brain className="h-3.5 w-3.5 shrink-0" />,
      text: "Dica → prospecte contratos de manutenção",
      colorClass: "text-muted-foreground",
    });
  } else {
    insights.push({
      icon: <Brain className="h-3.5 w-3.5 shrink-0" />,
      text: "Dica → ideal para prospecção e visitas",
      colorClass: "text-muted-foreground",
    });
  }

  return insights.slice(0, 3);
}

export default function OperationalRadar() {
  const { weather, isLoading, error } = useWeatherForecast();

  if (error || (!isLoading && !weather)) return null;

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="h-5 w-5 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
          <Skeleton className="h-3 w-3/5" />
        </div>
      </Card>
    );
  }

  const insights = generateInsights(weather!.days);

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Radar Operacional</h3>
        {weather!.city && (
          <span className="text-[11px] text-muted-foreground ml-auto">{weather!.city}</span>
        )}
      </div>
      <ul className="space-y-1.5">
        {insights.map((insight, i) => (
          <li key={i} className={`flex items-start gap-2 text-xs leading-relaxed ${insight.colorClass}`}>
            {insight.icon}
            <span>{insight.text}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
