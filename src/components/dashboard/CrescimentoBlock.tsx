import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  UserX, 
  RefreshCw, 
  DollarSign, 
  TrendingUp, 
  ArrowRight,
  Target,
  Sparkles
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { format, subMonths } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

interface CrescimentoBlockProps {
  income: number;
  monthlyGoal?: number | null;
  periodLabel: string;
}

export function CrescimentoBlock({ income, monthlyGoal, periodLabel }: CrescimentoBlockProps) {
  const navigate = useNavigate();
  const today = new Date();
  
  const { services, isLoading: isLoadingServices } = useServices();
  const { clients, isLoading: isLoadingClients } = useClients();

  const opportunities = useMemo(() => {
    const openQuotes = services.filter(
      (s) => s.document_type === "quote" && (s.status === "scheduled" || s.status === "in_progress")
    );
    const quotesTotal = openQuotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

    const sixMonthsAgo = format(subMonths(today, 6), "yyyy-MM-dd");
    const lastServiceByClient: Record<string, string> = {};
    services.forEach((s) => {
      if (s.status !== "completed") return;
      const date = s.completed_date || s.scheduled_date || s.created_at;
      if (!lastServiceByClient[s.client_id] || date > lastServiceByClient[s.client_id]) {
        lastServiceByClient[s.client_id] = date;
      }
    });
    const inactiveClients = clients.filter((c) => {
      const lastDate = lastServiceByClient[c.id];
      if (!lastDate) return false;
      return lastDate < sixMonthsAgo;
    });

    const maintenanceQuotes = services.filter(
      (s) => 
        (s.document_type === "quote" || s.status === "scheduled") && 
        (s.description?.toLowerCase().includes("manutenção") || (s as any).type === "preventive")
    );
    const maintenanceTotal = maintenanceQuotes.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

    return {
      quotes: { count: openQuotes.length, total: quotesTotal },
      inactive: { count: inactiveClients.length },
      maintenance: { count: maintenanceQuotes.length, total: maintenanceTotal }
    };
  }, [services, clients]);

  const goal = monthlyGoal || (income > 0 ? Math.round(income * 1.2) : 0);
  const goalPct = goal > 0 ? Math.min(Math.round((income / goal) * 100), 100) : 0;
  
  const isLoading = isLoadingServices || isLoadingClients;
  if (isLoading) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-success" />
        <h2 className="text-xl font-bold text-foreground uppercase tracking-tight">Crescimento</h2>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* Meta e Progresso */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                  <Target className="h-3.5 w-3.5" /> Meta do Período
                </p>
                <p className="text-2xl font-black text-foreground">{formatCurrency(goal)}</p>
              </div>
              <Badge variant="outline" className={cn(
                "font-bold",
                goalPct >= 100 ? "bg-success/10 text-success border-success/20" : 
                goalPct >= 50 ? "bg-primary/10 text-primary border-primary/20" : 
                "bg-destructive/10 text-destructive border-destructive/20"
              )}>
                {goalPct}% atingido
              </Badge>
            </div>

            <div className="space-y-2">
              <Progress value={goalPct} className="h-3" />
              <div className="flex justify-between text-[11px] font-bold text-muted-foreground uppercase tracking-tighter">
                <span>R$ 0</span>
                <span>Faltam {formatCurrency(Math.max(0, goal - income))}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-xl border border-primary/10 bg-primary/5 flex items-center gap-3">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            <p className="text-sm text-muted-foreground">
              Você tem <span className="font-bold text-primary">{formatCurrency(opportunities.quotes.total)}</span> em orçamentos que podem ajudar a bater a meta.
            </p>
          </div>
        </div>

        {/* Valor Potencial */}
        <div className="grid gap-3 h-full">
          <button 
            onClick={() => navigate("/orcamentos")}
            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-primary/40 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-primary/10 p-2.5 group-hover:scale-110 transition-transform">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Orçamentos em Aberto</p>
                <p className="text-lg font-black text-foreground">{formatCurrency(opportunities.quotes.total)}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </button>

          <button 
            onClick={() => navigate("/clientes")}
            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-warning/40 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-warning/10 p-2.5 group-hover:scale-110 transition-transform">
                <UserX className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Clientes Inativos</p>
                <p className="text-lg font-black text-foreground">{opportunities.inactive.count} clientes</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-warning group-hover:translate-x-1 transition-all" />
          </button>

          <button 
            onClick={() => navigate("/agenda")}
            className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 text-left transition-all hover:border-success/40 hover:shadow-md"
          >
            <div className="flex items-center gap-4">
              <div className="rounded-xl bg-success/10 p-2.5 group-hover:scale-110 transition-transform">
                <RefreshCw className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Manutenções Pendentes</p>
                <p className="text-lg font-black text-foreground">{formatCurrency(opportunities.maintenance.total)}</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-success group-hover:translate-x-1 transition-all" />
          </button>
        </div>
      </div>
    </div>
  );
}
