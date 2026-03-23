import { useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, DollarSign, TrendingUp } from "lucide-react";
import { isThisMonth, parseISO } from "date-fns";

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
      </div>
    </AppLayout>
  );
}
