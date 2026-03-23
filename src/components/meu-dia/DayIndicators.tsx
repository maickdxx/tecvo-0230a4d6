import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, CheckCircle2, Flame, DollarSign, Users, TrendingUp } from "lucide-react";

interface Props {
  totalServices: number;
  completedCount: number;
  weeklyPoints: number;
  revenue: number;
  isManager: boolean;
}

export function DayIndicators({ totalServices, completedCount, weeklyPoints, revenue, isManager }: Props) {
  const cards = [
    {
      icon: isManager ? Users : ClipboardList,
      value: totalServices,
      label: isManager ? "Total Equipe" : "Meta do Dia",
      color: "text-primary bg-primary/10",
    },
    {
      icon: CheckCircle2,
      value: `${completedCount}/${totalServices}`,
      label: isManager ? "Concluídos Equipe" : "Concluídos",
      color: "text-green-600 bg-green-500/10 dark:text-green-400",
    },
    {
      icon: Flame,
      value: weeklyPoints,
      label: isManager ? "Pontos Líder" : "Pontos Semana",
      color: "text-orange-600 bg-orange-500/10 dark:text-orange-400",
    },
    {
      icon: isManager ? TrendingUp : DollarSign,
      value: new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(revenue),
      label: isManager ? "Faturamento Equipe" : "Faturamento Previsto",
      color: "text-emerald-600 bg-emerald-500/10 dark:text-emerald-400",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <Card key={i} className="hover:shadow-none -translate-y-0 hover:-translate-y-0">
            <CardContent className="p-3 flex items-center gap-3">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${c.color}`}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground truncate">{c.value}</p>
                <p className="text-[10px] text-muted-foreground leading-tight">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
