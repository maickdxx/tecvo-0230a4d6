import { useMemo, useState } from "react";
import { ShoppingBag, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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

  const navigate = (dir: -1 | 1) => {
    setCurrentDate((prev) => {
      const d = new Date(prev + "T12:00:00");
      d.setDate(d.getDate() + dir);
      return d.toISOString().substring(0, 10);
    });
  };

  const { data: closedServices = [], isLoading } = useQuery({
    queryKey: ["closed-period-services", organizationId, currentDate, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      const dayStart = `${currentDate}T00:00:00`;
      const dayEnd = `${currentDate}T23:59:59`;

      let query = supabase
        .from("services")
        .select("id, value, service_type, status, created_at, document_type")
        .is("deleted_at", null)
        .neq("status", "cancelled")
        .neq("document_type", "quote")
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd);

      if (!isDemoMode) {
        query = query.eq("is_demo_data", false);
      }

      const { data, error } = await query;
      if (error) throw error;

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

  return (
    <Card className="overflow-hidden rounded-[2rem] border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.03)] animate-fade-in transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] group">
      <CardHeader className="pb-8 px-8 pt-8 bg-muted/[0.05] border-b border-border/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/50 flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <ShoppingBag className="h-4 w-4 text-primary/60" />
            </div>
            Fluxo de Saída
          </CardTitle>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl hover:bg-background shadow-sm transition-all duration-300" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4 text-muted-foreground/60" />
            </Button>
            <span className="text-[11px] font-black uppercase tracking-[0.15em] min-w-[80px] text-center text-muted-foreground/40 font-mono">
              {formatDayLabel(currentDate)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl hover:bg-background shadow-sm transition-all duration-300"
              onClick={() => navigate(1)}
              disabled={currentDate >= toDateStr(getHojeBRT())}
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-8 py-10 bg-gradient-to-b from-transparent to-muted/[0.02]">
        <div className="grid grid-cols-2 gap-6">
          <div className="text-center p-7 rounded-[1.5rem] bg-muted/[0.05] border border-border/10 transition-all duration-500 hover:bg-muted/[0.1] hover:shadow-inner group/item">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-2 group-hover/item:text-primary/40 transition-colors">Volume</p>
            <p className="text-4xl font-black tracking-tighter text-foreground/80 drop-shadow-sm">{closedServices.length}</p>
          </div>
          <div className="text-center p-7 rounded-[1.5rem] bg-muted/[0.05] border border-border/10 transition-all duration-500 hover:bg-muted/[0.1] hover:shadow-inner group/item">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 mb-2 group-hover/item:text-primary/40 transition-colors">Montante</p>
            <p className="text-4xl font-black tracking-tighter text-foreground/80 drop-shadow-sm">{formatCurrency(totalValue)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
