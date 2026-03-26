import { useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Clock, DollarSign, TrendingUp, Timer, Users } from "lucide-react";
import { isThisMonth, parseISO } from "date-fns";
import { calcServiceTimeMetrics, formatMinutes } from "@/hooks/useTimePerformance";

export default function EmployeeDesempenho() {
  const { user, profile } = useAuth();
  const { services } = useServices({ assignedTo: user?.id });

  const stats = useMemo(() => {
    if (!services) return { completed: 0, pending: 0, revenue: 0, avgTicket: 0 };

    const thisMonthServices = services.filter(s => {
      const date = s.created_at ? parseISO(s.created_at) : null;
      return date && isThisMonth(date);
    });

    const completed = thisMonthServices.filter(s => s.status === "completed").length;
    const pending = thisMonthServices.filter(s => s.status === "scheduled" || s.status === "in_progress").length;
    const revenue = thisMonthServices
      .filter(s => s.status === "completed")
      .reduce((sum, s) => sum + (s.value || 0), 0);
    const avgTicket = completed > 0 ? revenue / completed : 0;

    return { completed, pending, revenue, avgTicket };
  }, [services]);

  const timeStats = useMemo(() => {
    if (!services) return { avgEstMin: 0, avgActMin: 0, efficiency: 0, analyzed: 0 };

    let totalEst = 0;
    let totalAct = 0;
    let count = 0;

    for (const s of services) {
      if (s.status !== "completed" || !s.entry_date || !s.exit_date || !s.estimated_duration) continue;
      const m = calcServiceTimeMetrics(s.entry_date, s.exit_date, s.estimated_duration);
      if (!m) continue;
      totalEst += m.estimatedMin;
      totalAct += m.actualMin;
      count++;
    }

    if (count === 0) return { avgEstMin: 0, avgActMin: 0, efficiency: 0, analyzed: 0 };

    const avgEst = Math.round(totalEst / count);
    const avgAct = Math.round(totalAct / count);
    const efficiency = Math.round((totalEst / totalAct) * 100);

    return { avgEstMin: avgEst, avgActMin: avgAct, efficiency, analyzed: count };
  }, [services]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const statCards = [
    {
      label: "Concluídos no mês",
      value: stats.completed.toString(),
      icon: CheckCircle2,
      iconColor: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Pendentes",
      value: stats.pending.toString(),
      icon: Clock,
      iconColor: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      label: "Faturamento gerado",
      value: formatCurrency(stats.revenue),
      icon: DollarSign,
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      label: "Ticket médio",
      value: formatCurrency(stats.avgTicket),
      icon: TrendingUp,
      iconColor: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  const firstName = profile?.full_name?.split(" ")[0] || "Técnico";

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meu Desempenho</h1>
          <p className="text-muted-foreground mt-1">Resumo do mês atual, {firstName}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {statCards.map(card => (
            <Card key={card.label}>
              <CardContent className="p-4">
                <div className={`h-10 w-10 rounded-lg ${card.bgColor} flex items-center justify-center mb-3`}>
                  <card.icon className={`h-5 w-5 ${card.iconColor}`} />
                </div>
                <p className="text-xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Time Performance */}
        {timeStats.analyzed > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Timer className="h-4 w-4 text-primary" />
                Performance de Tempo
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {timeStats.analyzed} OS analisadas
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Estimado</p>
                  <p className="text-lg font-bold text-foreground">{formatMinutes(timeStats.avgEstMin)}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Real</p>
                  <p className="text-lg font-bold text-foreground">{formatMinutes(timeStats.avgActMin)}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Eficiência</p>
                  <p className={`text-lg font-bold ${timeStats.efficiency >= 90 ? "text-emerald-600 dark:text-emerald-400" : timeStats.efficiency >= 70 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"}`}>
                    {timeStats.efficiency}%
                  </p>
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Eficiência geral</span>
                  <span>{timeStats.efficiency}%</span>
                </div>
                <Progress value={Math.min(timeStats.efficiency, 100)} className="h-2" />
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
