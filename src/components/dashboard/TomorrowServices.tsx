import { useMemo, useState } from "react";
import { CalendarClock, MessageCircle, Clock, User, ChevronDown, ChevronUp, CalendarDays, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getTodayInTz, DEFAULT_TIMEZONE, formatTimeInTz } from "@/lib/timezone";

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
    if (h === 0 && m === 0) return null;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function getTomorrowStr(): string {
  const today = new Date(getTodayInTz(DEFAULT_TIMEZONE));
  today.setDate(today.getDate() + 1);
  return today.toISOString().split("T")[0];
}

function getDaysAgo(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function buildMessage(clientName: string, serviceType: string, time: string | null, date: string): string {
  const typeLabel = SERVICE_TYPE_LABELS[serviceType] || serviceType || "serviço";
  const [y, m, d] = date.split("-");
  const dateFormatted = `${d}/${m}/${y}`;

  let msg = `Olá ${clientName}! 😊\n\nPassando para lembrar do seu serviço de *${typeLabel}* agendado para *${dateFormatted}*`;
  if (time) {
    msg += ` às *${time}*`;
  }
  msg += `.\n\nPodemos confirmar? Qualquer dúvida estou à disposição!`;
  return msg;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const fullPhone = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

export function TomorrowServices() {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const tomorrowStr = useMemo(getTomorrowStr, []);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: services, isLoading } = useQuery({
    queryKey: ["tomorrow-services", organizationId, tomorrowStr, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      let q = supabase
        .from("services")
        .select("id, scheduled_date, service_type, client_id, created_at, clients!inner(name, phone, whatsapp)")
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
          <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <CalendarClock className="h-3.5 w-3.5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-foreground">
              Serviços de Amanhã ({services.length})
            </CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Lembre seus clientes com um toque — a mensagem já vai pronta
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1.5">
        {services.slice(0, 6).map((svc: any) => {
          const client = svc.clients as any;
          const phone = client?.whatsapp || client?.phone;
          const time = svc.scheduled_date ? formatTime(svc.scheduled_date) : null;
          const typeLabel = SERVICE_TYPE_LABELS[svc.service_type] || svc.service_type || "Serviço";
          const daysAgo = getDaysAgo(svc.created_at);
          const message = buildMessage(client?.name || "Cliente", svc.service_type, time, tomorrowStr);
          const isExpanded = expandedId === svc.id;

          return (
            <div key={svc.id} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{client?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{typeLabel}</span>
                    {time && (
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {time}
                      </span>
                    )}
                    {daysAgo > 0 && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <CalendarDays className="h-2.5 w-2.5" />
                        Agendado há {daysAgo} dia{daysAgo !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0"
                    onClick={() => setExpandedId(isExpanded ? null : svc.id)}
                  >
                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  </Button>
                  {phone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 gap-1 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-900/30"
                      onClick={() => window.open(buildWhatsAppUrl(phone, message), "_blank")}
                    >
                      <MessageCircle className="h-3 w-3" />
                      Lembrar
                    </Button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-2.5 pt-0">
                  <div className="bg-muted/50 rounded-md p-2.5 border border-border">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Mensagem que será enviada:</p>
                    <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                      {message.replace(/\*/g, "")}
                    </p>
                  </div>
                  {daysAgo >= 3 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                      ⚠️ Agendado há {daysAgo} dias — o cliente pode ter esquecido. Bom lembrar!
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {services.length > 6 && (
          <p className="text-[10px] text-muted-foreground text-center pt-1">
            +{services.length - 6} serviços adicionais
          </p>
        )}
      </CardContent>
    </Card>
  );
}
