import { useMemo } from "react";
import { getTodayInTz, formatDateObjInTz, getDatePartInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { useNavigate } from "react-router-dom";
import { 
  DollarSign, 
  AlertTriangle, 
  Calendar, 
  UserCheck, 
  TrendingDown,
  Clock,
  AlertCircle,
  Users,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";

interface SecretariaDashboardProps {
  showFinancialAlerts?: boolean;
  showAgendaAlerts?: boolean;
}

export function SecretariaDashboard({
  showFinancialAlerts = true,
  showAgendaAlerts = true,
}: SecretariaDashboardProps) {
  const navigate = useNavigate();
  const { services } = useServices();
  const { clients } = useClients();
  const { transactions } = useTransactions();

  const insights = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Clients without service in 6+ months
    const clientLastService: Record<string, Date> = {};
    (services || []).forEach((s) => {
      if (s.status !== "completed") return;
      const d = s.completed_date || s.scheduled_date || s.created_at;
      if (d) {
        const date = new Date(d);
        if (!clientLastService[s.client_id] || date > clientLastService[s.client_id]) {
          clientLastService[s.client_id] = date;
        }
      }
    });

    const inactiveClients = (clients || []).filter((c) => {
      const last = clientLastService[c.id];
      return last && last < sixMonthsAgo;
    });

    console.log("SECRETARIA DASHBOARD - DATA LIMITE 6 MESES:", sixMonthsAgo.toISOString());
    console.log("SECRETARIA DASHBOARD - CLIENTES COM ÚLTIMO SERVIÇO CONCLUÍDO:", Object.entries(clientLastService).map(([id, d]) => ({ id, date: d.toISOString() })));
    console.log("SECRETARIA DASHBOARD - CLIENTES INATIVOS:", inactiveClients.length);

    // Overdue payments
    const overduePayments = (transactions || []).filter(
      (t) =>
        t.type === "income" &&
        t.status === "pending" &&
        t.due_date &&
        new Date(t.due_date) < now
    );

    // Completed with overdue payment (billable only: value > 0 + payment_due_date past due + no paid transaction)
    const paidServiceIds = new Set(
      (transactions || [])
        .filter(t => t.type === "income" && t.service_id && t.status === "paid")
        .map(t => t.service_id)
    );
    const unpaidCompleted = (services || []).filter(
      (s) =>
        s.status === "completed" &&
        s.value && s.value > 0 &&
        s.payment_due_date &&
        new Date(s.payment_due_date) < now &&
        !paidServiceIds.has(s.id)
    );

    // Revenue forecast: services scheduled/in_progress next 30 days (all org, no assigned_to filter)
    const limite30 = new Date();
    limite30.setDate(now.getDate() + 30);

    const todayStr = getTodayInTz(DEFAULT_TIMEZONE);
    const limite30Str = formatDateObjInTz(limite30, DEFAULT_TIMEZONE);

    const servicosFuturos = (services || []).filter((s) => {
      if (!((s.status === "scheduled" || s.status === "in_progress") && s.scheduled_date && Number(s.value) > 0)) return false;
      const d = getDatePartInTz(s.scheduled_date, DEFAULT_TIMEZONE);
      return d >= todayStr && d <= limite30Str;
    });

    const incomeNext30 = servicosFuturos.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

    console.log("SECRETARIA IA - SERVIÇOS TOTAIS:", (services || []).length);
    console.log("SECRETARIA IA - SERVIÇOS FUTUROS (30d):", servicosFuturos.length, servicosFuturos.map(s => ({ id: s.id, status: s.status, date: s.scheduled_date, value: s.value })));
    console.log("SECRETARIA IA - RECEITA PREVISTA FINAL:", incomeNext30);

    const expenseNext30 = (transactions || [])
      .filter((t) => t.type === "expense" && t.due_date && new Date(t.due_date) >= now && new Date(t.due_date) <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000))
      .reduce((sum, t) => sum + t.amount, 0);

    // Schedule next 7 days
    const sevenStr = formatDateObjInTz(sevenDaysAhead, DEFAULT_TIMEZONE);
    const next7DaysServices = (services || []).filter((s) => {
      if (!(s.status === "scheduled" && s.scheduled_date)) return false;
      const d = getDatePartInTz(s.scheduled_date, DEFAULT_TIMEZONE);
      return d >= todayStr && d <= sevenStr;
    });

    const overdueTotal = overduePayments.reduce((s, t) => s + t.amount, 0);

    return {
      inactiveClients: inactiveClients.length,
      overduePayments: overduePayments.length,
      overdueTotal,
      unpaidCompleted: unpaidCompleted.length,
      next7DaysServices: next7DaysServices.length,
      incomeNext30,
      expenseNext30,
      cashFlowRisk: expenseNext30 > incomeNext30,
    };
  }, [services, clients, transactions]);

  const blocks = [
    {
      title: "Clientes para Reativar",
      icon: Users,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-amber-500/10",
      route: "/ia/clientes-inativos",
      items: [
        { label: "Clientes inativos (6+ meses)", value: insights.inactiveClients, alert: insights.inactiveClients > 0 },
      ],
    },
    {
      title: "Alertas Críticos",
      icon: AlertTriangle,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-red-500/10",
      route: "/ia/pagamentos-vencidos",
      items: [
        { label: "Pagamentos vencidos", value: `${insights.overduePayments} (R$ ${insights.overdueTotal.toFixed(0)})`, alert: insights.overduePayments > 0 },
        { label: "OS com pagamento em atraso", value: insights.unpaidCompleted, alert: insights.unpaidCompleted > 0 },
      ],
    },
    {
      title: "Agenda Inteligente",
      icon: Calendar,
      color: "text-blue-600 dark:text-blue-400",
      bgColor: "bg-blue-500/10",
      route: "/ia/agenda-proximos",
      items: [
        { label: "Serviços próximos 7 dias", value: insights.next7DaysServices, alert: false },
      ],
    },
    {
      title: "Risco Financeiro",
      icon: TrendingDown,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-purple-500/10",
      route: "/ia/receita-prevista",
      items: [
        { label: "Receita prevista – próximos 30 dias", value: `R$ ${insights.incomeNext30.toFixed(0)}`, alert: false },
        { label: "Despesas previstas – próximos 30 dias", value: `R$ ${insights.expenseNext30.toFixed(0)}`, alert: false },
        { label: "Risco de caixa negativo", value: insights.cashFlowRisk ? "⚠️ Sim" : "✅ Não", alert: insights.cashFlowRisk },
      ],
    },
  ];

  const filteredBlocks = blocks.filter((block) => {
    if (!showFinancialAlerts && (block.title === "Alertas Críticos" || block.title === "Risco Financeiro")) return false;
    if (!showAgendaAlerts && block.title === "Agenda Inteligente") return false;
    return true;
  });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {filteredBlocks.map((block) => (
        <Card
          key={block.title}
          className="border-border cursor-pointer hover:shadow-md transition-shadow group"
          onClick={() => navigate(block.route)}
        >
          <CardHeader className="pb-2 pt-3 px-3">
            <div className="flex items-center gap-2">
              <div className={`h-7 w-7 rounded-lg ${block.bgColor} flex items-center justify-center`}>
                <block.icon className={`h-3.5 w-3.5 ${block.color}`} />
              </div>
              <CardTitle className="text-xs font-semibold text-foreground leading-tight flex-1">
                {block.title}
              </CardTitle>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3 space-y-1.5">
            {block.items.map((item) => (
              <div key={item.label} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground truncate mr-2">{item.label}</span>
                <span className={`font-medium whitespace-nowrap ${item.alert ? "text-destructive" : "text-foreground"}`}>
                  {item.value}
                </span>
              </div>
            ))}
            {block.title === "Risco Financeiro" && (
              <p className="text-[10px] text-muted-foreground pt-1">
                Baseado em serviços agendados para os próximos 30 dias.
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
