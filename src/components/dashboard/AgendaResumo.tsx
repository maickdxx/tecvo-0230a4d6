import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, ArrowRight, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { getHojeBRT } from "@/lib/periodoGlobal";
import { ServiceStatusBadge, type EffectiveStatus } from "@/components/services/ServiceStatusBadge";
import { Button } from "@/components/ui/button";

function toDateStr(d: Date): string {
  return d.toLocaleDateString("sv-SE");
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "--:--";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatDayLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Hoje";
  const tomorrow = new Date(today + "T12:00:00");
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateStr === tomorrow.toISOString().substring(0, 10)) return "Amanhã";
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" });
}

export function AgendaResumo() {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const today = toDateStr(getHojeBRT());

  const { data: services = [], isLoading } = useQuery({
    queryKey: ["agenda-resumo", organizationId, today, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      const dayStart = `${today}T00:00:00`;
      // Next 3 days
      const endDate = new Date(today + "T12:00:00");
      endDate.setDate(endDate.getDate() + 3);
      const dayEnd = `${toDateStr(endDate)}T23:59:59`;

      let query = supabase
        .from("services")
        .select("id, scheduled_date, status, service_type, client:clients(name)")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .neq("document_type", "quote")
        .neq("status", "cancelled")
        .neq("status", "completed")
        .gte("scheduled_date", dayStart)
        .lte("scheduled_date", dayEnd)
        .order("scheduled_date", { ascending: true })
        .limit(6);

      if (!isDemoMode) {
        query = query.eq("is_demo_data", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });

  // Also check for overdue
  const { data: overdueServices = [] } = useQuery({
    queryKey: ["agenda-resumo-overdue", organizationId, today, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      let query = supabase
        .from("services")
        .select("id, scheduled_date, status, service_type, client:clients(name)")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .neq("document_type", "quote")
        .in("status", ["scheduled", "in_progress"])
        .lt("scheduled_date", `${today}T00:00:00`)
        .order("scheduled_date", { ascending: false })
        .limit(3);

      if (!isDemoMode) {
        query = query.eq("is_demo_data", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });

  const allServices = useMemo(() => {
    const overdue = overdueServices.map((s) => ({ ...s, _overdue: true }));
    const upcoming = services.map((s) => ({ ...s, _overdue: false }));
    return [...overdue, ...upcoming];
  }, [overdueServices, services]);

  if (isLoading) {
    return (
      <div className="mb-5 rounded-xl border border-border bg-card p-5 flex items-center justify-center h-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (allServices.length === 0) return null;

  return (
    <div className="mb-5 rounded-xl border border-border/60 bg-card shadow-card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Próximos Serviços
        </h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-primary gap-1"
          onClick={() => navigate("/agenda")}
        >
          Ver agenda
          <ArrowRight className="h-3 w-3" />
        </Button>
      </div>
      <div className="divide-y divide-border/50">
        {allServices.map((s) => {
          const clientName = (s.client as any)?.name || "Cliente";
          const dateStr = s.scheduled_date?.substring(0, 10) || "";
          const effectiveStatus: EffectiveStatus = (s as any)._overdue ? "overdue" : (s.status as EffectiveStatus);
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/ordens-servico/${s.id}`)}
              className="flex items-center justify-between gap-3 px-5 py-3 w-full text-left hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="text-center shrink-0 w-12">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase">
                    {formatDayLabel(dateStr, today)}
                  </p>
                  <p className="text-sm font-bold text-card-foreground">
                    {formatTime(s.scheduled_date)}
                  </p>
                </div>
                <span className="text-sm font-medium text-card-foreground truncate">{clientName}</span>
              </div>
              <ServiceStatusBadge status={effectiveStatus} className="text-[10px]" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
