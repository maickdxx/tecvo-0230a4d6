import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Clock, Car, DollarSign } from "lucide-react";

interface Props {
  totalServices: number;
  completedCount: number;
  avgServiceTime: number;
  totalTravelTime: number;
  revenue: number;
}

function fmtCurrency(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function fmtTime(min: number) {
  if (min <= 0) return "—";
  if (min < 60) return `${Math.round(min)}min`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return `${h}h${m > 0 ? `${m}m` : ""}`;
}

export function TechnicianMetrics({
  totalServices,
  completedCount,
  avgServiceTime,
  totalTravelTime,
  revenue,
}: Props) {
  const remaining = totalServices - completedCount;
  const pct = totalServices > 0 ? Math.round((completedCount / totalServices) * 100) : 0;

  // Motivational message
  let motivation = "";
  if (totalServices > 0) {
    if (remaining === 0) motivation = "✅ Dia finalizado. Excelente trabalho!";
    else if (remaining === 1) motivation = "Falta apenas 1 serviço.";
    else if (pct >= 75) motivation = "Dia quase finalizado. Bom ritmo!";
    else if (pct >= 50) motivation = "Bom ritmo de execução.";
  }

  return (
    <div className="space-y-3">
      {/* Day progress */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-foreground">{pct}%</span>
              <span className="text-sm text-muted-foreground">do dia</span>
            </div>
            <div className="text-right text-sm">
              <span className="font-semibold text-foreground">{completedCount}</span>
              <span className="text-muted-foreground"> / {totalServices} concluídos</span>
              {remaining > 0 && (
                <span className="text-muted-foreground ml-2">· {remaining} restante{remaining > 1 ? "s" : ""}</span>
              )}
            </div>
          </div>
          <Progress
            value={pct}
            className={`h-2 ${
              pct >= 100
                ? "[&>div]:bg-green-500"
                : pct >= 50
                ? "[&>div]:bg-blue-600"
                : "[&>div]:bg-blue-400"
            }`}
          />
          {motivation && (
            <p className="text-xs text-muted-foreground mt-2 italic">{motivation}</p>
          )}
        </CardContent>
      </Card>

      {/* Compact metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{fmtTime(avgServiceTime)}</p>
              <p className="text-[10px] text-muted-foreground">Tempo médio</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-2">
            <Car className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{fmtTime(totalTravelTime)}</p>
              <p className="text-[10px] text-muted-foreground">Deslocamento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-3 flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{fmtCurrency(revenue)}</p>
              <p className="text-[10px] text-muted-foreground">Valor total</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
