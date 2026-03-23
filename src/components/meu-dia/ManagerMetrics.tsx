import { Card, CardContent } from "@/components/ui/card";
import { Users, Clock, Car, AlertTriangle, DollarSign, CreditCard } from "lucide-react";

interface Props {
  activeTechnicians: number;
  avgServiceTime: number;
  totalTravelTime: number;
  overdueCount: number;
  forecastRevenue: number;
  receivedRevenue: number;
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

export function ManagerMetrics({
  activeTechnicians,
  avgServiceTime,
  totalTravelTime,
  overdueCount,
  forecastRevenue,
  receivedRevenue,
}: Props) {
  const cards = [
    {
      icon: Users,
      value: activeTechnicians,
      label: "Técnicos Ativos",
      color: "text-blue-600 bg-blue-500/10 dark:text-blue-400",
    },
    {
      icon: Clock,
      value: fmtTime(avgServiceTime),
      label: "Tempo Médio/Serviço",
      color: "text-violet-600 bg-violet-500/10 dark:text-violet-400",
    },
    {
      icon: Car,
      value: fmtTime(totalTravelTime),
      label: "Deslocamento Equipe",
      color: "text-cyan-600 bg-cyan-500/10 dark:text-cyan-400",
    },
    {
      icon: AlertTriangle,
      value: overdueCount,
      label: "Atrasados",
      color: overdueCount > 0
        ? "text-red-600 bg-red-500/10 dark:text-red-400"
        : "text-green-600 bg-green-500/10 dark:text-green-400",
    },
    {
      icon: DollarSign,
      value: fmtCurrency(forecastRevenue),
      label: "Faturamento Previsto",
      color: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    },
    {
      icon: CreditCard,
      value: fmtCurrency(receivedRevenue),
      label: "Valor Recebido",
      color: "text-green-600 bg-green-500/10 dark:text-green-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i}>
            <CardContent className="p-3 flex flex-col items-center text-center gap-1">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="text-lg font-bold text-foreground truncate w-full">{c.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{c.label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
