import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout";
import { useAuth } from "@/hooks/useAuth";
import { useServices, SERVICE_TYPE_LABELS } from "@/hooks/useServices";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { format, parseISO, isThisWeek, isThisMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

type FilterPeriod = "week" | "month" | "all";

export default function EmployeeHistory() {
  const { user } = useAuth();
  const { services } = useServices({ assignedTo: user?.id });
  const [period, setPeriod] = useState<FilterPeriod>("month");

  const completedServices = useMemo(() => {
    if (!services) return [];
    return services
      .filter(s => s.status === "completed")
      .filter(s => {
        if (period === "all") return true;
        const date = s.completed_date ? parseISO(s.completed_date) : parseISO(s.updated_at);
        if (period === "week") return isThisWeek(date, { weekStartsOn: 1 });
        if (period === "month") return isThisMonth(date);
        return true;
      })
      .sort((a, b) => {
        const dateA = a.completed_date || a.updated_at;
        const dateB = b.completed_date || b.updated_at;
        return dateB.localeCompare(dateA);
      });
  }, [services, period]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Histórico</h1>
          <p className="text-muted-foreground mt-1">Serviços concluídos</p>
        </div>

        <Tabs value={period} onValueChange={(v) => setPeriod(v as FilterPeriod)}>
          <TabsList className="w-full">
            <TabsTrigger value="week" className="flex-1">Semana</TabsTrigger>
            <TabsTrigger value="month" className="flex-1">Mês</TabsTrigger>
            <TabsTrigger value="all" className="flex-1">Todos</TabsTrigger>
          </TabsList>
        </Tabs>

        {completedServices.length > 0 ? (
          <div className="space-y-3">
            {completedServices.map(service => (
              <Card key={service.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{service.client?.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {SERVICE_TYPE_LABELS[service.service_type]}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        {service.completed_date 
                          ? format(parseISO(service.completed_date), "dd/MM/yyyy", { locale: ptBR })
                          : format(parseISO(service.updated_at), "dd/MM/yyyy", { locale: ptBR })
                        }
                      </p>
                    </div>
                    <Badge variant="default">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Concluído
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum serviço concluído neste período</p>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
