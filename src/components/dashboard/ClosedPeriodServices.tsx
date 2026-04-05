import { useEffect, useMemo, useState } from "react";
import { ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getDatePartInTz, getLocalDayBoundsUTC, getTodayInTz } from "@/lib/timezone";

function shiftDateStr(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDayLabel(dateStr: string, todayStr: string): string {
  if (dateStr === todayStr) return "Hoje";
  const yStr = shiftDateStr(todayStr, -1);
  if (dateStr === yStr) return "Ontem";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });
}

export function ClosedPeriodServices() {
  const tz = useOrgTimezone();
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const todayStr = useMemo(() => getTodayInTz(tz), [tz]);
  const [currentDate, setCurrentDate] = useState<string>(() => todayStr);

  useEffect(() => {
    setCurrentDate(todayStr);
  }, [todayStr]);

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((prev) => shiftDateStr(prev, dir));
  };

  const { data: closedServices = [], isLoading } = useQuery({
    queryKey: ["closed-period-services", organizationId, currentDate, tz, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      const dayBounds = getLocalDayBoundsUTC(currentDate, tz);

      let query = supabase
        .from("services")
        .select("id, value, service_type, status, completed_date, document_type")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .eq("status", "completed")
        .neq("document_type", "quote")
        .gte("completed_date", dayBounds.start)
        .lte("completed_date", dayBounds.end);

      if (!isDemoMode) {
        query = query.eq("is_demo_data", false);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).filter((s) => getDatePartInTz(s.completed_date || "", tz) === currentDate);
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
              {formatDayLabel(currentDate, todayStr)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => navigate(1)}
              disabled={currentDate >= todayStr}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[11px] text-muted-foreground">Quantidade</p>
            <p className="text-2xl font-bold text-foreground">{closedServices.length}</p>
          </div>
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <p className="text-[11px] text-muted-foreground">Valor Total</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
