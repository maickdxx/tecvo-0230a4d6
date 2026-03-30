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
    <Card className="overflow-hidden border-none shadow-lg ring-1 ring-border/40">
      <CardHeader className="pb-6 px-6 pt-6 bg-muted/20 border-b border-border/40">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-bold flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <span className="opacity-90">Serviços Fechados</span>
          </CardTitle>
          <div className="flex items-center gap-1.5 bg-card/80 p-1 rounded-full border border-border/40 shadow-sm">
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full hover:bg-muted" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-[10px] font-bold uppercase tracking-widest min-w-[70px] text-center opacity-70">
              {formatDayLabel(currentDate)}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-full hover:bg-muted"
              onClick={() => navigate(1)}
              disabled={currentDate >= toDateStr(getHojeBRT())}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6 pt-6">
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="text-center p-4 rounded-2xl bg-muted/30 border border-border/40 group hover:bg-muted/50 transition-colors">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 mb-1">Quantidade</p>
            <p className="text-3xl font-black text-foreground tabular-nums tracking-tighter">{closedServices.length}</p>
          </div>
          <div className="text-center p-4 rounded-2xl bg-primary/5 border border-primary/10 group hover:bg-primary/10 transition-colors">
            <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1">Valor Total</p>
            <p className="text-3xl font-black text-primary tabular-nums tracking-tighter">{formatCurrency(totalValue)}</p>
          </div>
        </div>

        {closedServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground opacity-60">
            <ShoppingBag className="h-8 w-8 mb-2 stroke-[1.5]" />
            <p className="text-sm font-medium">Nenhum serviço fechado neste dia.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {visible.map((s) => {
              const clientName = (s.client as any)?.name || "Cliente";
              return (
                <div key={s.id} className="group flex items-center justify-between gap-4 rounded-xl border border-border/40 bg-card px-4 py-3.5 text-sm transition-all hover:border-primary/30 hover:shadow-sm">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/40 group-hover:bg-primary transition-colors" />
                    <span className="truncate font-bold text-foreground/90">{clientName}</span>
                    <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tighter px-2 py-0 h-4 bg-muted/30 border-border/60">
                      {SERVICE_TYPE_LABELS[s.service_type] || s.service_type}
                    </Badge>
                  </div>
                  <span className="font-black text-sm tabular-nums text-foreground tracking-tight">{formatCurrency(Number(s.value) || 0)}</span>
                </div>
              );
            })}
            {closedServices.length > MAX_VISIBLE && !expanded && (
              <button
                onClick={() => setExpanded(true)}
                className="w-full text-center text-[11px] text-primary font-bold uppercase tracking-widest py-3 mt-2 hover:bg-primary/5 rounded-xl transition-all flex items-center justify-center gap-2 group"
              >
                Ver todos os {closedServices.length} serviços
                <ChevronDown className="h-4 w-4 group-hover:translate-y-0.5 transition-transform" />
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
