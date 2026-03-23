import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target, CalendarCheck, CheckCircle2, TrendingUp, UserPlus, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  report: {
    isLoading: boolean;
    totalConversations: number;
    attendedOnly: number;
    attendedTotal: number;
    scheduledOnly: number;
    scheduledTotal: number;
    converted: number;
    conversionCommercial: number;
    conversionOperational: number;
    conversionTotal: number;
    avgTicket: number;
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(value);
}

export function ReportConversionBlock({ report }: Props) {
  if (report.isLoading) return null;

  const funnelSteps = [
    { label: "Leads", value: report.totalConversations, icon: UserPlus, color: "text-blue-600 bg-blue-500/10" },
    { label: "Atendidos", value: report.attendedTotal, icon: TrendingUp, color: "text-amber-600 bg-amber-500/10" },
    { label: "Agendados", value: report.scheduledTotal, icon: CalendarCheck, color: "text-emerald-600 bg-emerald-500/10" },
    { label: "Concluídos", value: report.converted, icon: CheckCircle2, color: "text-green-600 bg-green-500/10" },
  ];

  const conversionRates = [
    { label: "Comercial", sublabel: "Agendados / Atendidos", value: report.conversionCommercial, color: "text-emerald-600" },
    { label: "Operacional", sublabel: "Concluídos / Agendados", value: report.conversionOperational, color: "text-green-600" },
    { label: "Total", sublabel: "Concluídos / Leads", value: report.conversionTotal, color: "text-primary" },
  ];

  return (
    <div className="space-y-4">
      {/* Funnel */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" />
            Funil de Conversão WhatsApp
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            {funnelSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex items-center gap-3">
                  <div className="text-center">
                    <div className={cn("rounded-lg p-2 mx-auto w-fit mb-1", step.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{step.value}</p>
                    <p className="text-[11px] text-muted-foreground">{step.label}</p>
                  </div>
                  {i < funnelSteps.length - 1 && (
                    <ArrowRight className="text-muted-foreground/30 h-4 w-4 hidden sm:block" />
                  )}
                </div>
              );
            })}
            <div className="ml-auto text-center">
              <p className="text-2xl font-bold text-foreground">{formatCurrency(report.avgTicket)}</p>
              <p className="text-[11px] text-muted-foreground">Ticket médio</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3 Conversion Rates */}
      <div className="grid gap-4 sm:grid-cols-3">
        {conversionRates.map((rate) => (
          <Card key={rate.label}>
            <CardContent className="p-4 text-center">
              <p className={cn("text-3xl font-bold", rate.color)}>{rate.value}%</p>
              <p className="text-sm font-medium text-foreground mt-1">Conversão {rate.label}</p>
              <p className="text-[10px] text-muted-foreground">{rate.sublabel}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
