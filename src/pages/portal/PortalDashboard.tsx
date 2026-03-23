import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useClientPortal, ClientService } from "@/contexts/ClientPortalContext";
import { Loader2, LogOut, RefreshCw, Clock, CheckCircle2, Wrench, Calendar, ChevronRight, MessageCircle, User, Building2, CalendarClock, Bell, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { format, addMonths, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; icon: React.ReactNode }> = {
  scheduled: {
    label: "Agendado",
    bg: "bg-blue-50",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: <Calendar className="h-3.5 w-3.5" />,
  },
  in_progress: {
    label: "Em andamento",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    icon: <Wrench className="h-3.5 w-3.5" />,
  },
  completed: {
    label: "Concluído",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: "Cancelado",
    bg: "bg-red-50",
    text: "text-red-600",
    border: "border-red-200",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
};

const TYPE_MAP: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  cleaning: "Limpeza",
  repair: "Reparo",
};

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return "—"; }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try { return format(new Date(dateStr), "dd MMM yyyy", { locale: ptBR }); } catch { return "—"; }
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <div className="bg-white border-b border-border/40 px-4 py-5">
        <div className="max-w-lg mx-auto flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-xl" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
      </div>
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
        <Skeleton className="h-20 w-full rounded-xl" />
      </div>
    </div>
  );
}

