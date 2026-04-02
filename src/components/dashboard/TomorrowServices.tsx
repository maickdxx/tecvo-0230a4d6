import { useMemo } from "react";
import { CalendarClock, MessageCircle, Clock, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTodayInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  cleaning: "Limpeza",
  repair: "Reparo",
};

function formatTime(dateStr: string): string | null {
  try {
    const d = new Date(dateStr);
    const h = d.getUTCHours();
    const m = d.getUTCMinutes();
    if (h === 0 && m === 0) return null; // no time set
    return `${String(h).toString().padStart(2, "0")}:${String(m).toString().padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function getTomorrowStr(): string {
  const today = new Date(getTodayInTz(DEFAULT_TIMEZONE));
  today.setDate(today.getDate() + 1);
  return today.toISOString().split("T")[0];
}

function buildWhatsAppUrl(phone: string, clientName: string, serviceType: string, time: string | null, date: string): string {
  const digits = phone.replace(/\D/g, "");
  const fullPhone = digits.startsWith("55") ? digits : `55${digits}`;

  const typeLabel = SERVICE_TYPE_LABELS[serviceType] || serviceType || "serviço";
  const [y, m, d] = date.split("-");
  const dateFormatted = `${d}/${m}/${y}`;

  let msg = `Olá ${clientName}! 😊\n\nPassando para lembrar do seu serviço de *${typeLabel}* agendado para *${dateFormatted}*`;
  if (time) {
    msg += ` às *${time}*`;
  }
  msg += `.\n\nPodemos confirmar? Qualquer dúvida estou à disposição!`;

  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(msg)}`;
}

export function TomorrowServices() {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const tomorrowStr = useMemo(getTomorrowStr, []);

  const { data: services, isLoading } = useQuery({
    queryKey: ["tomorrow-services", organizationId, tomorrowStr, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      let q = supabase
        .from("services")
        .select("id, scheduled_date, service_type, client_id, clients!inner(name, phone, whatsapp)")
        .eq("organization_id", organizationId)
        .in("status", ["scheduled", "in_progress"])
        .gte("scheduled_date", `${tomorrowStr}T00:00:00`)
        .lt("scheduled_date", `${tomorrowStr}T23:59:59`)
        .is("deleted_at", null)
        .order("scheduled_date", { ascending: true });

      if (!isDemoMode) {
        q = q.eq("is_demo_data", false);
      }

      const { data } = await q;
      return data || [];
    },
    enabled: !!organizationId,
  });

  if (isLoading || !services || services.length === 0) return null;

  return (
    <Card className="border-border bg-card">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <CalendarClock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <CardTitle className="text-sm font-semibold text-foreground">
            Serviços de Amanhã ({services.length})
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-2">
        {services.slice(0, 5).map((svc: any) => {
          const client = svc.clients as any;
          const phone = client?.whatsapp || client?.phone;
          const time = svc.scheduled_date ? formatTime(svc.scheduled_date) : null;
          const typeLabel = SERVICE_TYPE_LABELS[svc.service_type] || svc.service_type || "Serviço";

          return (
            <div key={svc.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-border last:border-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium text-foreground truncate">{client?.name}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{typeLabel}</span>
                  {time && (
                    <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {time}
                    </span>
                  )}
                </div>
              </div>
              {phone && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 gap-1 text-xs shrink-0 text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
                  onClick={() => window.open(buildWhatsAppUrl(phone, client?.name || "Cliente", svc.service_type, time, tomorrowStr), "_blank")}
                >
                  <MessageCircle className="h-3 w-3" />
                  Lembrar
                </Button>
              )}
            </div>
          );
        })}
        {services.length > 5 && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            +{services.length - 5} serviços adicionais
          </p>
        )}
      </CardContent>
    </Card>
  );
}
