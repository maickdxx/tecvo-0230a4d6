import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, MapPin, User, ChevronRight, Clock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { getTodayInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  scheduled: { label: "Agendado", className: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  in_progress: { label: "Em andamento", className: "bg-primary/10 text-primary" },
  completed: { label: "Concluído", className: "bg-success/10 text-success" },
};

export function MiniAgenda() {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();

  const { data: services, isLoading } = useQuery({
    queryKey: ["mini-agenda", organizationId, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];
      const today = getTodayInTz(DEFAULT_TIMEZONE);
      const dayStart = `${today}T00:00:00`;
      const dayEnd = `${today}T23:59:59`;

      let q = supabase
        .from("services")
        .select("id, scheduled_date, status, service_type, value, client:clients(name, address, city)")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .neq("document_type", "quote")
        .neq("status", "cancelled")
        .gte("scheduled_date", dayStart)
        .lte("scheduled_date", dayEnd)
        .order("scheduled_date", { ascending: true })
        .limit(5);

      if (!isDemoMode) q = q.eq("is_demo_data", false);

      const { data } = await q;
      return data || [];
    },
    enabled: !!organizationId,
    staleTime: 30_000,
  });

  // Check if all services have the same time (meaning time wasn't individually set)
  const allSameTime = useMemo(() => {
    if (!services || services.length <= 1) return false;
    const times = services.map((s: any) =>
      s.scheduled_date ? format(parseISO(s.scheduled_date), "HH:mm") : ""
    );
    return times.every((t: string) => t === times[0]);
  }, [services]);

  if (isLoading || !services || services.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card shadow-card overflow-hidden animate-fade-in">
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Próximos Serviços Hoje
          </h3>
        </div>
        <button
          onClick={() => navigate("/agenda")}
          className="text-xs text-primary font-medium flex items-center gap-0.5 hover:underline"
        >
          Ver agenda
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>

      <div className="divide-y divide-border">
        {services.map((svc: any, index: number) => {
          const status = STATUS_CONFIG[svc.status] || STATUS_CONFIG.scheduled;
          const client = svc.client as any;
          const time = svc.scheduled_date
            ? format(parseISO(svc.scheduled_date), "HH:mm")
            : "--:--";

          return (
            <button
              key={svc.id}
              onClick={() => navigate(`/ordens-servico/${svc.id}`)}
              className="w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/50 active:bg-muted group"
            >
              {/* Time or order number */}
              <div className="flex flex-col items-center shrink-0 w-12">
                {allSameTime ? (
                  <>
                    <span className="text-lg font-bold text-primary">#{index + 1}</span>
                  </>
                ) : (
                  <>
                    <Clock className="h-3 w-3 text-muted-foreground mb-0.5" />
                    <span className="text-sm font-bold text-foreground">{time}</span>
                  </>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">
                    {client?.name || "Cliente não informado"}
                  </span>
                </div>
                {(client?.address || client?.city) && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground truncate">
                      {[client?.address, client?.city].filter(Boolean).join(", ")}
                    </span>
                  </div>
                )}
              </div>

              {/* Status badge */}
              <span className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full shrink-0 ${status.className}`}>
                {status.label}
              </span>

              <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
