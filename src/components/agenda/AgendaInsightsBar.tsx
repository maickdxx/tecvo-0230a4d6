import { DollarSign, FileText, Activity, Clock, Truck, Timer, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OperationalCapacity } from "@/hooks/useOperationalCapacity";

interface AgendaInsightsBarProps {
  capacity: OperationalCapacity;
  viewMode?: "day" | "week" | "month";
}

interface InsightCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

function fmtTime(min: number): string {
  if (min === 0) return "0h";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}h${m > 0 ? `${m}m` : ""}` : `${m}m`;
}

const currencyFmt = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function AgendaInsightsBar({ capacity, viewMode = "day" }: AgendaInsightsBarProps) {
  if (capacity.isNonOperational) {
    return (
      <div className="glass-card rounded-xl p-6 animate-blur-in flex items-center gap-3">
        <Ban className="h-5 w-5 text-muted-foreground" />
        <div>
          <p className="text-sm font-medium text-foreground">Dia não operacional</p>
          <p className="text-xs text-muted-foreground">Fora da jornada de trabalho configurada</p>
        </div>
      </div>
    );
  }

  const {
    productiveOccupancy,
    totalOccupancy,
    predictedRevenue,
    serviceCount,
    productiveMin,
    travelMin,
    idleMin,
    revenuePerProductiveHour,
  } = capacity;

  const periodLabel = viewMode === "month" ? "no Mês" : viewMode === "week" ? "na Semana" : "no Dia";

  const insights: InsightCard[] = [
    {
      label: `Receita ${periodLabel}`,
      value: currencyFmt.format(predictedRevenue),
      icon: <DollarSign className="h-4 w-4" />,
      color: "text-primary",
    },
    {
      label: `OS ${periodLabel}`,
      value: String(serviceCount),
      icon: <FileText className="h-4 w-4" />,
      color: "text-info",
    },
    {
      label: "Ocupação Produtiva",
      value: `${productiveOccupancy}%`,
      icon: <Activity className="h-4 w-4" />,
      color: productiveOccupancy > 85 ? "text-destructive" : productiveOccupancy > 60 ? "text-warning" : "text-success",
    },
    {
      label: "Ocupação Total",
      value: `${totalOccupancy}%`,
      icon: <Timer className="h-4 w-4" />,
      color: totalOccupancy > 90 ? "text-destructive" : totalOccupancy > 70 ? "text-warning" : "text-success",
    },
    {
      label: "Produtivo",
      value: fmtTime(productiveMin),
      icon: <Activity className="h-4 w-4" />,
      color: "text-success",
    },
    {
      label: "Deslocamento",
      value: fmtTime(travelMin),
      icon: <Truck className="h-4 w-4" />,
      color: capacity.travelAlert ? "text-destructive" : "text-warning",
    },
    {
      label: "Ocioso",
      value: fmtTime(idleMin),
      icon: <Clock className="h-4 w-4" />,
      color: idleMin > 120 ? "text-warning" : "text-muted-foreground",
    },
    {
      label: "R$/h Produtiva",
      value: currencyFmt.format(revenuePerProductiveHour),
      icon: <DollarSign className="h-4 w-4" />,
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {insights.map((card) => (
          <div key={card.label} className="glass-card rounded-xl p-4 animate-blur-in">
            <div className="flex items-center gap-2 mb-1">
              <span className={cn("opacity-70", card.color)}>{card.icon}</span>
              <span className="text-xs text-muted-foreground">{card.label}</span>
            </div>
            <p className={cn("number-display text-xl", card.color)}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Day breakdown chart */}
      {(productiveMin > 0 || travelMin > 0) && (
        <DayBreakdownBar
          productiveMin={productiveMin}
          travelMin={travelMin}
          idleMin={idleMin}
          travelAlert={capacity.travelAlert}
        />
      )}
    </div>
  );
}

function DayBreakdownBar({
  productiveMin,
  travelMin,
  idleMin,
  travelAlert,
}: {
  productiveMin: number;
  travelMin: number;
  idleMin: number;
  travelAlert: boolean;
}) {
  const total = productiveMin + travelMin + idleMin;
  if (total === 0) return null;

  const pctProd = (productiveMin / total) * 100;
  const pctTravel = (travelMin / total) * 100;
  const pctIdle = (idleMin / total) * 100;

  return (
    <div className="glass-card rounded-xl p-4 animate-blur-in">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-foreground">Divisão do Dia</span>
        {travelAlert && (
          <span className="text-2xs text-destructive font-medium flex items-center gap-1 animate-pulse">
            <Truck className="h-3 w-3" />
            Deslocamento &gt; 25% do dia
          </span>
        )}
      </div>
      <div className="h-4 rounded-full overflow-hidden flex bg-muted/50">
        {pctProd > 0 && (
          <div
            className="bg-success transition-all duration-700 ease-out"
            style={{ width: `${pctProd}%` }}
            title={`Produtivo: ${fmtTime(productiveMin)}`}
          />
        )}
        {pctTravel > 0 && (
          <div
            className={cn(
              "transition-all duration-700 ease-out",
              travelAlert ? "bg-destructive/80" : "bg-warning"
            )}
            style={{ width: `${pctTravel}%` }}
            title={`Deslocamento: ${fmtTime(travelMin)}`}
          />
        )}
        {pctIdle > 0 && (
          <div
            className="bg-muted-foreground/20 transition-all duration-700 ease-out"
            style={{ width: `${pctIdle}%` }}
            title={`Ocioso: ${fmtTime(idleMin)}`}
          />
        )}
      </div>
      <div className="flex items-center gap-4 mt-2 text-2xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success" /> Produtivo ({Math.round(pctProd)}%)
        </span>
        <span className="flex items-center gap-1">
          <span className={cn("h-2 w-2 rounded-full", travelAlert ? "bg-destructive/80" : "bg-warning")} />
          Deslocamento ({Math.round(pctTravel)}%)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-muted-foreground/20" /> Ocioso ({Math.round(pctIdle)}%)
        </span>
      </div>
    </div>
  );
}
