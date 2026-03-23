import { CheckCircle2, XCircle, Clock, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface OperationalEfficiencyBlockProps {
  completedServices: number;
  cancelledCount: number;
  avgExecDays: number;
  totalServices: number;
}

export function OperationalEfficiencyBlock({
  completedServices,
  cancelledCount,
  avgExecDays,
  totalServices,
}: OperationalEfficiencyBlockProps) {
  // Taxa = concluídos / (concluídos + cancelados) — só conta serviços que já tiveram desfecho
  const resolved = completedServices + cancelledCount;
  const completionRate = resolved > 0 ? Math.round((completedServices / resolved) * 100) : 0;

  // Formato inteligente do tempo médio
  const formatAvg = (days: number): string => {
    if (days === 0) return "No dia";
    if (days < 1) {
      const hours = Math.round(days * 24);
      return `${hours}h`;
    }
    const rounded = Math.round(days * 10) / 10;
    return `${rounded} dia${rounded !== 1 ? "s" : ""}`;
  };

  const items = [
    {
      icon: CheckCircle2,
      label: "Concluídos",
      value: String(completedServices),
      color: "text-success",
      bg: "bg-success/10",
      tip: "Serviços finalizados no período selecionado",
    },
    {
      icon: XCircle,
      label: "Cancelados",
      value: String(cancelledCount),
      color: "text-destructive",
      bg: "bg-destructive/10",
      tip: "Serviços cancelados no período selecionado",
    },
    {
      icon: Clock,
      label: "Tempo médio",
      value: formatAvg(avgExecDays),
      color: "text-primary",
      bg: "bg-primary/10",
      tip: "Tempo médio entre a criação e a conclusão do serviço",
    },
    {
      icon: Gauge,
      label: "Taxa de sucesso",
      value: resolved > 0 ? `${completionRate}%` : "—",
      color: "text-primary",
      bg: "bg-primary/10",
      tip: "% de serviços concluídos vs total finalizados (concluídos + cancelados)",
    },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Gauge className="h-4 w-4 text-primary" />
          Eficiência Operacional
        </CardTitle>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <div className="grid grid-cols-2 gap-4">
            {items.map((item, i) => {
              const Icon = item.icon;
              return (
                <Tooltip key={i}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-3 cursor-help">
                      <div className={`rounded-lg p-2 ${item.bg}`}>
                        <Icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground">{item.label}</p>
                        <p className="text-xl font-bold text-card-foreground">{item.value}</p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs max-w-[200px]">{item.tip}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </CardContent>
    </Card>
  );
}