export default function PortalDashboard() {
  const navigate = useNavigate();
  const { session, data, isLoading, error, loadData, toggleReminder, logout } = useClientPortal();

  useEffect(() => {
    if (!session) navigate("/portal/login", { replace: true });
  }, [session]);

  // Recurrence: find last completed cleaning/maintenance with no future scheduled service
  const recurrence = useMemo(() => {
    if (!data?.services) return null;
    const hasFutureScheduled = data.services.some(
      s => (s.status === "scheduled" || s.status === "in_progress")
    );
    if (hasFutureScheduled) return null;

    const lastEligible = data.services.find(
      s => s.status === "completed" && ["cleaning", "maintenance"].includes(s.service_type) && s.completed_date
    );
    if (!lastEligible) return null;

    const recommendedDate = addMonths(new Date(lastEligible.completed_date!), 6);
    const now = new Date();
    const daysUntil = differenceInDays(recommendedDate, now);
    const isOverdue = daysUntil < 0;
    const serviceLabel = lastEligible.service_type === "cleaning" ? "limpeza" : "manutenção";
    return { date: recommendedDate, serviceLabel, serviceType: lastEligible.service_type, daysUntil, isOverdue };
  }, [data?.services]);

  if (!session) return null;

  if (isLoading && !data) return <LoadingSkeleton />;

  if (error && !data) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white p-4 gap-4">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-2">
          <Clock className="h-7 w-7 text-destructive" />
        </div>
        <p className="text-foreground font-medium">{error}</p>
        <Button variant="outline" onClick={loadData} className="rounded-xl">Tentar novamente</Button>
      </div>
    );
  }

  const pc = data?.portal_config;
  const activeService = data?.services?.find(s => s.status === "scheduled" || s.status === "in_progress");
  const historyServices = data?.services || [];
  const whatsappNumber = pc?.contact_phone || data?.organization?.whatsapp_owner || data?.organization?.phone;
  const logoUrl = pc?.logo_url || data?.organization?.logo_url;
  const orgName = pc?.display_name || data?.organization?.name || "Empresa";
  const clientFirstName = data?.client?.name?.split(" ")[0] || "Cliente";
  const reminderEnabled = data?.client?.maintenance_reminder_enabled ?? false;

  const handleWhatsApp = () => {
    if (!whatsappNumber) return;
    const digits = whatsappNumber.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    window.open(`https://wa.me/${num}`, "_blank");
  };

  const handleScheduleRecurrence = () => {
    if (!whatsappNumber) return;
    const digits = whatsappNumber.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    const msg = encodeURIComponent("Olá, gostaria de agendar uma limpeza do meu ar-condicionado.");
    window.open(`https://wa.me/${num}?text=${msg}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Premium Header with logo */}
      <header className="bg-white border-b border-border/40 sticky top-0 z-10 shadow-sm shadow-black/[0.02]">
        <div className="max-w-lg mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={orgName}
                className="w-11 h-11 rounded-xl object-cover border border-border/60 shadow-sm"
              />
            ) : (
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground truncate">{orgName}</p>
              <p className="text-xs text-muted-foreground">
                Olá, {clientFirstName} 👋
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={loadData}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-all duration-200"
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => { logout(); navigate("/portal/login", { replace: true }); }}
              className="p-2.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all duration-200"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Welcome subtitle */}
      <div className="max-w-lg mx-auto px-4 pt-5 pb-1">
        <p className="text-xs text-muted-foreground">
          Aqui você acompanha seus serviços conosco
        </p>
      </div>

      <main className="max-w-lg mx-auto px-4 py-4 space-y-5">
        {/* Active Service — Highlighted */}
        {activeService ? (
          <section className="animate-fade-in">
            <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
              Serviço Atual
            </h2>
            <ActiveServiceCard service={activeService} onWhatsApp={whatsappNumber ? handleWhatsApp : undefined} />
          </section>
        ) : (
          <div className="animate-fade-in bg-card rounded-2xl border border-border/60 shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
            <p className="text-xs text-muted-foreground mt-1">Nenhum serviço em andamento</p>
          </div>
        )}

        {/* Recurrence Recommendation Card with Countdown */}
        {recurrence && whatsappNumber && (
          <section className="animate-fade-in" style={{ animationDelay: "50ms" }}>
            <div className={`rounded-2xl border shadow-sm p-5 relative overflow-hidden ${
              recurrence.isOverdue 
                ? "bg-gradient-to-br from-orange-50 to-red-50 border-orange-200/60" 
                : "bg-gradient-to-br from-sky-50 to-emerald-50 border-sky-200/60"
            }`}>
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full -translate-y-8 translate-x-8 ${
                recurrence.isOverdue ? "bg-orange-100/40" : "bg-sky-100/40"
              }`} />
              <div className="relative">
                <div className="flex items-start gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    recurrence.isOverdue ? "bg-orange-100" : "bg-sky-100"
                  }`}>
                    {recurrence.isOverdue 
                      ? <AlertTriangle className="h-5 w-5 text-orange-600" />
                      : <CalendarClock className="h-5 w-5 text-sky-600" />
                    }
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">
                      {recurrence.isOverdue ? "Manutenção atrasada" : "Próxima manutenção recomendada"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {recurrence.isOverdue 
                        ? `Sua ${recurrence.serviceLabel} está atrasada. Agende o quanto antes para manter o desempenho do seu ar-condicionado.`
                        : `Para manter o desempenho do seu ar-condicionado, recomendamos uma nova ${recurrence.serviceLabel}.`
                      }
                    </p>
                  </div>
                </div>

                {/* Countdown */}
                <div className={`flex items-center gap-2 mb-4 ml-[52px] px-3 py-2 rounded-lg ${
                  recurrence.isOverdue ? "bg-orange-100/60" : "bg-sky-100/60"
                }`}>
                  <Calendar className={`h-3.5 w-3.5 ${recurrence.isOverdue ? "text-orange-600" : "text-sky-600"}`} />
                  <div className="flex flex-col">
                    <span className={`text-xs font-semibold ${recurrence.isOverdue ? "text-orange-700" : "text-sky-700"}`}>
                      {format(recurrence.date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </span>
                    <span className={`text-[11px] font-medium ${recurrence.isOverdue ? "text-orange-600" : "text-sky-600"}`}>
                      {recurrence.isOverdue
                        ? `Atrasada há ${Math.abs(recurrence.daysUntil)} dia${Math.abs(recurrence.daysUntil) !== 1 ? "s" : ""}`
                        : recurrence.daysUntil === 0
                          ? "Hoje é o dia recomendado!"
                          : `Faltam ${recurrence.daysUntil} dia${recurrence.daysUntil !== 1 ? "s" : ""} para a próxima ${recurrence.serviceLabel}`
                      }
                    </span>
                  </div>
                </div>

                <Button
                  onClick={handleScheduleRecurrence}
                  className="w-full gap-2 h-11 rounded-xl bg-[#25D366] hover:bg-[#1fba59] text-white font-semibold shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <MessageCircle className="h-4 w-4" />
                  Agendar nova {recurrence.serviceLabel}
                </Button>

                {/* Reminder opt-in */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-black/5">
                  <div className="flex items-center gap-2">
                    <Bell className={`h-3.5 w-3.5 ${reminderEnabled ? "text-sky-600" : "text-muted-foreground"}`} />
                    <span className="text-xs text-muted-foreground">Receber lembrete automático</span>
                  </div>
                  <Switch
                    checked={reminderEnabled}
                    onCheckedChange={(checked) => toggleReminder(checked)}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {historyServices.length > 0 && (
          <section className="animate-fade-in" style={{ animationDelay: "100ms" }}>
            <h2 className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest mb-2.5">
              Histórico de Serviços ({historyServices.length})
            </h2>
            <div className="space-y-2.5">
              {historyServices.map((service, i) => (
                <HistoryCard
                  key={service.id}
                  service={service}
                  onClick={() => navigate(`/portal/servico/${service.id}`)}
                  delay={i * 40}
                />
              ))}
            </div>
          </section>
        )}

        {/* WhatsApp CTA — Bottom */}
        {whatsappNumber && (
          <div className="animate-fade-in pt-2" style={{ animationDelay: "200ms" }}>
            <Button
              onClick={handleWhatsApp}
              className="w-full gap-2.5 h-14 text-base font-semibold rounded-2xl bg-[#25D366] hover:bg-[#1fba59] text-white shadow-lg shadow-[#25D366]/20 transition-all duration-200 hover:shadow-xl hover:shadow-[#25D366]/30 hover:-translate-y-0.5"
            >
              <MessageCircle className="h-5 w-5" />
              {activeService ? "Falar no WhatsApp" : "Solicitar novo serviço"}
            </Button>
          </div>
        )}
      </main>

      <footer className="text-center text-[11px] text-muted-foreground/50 py-6">
        Powered by <span className="font-semibold text-muted-foreground/70">Tecvo</span>
      </footer>
    </div>
  );
}

/* ── Active Service Card ── */
function ActiveServiceCard({ service, onWhatsApp }: { service: any; onWhatsApp?: () => void }) {
  const cfg = STATUS_CONFIG[service.status] || STATUS_CONFIG.scheduled;

  return (
    <div className={`bg-card rounded-2xl border-2 ${cfg.border} shadow-md shadow-black/[0.04] p-5 relative overflow-hidden`}>
      {/* Decorative accent bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 ${cfg.bg.replace("50", "400")}`}
        style={{ background: service.status === "scheduled" ? "#3b82f6" : service.status === "in_progress" ? "#f59e0b" : "#10b981" }}
      />

      <div className="flex items-center justify-between mb-4 pt-1">
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.text}`}>
          {cfg.icon}
          {cfg.label}
        </span>
        <span className="text-xs font-medium text-muted-foreground bg-accent/50 px-2.5 py-1 rounded-lg">
          {TYPE_MAP[service.service_type] || service.service_type}
        </span>
      </div>

      {service.description && (
        <p className="text-sm text-foreground mb-4 leading-relaxed">{service.description}</p>
      )}

      <div className="space-y-2.5 text-sm">
        <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-accent/30">
          <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className="text-muted-foreground">Data</span>
          <span className="text-foreground font-medium ml-auto">{formatDate(service.scheduled_date || service.entry_date)}</span>
        </div>
        {service.technician_name && (
          <div className="flex items-center gap-3 py-2 px-3 rounded-xl bg-accent/30">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="text-muted-foreground">Técnico</span>
            <span className="text-foreground font-medium ml-auto">{service.technician_name}</span>
          </div>
        )}
      </div>

      {onWhatsApp && (
        <Button
          onClick={onWhatsApp}
          variant="outline"
          className="w-full mt-5 gap-2 h-12 rounded-xl border-[#25D366]/30 text-[#25D366] hover:bg-[#25D366]/5 font-semibold transition-all duration-200 hover:border-[#25D366]/50"
        >
          <MessageCircle className="h-4 w-4" />
          Falar no WhatsApp
        </Button>
      )}
    </div>
  );
}

/* ── History Card ── */
function HistoryCard({ service, onClick, delay }: { service: any; onClick: () => void; delay: number }) {
  const cfg = STATUS_CONFIG[service.status] || STATUS_CONFIG.scheduled;

  return (
    <button
      onClick={onClick}
      className="w-full bg-card rounded-xl border border-border/60 shadow-sm p-4 flex items-center gap-3 text-left transition-all duration-200 hover:shadow-md hover:border-primary/20 hover:-translate-y-0.5 animate-fade-in group"
      style={{ animationDelay: `${delay}ms` }}
    >
      {/* Status dot */}
      <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
        <span className={cfg.text}>{cfg.icon}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold ${cfg.bg} ${cfg.text}`}>
            {cfg.label}
          </span>
        </div>
        <p className="text-sm font-medium text-foreground truncate">
          {TYPE_MAP[service.service_type] || service.service_type}
          {service.description ? ` — ${service.description}` : ""}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {formatShortDate(service.completed_date || service.scheduled_date || service.entry_date)}
        </p>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground/40 flex-shrink-0 transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}
