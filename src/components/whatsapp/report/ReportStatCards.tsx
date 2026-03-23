import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Clock, CheckCircle2, AlertCircle, FileText, TrendingUp, DollarSign, MessageCircleX } from "lucide-react";
import { cn } from "@/lib/utils";

function formatMinutes(min: number) {
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

interface Props {
  report: {
    isLoading: boolean;
    convsToday: number;
    convsMonth: number;
    avgResponseMinutes: number;
    resolved: number;
    awaitingResponse: number;
    osCreated: number;
    neverResponded: number;
    totalRevenue: number;
    totalConversations: number;
  };
}

const iconColorClasses = {
  primary: "bg-primary/10 text-primary",
  success: "bg-green-500/10 text-green-600",
  warning: "bg-amber-500/10 text-amber-600",
  destructive: "bg-destructive/10 text-destructive",
};

export function ReportStatCards({ report }: Props) {
  const neverRespondedPct = report.totalConversations > 0
    ? Math.round((report.neverResponded / report.totalConversations) * 100)
    : 0;

  const statCards = [
    { title: "Conversas hoje", value: String(report.convsToday), icon: MessageSquare, color: "primary" as const },
    { title: "Conversas no mês", value: String(report.convsMonth), icon: TrendingUp, color: "primary" as const },
    { title: "Tempo médio resposta", value: formatMinutes(report.avgResponseMinutes), icon: Clock, color: "warning" as const },
    { title: "Resolvidas", value: String(report.resolved), icon: CheckCircle2, color: "success" as const },
    { title: "Aguardando resposta", value: String(report.awaitingResponse), icon: AlertCircle, color: "destructive" as const },
    { title: "OS criadas", value: String(report.osCreated), icon: FileText, color: "primary" as const },
    { title: "Nunca respondidos", value: `${report.neverResponded} (${neverRespondedPct}%)`, icon: MessageCircleX, color: "destructive" as const },
    { title: "Receita WhatsApp", value: formatCurrency(report.totalRevenue), icon: DollarSign, color: "success" as const },
  ];

  if (report.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[100px] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
      {statCards.map((s) => (
        <Card key={s.title}>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-muted-foreground truncate">{s.title}</p>
                <p className="mt-1 text-2xl font-bold text-card-foreground tracking-tight truncate">{s.value}</p>
              </div>
              <div className={cn("rounded-lg p-2 shrink-0", iconColorClasses[s.color])}>
                <s.icon className="h-4 w-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
