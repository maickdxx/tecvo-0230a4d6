import { useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  CalendarDays, 
  Clock, 
  AlertTriangle, 
  FileText, 
  UserX, 
  TrendingUp,
  ArrowRight,
  ShieldCheck,
  Zap,
  DollarSign,
  AlertCircle,
  MessageCircle,
  TrendingDown
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useTransactions } from "@/hooks/useTransactions";
import { format, subDays, subMonths, differenceInDays } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAdaptivePrioritization } from "@/hooks/useAdaptivePrioritization";
import { useUserRole } from "@/hooks/useUserRole";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type PriorityLevel = "high" | "medium" | "low";

interface DashboardAction {
  id: string;
  title: string;
  impactText: string;
  timeLabel: string;
  icon: any;
  priorityLevel: PriorityLevel;
  score: number;
  action: () => void;
  color: string;
  bg: string;
  insight?: string;
}

export function TodayActionsBlock() {
  const navigate = useNavigate();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();
  const { transactions, isLoading: isLoadingTransactions } = useTransactions();
  const { role, isOwner, isAdmin } = useUserRole();
  const { recordInteraction, recordResult, getScoreAdjustment, getAdaptiveInsight, history } = useAdaptivePrioritization();

  const counts = useMemo(() => {
    return {
      overdue_services: services.filter((s) => {
        if (!s.scheduled_date || s.status === "completed" || s.status === "cancelled" || s.document_type === "quote") return false;
        return s.scheduled_date.substring(0, 10) < todayStr;
      }),
      overdue_payments: transactions.filter(
        (t) => t.status === "pending" && t.due_date && t.due_date < todayStr && t.type === "income"
      ),
      pending_quotes: services.filter(
        (s) => s.document_type === "quote" && s.status === "scheduled" && s.created_at.substring(0, 10) <= format(subDays(today, 3), "yyyy-MM-dd")
      ),
      inactive_clients: (() => {
        const sixMonthsAgo = format(subMonths(today, 6), "yyyy-MM-dd");
        const lastServiceByClient: Record<string, string> = {};
        services.forEach((s) => {
          if (s.status !== "completed") return;
          const date = s.completed_date || s.scheduled_date || s.created_at;
          if (!lastServiceByClient[s.client_id] || date > lastServiceByClient[s.client_id]) {
            lastServiceByClient[s.client_id] = date;
          }
        });
        return clients.filter((c) => {
          const lastDate = lastServiceByClient[c.id];
          return lastDate ? lastDate < sixMonthsAgo : false;
        });
      })(),
      today_services: services.filter(
        (s) => s.scheduled_date?.startsWith(todayStr) && s.status !== "cancelled" && s.document_type !== "quote"
      )
    };
  }, [services, clients, transactions, todayStr, today]);

  const actions = useMemo(() => {
    const result: DashboardAction[] = [];

    // 1. Overdue services
    if (counts.overdue_services.length > 0) {
      const impactValue = counts.overdue_services.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const oldestDate = counts.overdue_services.reduce((oldest, s) => s.scheduled_date < oldest ? s.scheduled_date : oldest, counts.overdue_services[0].scheduled_date);
      const daysOverdue = differenceInDays(today, new Date(oldestDate));
      
      const baseScore = 1000 + (impactValue / 100) + (daysOverdue * 50);
      const adjustedScore = baseScore + getScoreAdjustment("overdue_services", baseScore);
      const historyData = history["overdue_services"];

      result.push({
        id: "overdue_services",
        title: `${counts.overdue_services.length} serviço${counts.overdue_services.length > 1 ? "s" : ""} em atraso`,
        impactText: historyData?.totalValueGenerated ? `Já evitou perda de ${formatCurrency(historyData.totalValueGenerated)}` : `Evite perder ${formatCurrency(impactValue)} hoje`,
        timeLabel: `há ${daysOverdue} d`,
        icon: AlertTriangle,
        priorityLevel: "high",
        score: adjustedScore,
        action: () => {
          recordInteraction("overdue_services", "click");
          navigate("/ordens-servico?status=overdue");
        },
        color: "text-destructive",
        bg: "bg-destructive/10",
        insight: getAdaptiveInsight("overdue_services", "Resolver isso libera o fluxo operacional."),
      });
    }

    // 2. Overdue payments
    if (counts.overdue_payments.length > 0) {
      const total = counts.overdue_payments.reduce((sum, t) => sum + Number(t.amount), 0);
      const oldestDate = counts.overdue_payments.reduce((oldest, t) => t.due_date! < oldest ? t.due_date! : oldest, counts.overdue_payments[0].due_date!);
      const daysOverdue = differenceInDays(today, new Date(oldestDate));

      const baseScore = 1100 + (total / 100) + (daysOverdue * 60);
      const adjustedScore = baseScore + getScoreAdjustment("overdue_payments", baseScore);
      const historyData = history["overdue_payments"];

      result.push({
        id: "overdue_payments",
        title: `${counts.overdue_payments.length} pagamento${counts.overdue_payments.length > 1 ? "s" : ""} vencido${counts.overdue_payments.length > 1 ? "s" : ""}`,
        impactText: historyData?.totalValueGenerated ? `Recuperou ${formatCurrency(historyData.totalValueGenerated)} com cobrança` : `Recupere ${formatCurrency(total)} parados`,
        timeLabel: `há ${daysOverdue} d`,
        icon: DollarSign,
        priorityLevel: "high",
        score: adjustedScore,
        action: () => {
          recordInteraction("overdue_payments", "click");
          navigate("/financeiro?tab=receivable&status=overdue");
        },
        color: "text-destructive",
        bg: "bg-destructive/10",
        insight: getAdaptiveInsight("overdue_payments", "Cobrança imediata melhora o caixa hoje."),
      });
    }

    // 3. Pending quotes
    if (counts.pending_quotes.length > 0) {
      const totalValue = counts.pending_quotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const oldestDate = counts.pending_quotes.reduce((oldest, s) => s.created_at < oldest ? s.created_at : oldest, counts.pending_quotes[0].created_at);
      const daysPending = differenceInDays(today, new Date(oldestDate));

      const baseScore = 800 + (totalValue / 200) + (daysPending * 30);
      const adjustedScore = baseScore + getScoreAdjustment("pending_quotes", baseScore);
      const historyData = history["pending_quotes"];

      result.push({
        id: "pending_quotes",
        title: "Acelerar orçamentos pendentes",
        impactText: historyData?.totalValueGenerated ? `Já converteu ${formatCurrency(historyData.totalValueGenerated)}` : `Liberar ${formatCurrency(totalValue)} em caixa`,
        timeLabel: `há ${daysPending} dias`,
        icon: Zap,
        priorityLevel: "high",
        score: adjustedScore,
        action: () => {
          recordInteraction("pending_quotes", "click");
          navigate("/orcamentos");
        },
        color: "text-warning",
        bg: "bg-warning/10",
        insight: getAdaptiveInsight("pending_quotes", "Esse tipo de orçamento costuma fechar rápido se abordado agora."),
      });
    }

    // 4. Inactive clients
    if (counts.inactive_clients.length > 0) {
      const baseScore = 300 + (counts.inactive_clients.length * 10);
      const adjustedScore = baseScore + getScoreAdjustment("inactive_clients", baseScore);
      const historyData = history["inactive_clients"];

      result.push({
        id: "inactive_clients",
        title: "Reativar clientes sumidos",
        impactText: historyData?.totalValueGenerated ? `Gerou ${formatCurrency(historyData.totalValueGenerated)} em novos serviços` : "Gerar novos serviços recorrentes",
        timeLabel: "inativos +6 m",
        icon: UserX,
        priorityLevel: "medium",
        score: adjustedScore,
        action: () => {
          recordInteraction("inactive_clients", "click");
          navigate("/clientes");
        },
        color: "text-primary",
        bg: "bg-primary/10",
        insight: getAdaptiveInsight("inactive_clients", "Manutenção preventiva é o melhor lucro."),
      });
    }

    // 5. Services for today
    if (counts.today_services.length > 0) {
      const totalValue = counts.today_services.reduce((sum, s) => sum + (Number(s.value) || 0), 0);
      const baseScore = 500 + (totalValue / 500);
      const adjustedScore = baseScore + getScoreAdjustment("today_services", baseScore);
      const historyData = history["today_services"];

      result.push({
        id: "today_services",
        title: "Executar serviços do dia",
        impactText: historyData?.totalValueGenerated ? `Já faturou ${formatCurrency(historyData.totalValueGenerated)} hoje` : `Garantir ${formatCurrency(totalValue)} em faturamento`,
        timeLabel: "hoje",
        icon: CalendarDays,
        priorityLevel: "medium",
        score: adjustedScore,
        action: () => {
          recordInteraction("today_services", "click");
          navigate("/agenda");
        },
        color: "text-info",
        bg: "bg-info/10",
        insight: getAdaptiveInsight("today_services", "Check-in antecipado evita atrasos."),
      });
    }

    return result.sort((a, b) => b.score - a.score).slice(0, 5);
  }, [counts, today, getScoreAdjustment, getAdaptiveInsight, recordInteraction, history, navigate]);

  // Track impressions and resolutions
  const prevCounts = useMemo(() => {
    return {
      overdue_services: counts.overdue_services.length,
      overdue_payments: counts.overdue_payments.length,
      pending_quotes: counts.pending_quotes.length,
      inactive_clients: counts.inactive_clients.length,
      today_services: counts.today_services.filter(s => s.status === 'completed').length
    };
  }, [counts]);

  useEffect(() => {
    if (!isLoadingServices && !isLoadingClients && !isLoadingTransactions) {
      actions.forEach(action => {
        recordInteraction(action.id, "impression");
      });
    }
  }, [actions.length, isLoadingServices, isLoadingClients, isLoadingTransactions, recordInteraction]);

  const isLoading = isLoadingServices || isLoadingClients || isLoadingTransactions;

  if (isLoading) {
    return (
      <div className="mb-6 h-32 w-full animate-pulse rounded-xl bg-muted/50" />
    );
  }

  if (actions.length === 0) {
    return (
      <div className="mb-8 rounded-2xl border border-success/20 bg-success/5 p-6 animate-fade-in">
        <div className="flex items-center gap-4">
          <div className="rounded-full bg-success/10 p-3 text-success">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Tudo sob controle hoje</h2>
            <p className="text-sm text-muted-foreground">Nenhuma ação crítica necessária. Sua operação está em dia!</p>
          </div>
        </div>
      </div>
    );
  }

  const priorityAction = actions[0];
  const secondaryActions = actions.slice(1);

  return (
    <div className="mb-8 page-enter">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-foreground/70">
          🎯 Ações de Hoje
        </h2>
        <div className="flex-1 h-px bg-border/40" />
      </div>

      <div className="grid gap-4 lg:grid-cols-12">
        {/* Priority Action (Highlight) */}
        <div className="lg:col-span-5">
          <button
            onClick={priorityAction.action}
            className={cn(
              "group relative h-full w-full flex flex-col overflow-hidden rounded-3xl border-2 p-6 text-left transition-all duration-300 hover:shadow-xl active:scale-[0.99]",
              priorityAction.score > 1500 
                ? "border-destructive/30 bg-gradient-to-br from-destructive/10 via-card to-card" 
                : "border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card"
            )}
          >
            <div className="flex items-center justify-between mb-6">
              <Badge className={cn(
                "font-bold px-3 py-1 animate-pulse",
                priorityAction.score > 1500 ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"
              )}>
                {priorityAction.score > 1500 ? "⚠️ URGÊNCIA CRÍTICA" : "👉 PRIORIDADE DO DIA"}
              </Badge>
              <div className={cn("p-3 rounded-2xl", priorityAction.bg)}>
                <priorityAction.icon className={cn("h-6 w-6", priorityAction.color)} />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn(
                  "uppercase text-[10px] font-bold tracking-widest",
                  priorityAction.priorityLevel === "high" || priorityAction.score > 1500 ? "border-destructive text-destructive bg-destructive/5" : "border-primary text-primary bg-primary/5"
                )}>
                  {priorityAction.score > 1500 ? "Escalação Automática" : (priorityAction.priorityLevel === "high" ? "Alta Prioridade" : "Média Prioridade")}
                </Badge>
                <span className="text-xs text-muted-foreground">• {priorityAction.timeLabel}</span>
              </div>
              <h3 className="text-2xl font-black text-foreground tracking-tight leading-tight group-hover:text-primary transition-colors">
                {priorityAction.title}
              </h3>
              <p className="text-lg font-bold text-foreground/80 flex items-center gap-2">
                {priorityAction.score > 1500 ? (
                  <TrendingDown className="h-5 w-5 text-destructive shrink-0" />
                ) : (
                  <TrendingUp className="h-5 w-5 text-success shrink-0" />
                )}
                {priorityAction.impactText}
              </p>
            </div>

            {priorityAction.insight && (
              <div className={cn(
                "mt-6 p-4 rounded-2xl border italic text-sm text-muted-foreground",
                priorityAction.score > 1500 ? "bg-destructive/5 border-destructive/20" : "bg-muted/30 border-border/40"
              )}>
                "💡 {priorityAction.insight}"
              </div>
            )}

            <div className="mt-auto pt-6 flex items-center justify-between">
              <Button className={cn(
                "rounded-xl px-6 font-bold gap-2",
                priorityAction.score > 1500 ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground" : ""
              )}>
                {priorityAction.score > 1500 ? "Resolver Urgente" : "Resolver agora"}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="absolute -right-8 -bottom-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
              <priorityAction.icon size={200} />
            </div>
          </button>
        </div>

        {/* Secondary Actions */}
        <div className="lg:col-span-7 grid gap-3 sm:grid-cols-2">
          {secondaryActions.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border/60 bg-card p-4 text-left transition-all duration-300 hover:border-primary/30 hover:shadow-lg active:scale-[0.98]"
            >
              <div className="flex items-start justify-between">
                <div className={cn("rounded-xl p-2.5", item.bg, "transition-transform group-hover:scale-110")}>
                  <item.icon className={cn("h-5 w-5", item.color)} />
                </div>
                <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tighter opacity-70">
                  {item.priorityLevel === "high" ? "Alta" : "Média"}
                </Badge>
              </div>

              <div className="mt-4 space-y-1">
                <h4 className="text-[15px] font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                  {item.title}
                </h4>
                <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <span className="text-success font-bold shrink-0">{item.impactText}</span>
                  <span className="opacity-50">•</span>
                  <span className="opacity-60 text-[10px] uppercase font-bold tracking-tighter shrink-0">{item.timeLabel}</span>
                </p>
              </div>

              <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-all">
                Ação direta <ArrowRight className="h-3 w-3" />
              </div>
            </button>
          ))}
          
          {/* Empty slot placeholder if less than 5 actions */}
          {actions.length < 5 && actions.length > 0 && (
            <div className="flex items-center justify-center rounded-2xl border border-dashed border-border/60 bg-muted/10 p-4">
              <p className="text-[11px] font-medium text-muted-foreground/60 text-center uppercase tracking-widest leading-relaxed">
                Continue assim!<br/>Sua lista está ficando limpa.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
