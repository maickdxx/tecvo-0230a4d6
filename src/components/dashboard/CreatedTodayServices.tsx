import { useMemo, useState } from "react";
import { CalendarCheck, User, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useServices } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { getDatePartInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

const SERVICE_TYPE_COLORS: Record<string, string> = {
  instalacao: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  installation: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  limpeza: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  cleaning: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
  manutencao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  maintenance: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
  contratos: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
  outros: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  other: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function formatCurrency(value: number | null): string {
  if (!value) return "R$ 0";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(dateStr: string | null, tz: string): string {
  if (!dateStr) return "Sem data";
  const d = new Date(dateStr);
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: tz });
}

export function CreatedTodayServices() {
  const { typeLabels } = useServiceTypes();
  const { services, isLoading } = useServices();
  const [expanded, setExpanded] = useState(false);
  const tz = useOrgTimezone();

  const todayLocal = useMemo(
    () => new Date().toLocaleDateString("en-CA", { timeZone: tz }),
    [tz]
  );

  const createdToday = useMemo(() => {
    return services
      .filter((s) => {
        if (s.status === "cancelled") return false;
        if (!s.created_at) return false;
        return getDatePartInTz(s.created_at, tz) === todayLocal;
      })
      .sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [services, todayLocal, tz]);

  const totalValue = useMemo(
    () => createdToday.reduce((sum, s) => sum + (s.value || 0), 0),
    [createdToday]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarCheck className="h-4 w-4 text-primary" />
            Serviços Agendados Hoje
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {createdToday.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        {createdToday.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum serviço agendado hoje.
          </p>
        ) : (
          <div className="space-y-4">
            {(() => {
              const MAX_VISIBLE = 3;
              const visible = expanded ? createdToday : createdToday.slice(0, MAX_VISIBLE);
              return (
                <>
                  <div className="space-y-2">
                    {visible.map((s) => {
                      const typeColor = SERVICE_TYPE_COLORS[s.service_type] || SERVICE_TYPE_COLORS.other;

                      return (
                        <div key={s.id} className="rounded-lg border p-2.5 sm:p-3 text-sm space-y-1.5 overflow-hidden min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium truncate flex-1 min-w-0">
                              {s.client?.name || "Cliente"}
                            </span>
                            <Badge
                              variant="secondary"
                              className={`text-[10px] px-1.5 py-0 leading-4 font-medium flex-shrink-0 ${typeColor}`}
                            >
                              {typeLabels[s.service_type] || s.service_type}
                            </Badge>
                            <span className="font-semibold text-xs flex-shrink-0 whitespace-nowrap">
                              {formatCurrency(s.value)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                            <span>Execução: {formatDate(s.scheduled_date, tz)}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="flex items-center gap-0.5 truncate max-w-[120px]">
                              <User className="h-3.5 w-3.5" />
                              {s.assigned_profile?.full_name || "Não atribuído"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {createdToday.length > MAX_VISIBLE && !expanded && (
                    <button
                      onClick={() => setExpanded(true)}
                      className="w-full text-center text-xs text-primary font-medium py-1.5 hover:underline flex items-center justify-center gap-1"
                    >
                      Ver todos ({createdToday.length})
                      <ChevronDown className="h-3 w-3" />
                    </button>
                  )}
                </>
              );
            })()}
            <div className="pt-2 border-t flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total agendado</span>
              <span className="font-semibold">{formatCurrency(totalValue)}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}