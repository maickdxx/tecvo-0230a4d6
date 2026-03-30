import { useMemo, useState } from "react";
import { ShoppingBag, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SERVICE_TYPE_LABELS } from "@/hooks/useServices";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { getDatePartInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { getHojeBRT } from "@/lib/periodoGlobal";

function toDateStr(d: Date): string {
  return d.toLocaleDateString("sv-SE"); // yyyy-MM-dd
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDayLabel(dateStr: string): string {
  const today = toDateStr(getHojeBRT());
  if (dateStr === today) return "Hoje";
  const yesterday = new Date(today + "T12:00:00");
  yesterday.setDate(yesterday.getDate() - 1);
  const yStr = yesterday.toISOString().substring(0, 10);
  if (dateStr === yStr) return "Ontem";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function ClosedPeriodServices() {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const [currentDate, setCurrentDate] = useState<string>(() => toDateStr(getHojeBRT()));
  const [expanded, setExpanded] = useState(false);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev + "T12:00:00");
      d.setDate(d.getDate() + dir);
      return d.toISOString().substring(0, 10);
    });
    setExpanded(false);
  };

  // Query only services for the specific date instead of loading ALL services
  const { data: closedServices = [], isLoading } = useQuery({
    queryKey: ["closed-period-services", organizationId, currentDate, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      // Query services created on this specific date
      const dayStart = `${currentDate}T00:00:00`;
      const dayEnd = `${currentDate}T23:59:59`;

      let query = supabase
        .from("services")
        .select("id, value, service_type, status, created_at, document_type, client:clients(name)")
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .neq("document_type", "quote")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false });

      if (!isDemoMode) {
        query = query.eq("is_demo_data", false);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Post-filter by local date (to handle timezone edge cases)
      return (data || []).filter((s) => getDatePartInTz(s.created_at, DEFAULT_TIMEZONE) === currentDate);
    },
    enabled: !!organizationId,
  });

  const totalValue = useMemo(
    () => closedServices.reduce((sum, s) => sum + (Number(s.value) || 0), 0),
    [closedServices]
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3"><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-12 w-full" /></CardContent>
      </Card>
    );
  }

  const MAX_VISIBLE = 4;
  const visible = expanded ? closedServices : closedServices.slice(0, MAX_VISIBLE);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 px-4 sm:px-6 pt-4 sm:pt-6">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-primary" />
            Serviços Fechados
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium min-w-[70px] text-center capitalize">
              {formatDayLabel(currentDate)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate(1)}
              disabled={currentDate >= toDateStr(getHojeBRT())}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[11px] text-muted-foreground">Quantidade</p>
            <p className="text-2xl font-bold text-foreground">{closedServices.length}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[11px] text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
          </div>
        </div>

        {closedServices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Nenhum serviço fechado.</p>
        ) : (
          <div className="space-y-1.5">
            {visible.map((s) => {
              const clientName = (s.client as any)?.name || "Cliente";
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-md border px-2 sm:px-3 py-2 text-sm overflow-hidden">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="truncate font-medium">{clientName}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0 leading-3 flex-shrink-0">
                      {SERVICE_TYPE_LABELS[s.service_type] || s.service_type}
                    </Badge>
                  </div>
                  <span className="font-semibold text-[11px] sm:text-xs whitespace-nowrap shrink-0">{formatCurrency(Number(s.value) || 0)}</span>
                </div>
              );
            })}
            {closedServices.length > MAX_VISIBLE && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-center text-xs text-primary font-medium py-1 hover:underline flex items-center justify-center gap-1"
              >
                Ver todos ({closedServices.length})
                <ChevronDown className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
