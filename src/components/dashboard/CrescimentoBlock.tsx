import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FileText, 
  UserX, 
  RefreshCw, 
  TrendingUp, 
  ArrowRight,
  Target,
  Sparkles
} from "lucide-react";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { format, subMonths } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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
    <div className="space-y-8 animate-fade-in">
      <div className="flex items-center gap-3 px-1">
        <div className="p-2 rounded-xl bg-success/10">
          <TrendingUp className="h-5 w-5 text-success" />
        </div>
        <h2 className="text-lg font-bold text-foreground tracking-tight uppercase opacity-90">Análise de Crescimento</h2>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        {/* Meta e Progresso */}
        <div className="rounded-3xl border border-border/40 bg-card p-8 shadow-xl relative overflow-hidden flex flex-col justify-between group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -mr-16 -mt-16 blur-3xl" />
          
          <div className="space-y-8 relative z-10">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-70 flex items-center gap-2">
                  <Target className="h-3.5 w-3.5 text-primary" /> Meta Mensal
                </p>
                <p className="text-4xl font-black text-foreground tracking-tighter tabular-nums">{formatCurrency(goal)}</p>
              </div>
              <Badge variant="outline" className={cn(
                "font-bold py-1.5 px-4 text-xs rounded-full border-2",
                goalPct >= 100 ? "bg-success/10 text-success border-success/20" : 
                goalPct >= 50 ? "bg-primary/10 text-primary border-primary/20" : 
                "bg-destructive/10 text-destructive border-destructive/20"
              )}>
                {goalPct}% atingido
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-end mb-1">
                <span className="text-[11px] font-bold text-muted-foreground/60 uppercase tracking-widest">Progresso Real</span>
                <span className="text-[11px] font-bold text-primary uppercase tracking-widest">Faltam {formatCurrency(Math.max(0, goal - income))}</span>
              </div>
              <div className="relative h-4 w-full bg-muted/40 rounded-full overflow-hidden shadow-inner p-0.5">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out relative overflow-hidden",
                    goalPct >= 100 ? "bg-success" : "bg-primary"
                  )}
                  style={{ width: `${goalPct}%` }}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 p-5 rounded-2xl border border-primary/10 bg-primary/[0.03] flex items-center gap-4 relative z-10 group-hover:bg-primary/[0.05] transition-colors">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary shrink-0" />
            </div>
            <p className="text-sm text-muted-foreground font-medium leading-relaxed">
              Dica: Você tem <span className="font-bold text-primary">{formatCurrency(opportunities.quotes.total)}</span> em orçamentos abertos que podem garantir sua meta.
            </p>
          </div>
        </div>

        {/* Valor Potencial */}
        <div className="flex flex-col gap-4">
          <button 
            onClick={() => navigate("/orcamentos")}
            className="group flex items-center justify-between rounded-2xl border border-border/40 bg-card p-5 text-left transition-all hover:border-primary/40 hover:shadow-xl hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-5">
              <div className="rounded-2xl bg-primary/10 p-3 group-hover:scale-110 group-hover:bg-primary/20 transition-all duration-300">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Orçamentos em Aberto</p>
                <p className="text-xl font-black text-foreground tracking-tight mt-0.5">{formatCurrency(opportunities.quotes.total)}</p>
              </div>
            </div>
            <div className="p-2 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors">
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          <button 
            onClick={() => navigate("/clientes")}
            className="group flex items-center justify-between rounded-2xl border border-border/40 bg-card p-5 text-left transition-all hover:border-warning/40 hover:shadow-xl hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-5">
              <div className="rounded-2xl bg-warning/10 p-3 group-hover:scale-110 group-hover:bg-warning/20 transition-all duration-300">
                <UserX className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Clientes Inativos (+6m)</p>
                <p className="text-xl font-black text-foreground tracking-tight mt-0.5">{opportunities.inactive.count} <span className="text-sm font-medium text-muted-foreground">contatos</span></p>
              </div>
            </div>
            <div className="p-2 rounded-full bg-muted/50 group-hover:bg-warning/10 transition-colors">
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-warning group-hover:translate-x-1 transition-all" />
            </div>
          </button>

          <button 
            onClick={() => navigate("/agenda")}
            className="group flex items-center justify-between rounded-2xl border border-border/40 bg-card p-5 text-left transition-all hover:border-success/40 hover:shadow-xl hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-5">
              <div className="rounded-2xl bg-success/10 p-3 group-hover:scale-110 group-hover:bg-success/20 transition-all duration-300">
                <RefreshCw className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">Oportunidade Manutenção</p>
                <p className="text-xl font-black text-foreground tracking-tight mt-0.5">{formatCurrency(opportunities.maintenance.total)}</p>
              </div>
            </div>
            <div className="p-2 rounded-full bg-muted/50 group-hover:bg-success/10 transition-colors">
              <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-success group-hover:translate-x-1 transition-all" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
