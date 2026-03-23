import { useMemo } from "react";
import { Zap, Target, DollarSign, Crown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SERVICE_TYPE_LABELS } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";

interface RevenueEngineBlockProps {
  revenueByType: Record<string, number>;
  countByType: Record<string, number>;
  averageTicket: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function RevenueEngineBlock({
  revenueByType,
  countByType,
  averageTicket,
}: RevenueEngineBlockProps) {
  const { typeLabels } = useServiceTypes();

  const metrics = useMemo(() => {
    const getLabel = (slug: string) =>
      typeLabels[slug] || SERVICE_TYPE_LABELS[slug] || slug;

    // Most sold
    const mostSoldEntry = Object.entries(countByType).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    // Most profitable
    const mostProfitableEntry = Object.entries(revenueByType).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    // Highest ticket
    const ticketsByType = Object.keys(revenueByType)
      .filter((tipo) => Number(countByType[tipo]) > 0)
      .map((tipo) => ({
        tipo,
        ticket: Number(revenueByType[tipo]) / Number(countByType[tipo]),
      }));
    const highestTicketType = ticketsByType.sort((a, b) => b.ticket - a.ticket)[0];

    return {
      mostSold: mostSoldEntry ? { label: getLabel(mostSoldEntry[0]), count: Number(mostSoldEntry[1]) } : null,
      mostProfitable: mostProfitableEntry ? { label: getLabel(mostProfitableEntry[0]), value: Number(mostProfitableEntry[1]) } : null,
      highestTicket: highestTicketType ? { label: getLabel(highestTicketType.tipo), value: highestTicketType.ticket } : null,
    };
  }, [revenueByType, countByType, typeLabels]);

  const items = [
    metrics.mostSold && {
      icon: Crown,
      label: "Mais vendido",
      value: `${metrics.mostSold.label} (${metrics.mostSold.count})`,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    metrics.mostProfitable && {
      icon: DollarSign,
      label: "Mais lucrativo",
      value: `${metrics.mostProfitable.label} ${formatCurrency(metrics.mostProfitable.value)}`,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      icon: Target,
      label: "Ticket Médio",
      value: formatCurrency(averageTicket),
      color: "text-primary",
      bg: "bg-primary/10",
    },
  ].filter(Boolean) as Array<{ icon: typeof Crown; label: string; value: string; color: string; bg: string }>;

  if (items.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Zap className="h-4 w-4 text-primary" />
          Motor de Receita
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-center gap-3">
              <div className={`rounded-lg p-2 ${item.bg}`}>
                <Icon className={`h-4 w-4 ${item.color}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-muted-foreground">{item.label}</p>
                <p className="text-sm font-semibold text-card-foreground truncate">{item.value}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
