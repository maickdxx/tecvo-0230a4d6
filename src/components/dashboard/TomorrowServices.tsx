import { useMemo, useState } from "react";
import { CalendarClock, MessageCircle, Clock, User, ChevronDown, ChevronUp, CalendarDays, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getTodayInTz, formatTimeInTz, getLocalDayBoundsUTC, getDatePartInTz } from "@/lib/timezone";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  cleaning: "Limpeza",
  repair: "Reparo",
};

const GENERIC_TYPES = new Set(["other", "others", "outro", "outros", ""]);

function formatTime(dateStr: string, tz: string): string | null {
  try {
    const formatted = formatTimeInTz(dateStr, tz);
    if (formatted === "—" || formatted === "00:00") return null;
    return formatted;
  } catch {
    return null;
  }
}

function getTomorrowStr(tz: string): string {
  const todayStr = getTodayInTz(tz);
  const [y, m, d] = todayStr.split("-").map(Number);
  const tomorrow = new Date(y, m - 1, d + 1);
  const ty = tomorrow.getFullYear();
  const tm = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const td = String(tomorrow.getDate()).padStart(2, "0");
  return `${ty}-${tm}-${td}`;
}

function getDaysAgo(createdAt: string): number {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

function buildMessage(clientName: string, serviceType: string, time: string | null, date: string): string {
  const typeLabel = SERVICE_TYPE_LABELS[serviceType] || "";
  const isGeneric = GENERIC_TYPES.has((serviceType || "").toLowerCase()) || !typeLabel;
  const [y, m, d] = date.split("-");
  const dateFormatted = `${d}/${m}/${y}`;

  let msg = `Olá ${clientName}! 😊\n\n`;
  if (isGeneric) {
    msg += `Passando para lembrar do seu agendamento para *${dateFormatted}*`;
  } else {
    msg += `Passando para lembrar do seu serviço de *${typeLabel.toLowerCase()}* agendado para *${dateFormatted}*`;
  }
  if (time) {
    msg += ` às *${time}*`;
  }
  msg += `.\n\nQualquer dúvida estou à disposição! 😉`;
  return msg;
}

function buildWhatsAppUrl(phone: string, message: string): string {
  const digits = phone.replace(/\D/g, "");
  const fullPhone = digits.startsWith("55") ? digits : `55${digits}`;
  return `https://wa.me/${fullPhone}?text=${encodeURIComponent(message)}`;
}

export function TomorrowServices() {
  const tz = useOrgTimezone();
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const tomorrowStr = useMemo(() => getTomorrowStr(tz), [tz]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editedMessages, setEditedMessages] = useState<Record<string, string>>({});

  const { data: services, isLoading } = useQuery({
    queryKey: ["tomorrow-services", "entry-date-priority", organizationId, tomorrowStr, tz, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      const bounds = getLocalDayBoundsUTC(tomorrowStr, tz);

      let q = supabase
        .from("services")
        .select("id, scheduled_date, entry_date, service_type, client_id, created_at, clients!inner(name, phone, whatsapp)")
        .eq("organization_id", organizationId)
        .in("status", ["scheduled", "in_progress"])
        .or(`and(entry_date.gte.${bounds.start},entry_date.lte.${bounds.end}),and(entry_date.is.null,scheduled_date.gte.${bounds.start},scheduled_date.lte.${bounds.end})`)
        .is("deleted_at", null)
        .order("entry_date", { ascending: true, nullsFirst: false })
        .order("scheduled_date", { ascending: true });

      if (!isDemoMode) {
        q = q.eq("is_demo_data", false);
      }

      const { data } = await q;
      return (data || []).filter((service: any) => {
        const reminderDate = service.entry_date || service.scheduled_date;
        return reminderDate ? getDatePartInTz(reminderDate, tz) === tomorrowStr : false;
      });
    },
    enabled: !!organizationId,
  });

  if (isLoading || !services || services.length === 0) return null;

  return (
    <Card className="border-green-200 dark:border-green-800/50 bg-gradient-to-br from-green-50/80 to-emerald-50/50 dark:from-green-950/30 dark:to-emerald-950/20 shadow-sm">
      <CardHeader className="pb-2 pt-3 px-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-green-500/15 dark:bg-green-500/20 flex items-center justify-center">
            <CalendarClock className="h-4 w-4 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-sm font-semibold text-green-900 dark:text-green-100">
              📋 Serviços de Amanhã ({services.length})
            </CardTitle>
            <p className="text-[10px] text-green-700/70 dark:text-green-300/60 mt-0.5">
              Lembre seus clientes com um toque — a mensagem já vai pronta
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-3 space-y-1.5">
        {services.slice(0, 6).map((svc: any) => {
          const client = svc.clients as any;
          const phone = client?.whatsapp || client?.phone;
          const reminderDate = svc.entry_date || svc.scheduled_date;
          const time = reminderDate ? formatTime(reminderDate, tz) : null;
          const serviceLabel = SERVICE_TYPE_LABELS[svc.service_type];
          const isGenericType = GENERIC_TYPES.has((svc.service_type || "").toLowerCase()) || !serviceLabel;
          const typeLabel = serviceLabel || svc.service_type || "Serviço";
          const daysAgo = getDaysAgo(svc.created_at);
          const defaultMessage = buildMessage(client?.name || "Cliente", svc.service_type, time, tomorrowStr);
          const currentMessage = editedMessages[svc.id] ?? defaultMessage;
          const isExpanded = expandedId === svc.id;
          const isEditing = editingId === svc.id;

          return (
            <div key={svc.id} className="border border-border rounded-lg overflow-hidden">
              <div className="flex items-center justify-between gap-2 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="text-sm font-medium text-foreground truncate">{client?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{isGenericType ? "Agendamento" : typeLabel}</span>
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
                      onClick={() => window.open(buildWhatsAppUrl(phone, currentMessage), "_blank")}
                    >
                      <MessageCircle className="h-3 w-3" />
                      Lembrar
                    </Button>
                  )}
                </div>
              </div>

              {isExpanded && (
                <div className="px-3 pb-2.5 pt-0 space-y-2">
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <Textarea
                        value={currentMessage}
                        onChange={(e) => setEditedMessages(prev => ({ ...prev, [svc.id]: e.target.value }))}
                        className="text-xs min-h-[100px] resize-none"
                      />
                      <div className="flex gap-1.5 justify-end">
                        <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => {
                          setEditedMessages(prev => { const n = { ...prev }; delete n[svc.id]; return n; });
                          setEditingId(null);
                        }}>
                          Resetar
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-xs" onClick={() => setEditingId(null)}>
                          OK
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-muted/50 rounded-md p-2.5 border border-border relative group">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] font-medium text-muted-foreground">Mensagem que será enviada:</p>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 w-5 p-0 opacity-60 hover:opacity-100"
                          onClick={() => setEditingId(svc.id)}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                      </div>
                      <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                        {currentMessage.replace(/\*/g, "")}
                      </p>
                    </div>
                  )}
                  {daysAgo >= 3 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
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
