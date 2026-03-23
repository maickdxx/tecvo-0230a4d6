import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWhatsAppSendMonitor } from "@/hooks/useWhatsAppSendMonitor";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Send,
  ShieldBan,
  AlertTriangle,
  Activity,
  Pause,
  Play,
  ShieldAlert,
  ShieldCheck,
  Clock,
  User,
  Loader2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const SOURCE_LABELS: Record<string, string> = {
  bot: "Bot",
  manual: "Manual",
  ai: "IA",
  cron: "Automático",
  scheduled: "Agendado",
  auto_notify: "Notificação",
  tips: "Dicas",
  welcome: "Boas-vindas",
  broadcast: "Broadcast",
  portal_otp: "OTP Portal",
  password_reset: "Reset Senha",
};

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-success/10 text-success",
  blocked: "bg-destructive/10 text-destructive",
  error: "bg-warning/10 text-warning",
};

const REASON_LABELS: Record<string, string> = {
  rate_limit_org: "Limite da organização",
  rate_limit_contact: "Limite do contato",
  cooldown: "Cooldown (3s)",
  messaging_paused: "Envios pausados",
  auto_paused: "Pausa automática",
  guard_degraded_no_contact: "Modo degradado (sem contato)",
  guard_degraded_cooldown: "Modo degradado (cooldown)",
  guard_rpc_error_fallback_blocked: "Erro do guard (bloqueado)",
  guard_exception_fallback_blocked: "Exceção do guard (bloqueado)",
};

export default function WhatsAppMonitor() {
  const navigate = useNavigate();
  const { stats, isLoadingStats, blocks, logs, togglePause, isPaused } =
    useWhatsAppSendMonitor();

  const handleTogglePause = () => {
    const newState = !isPaused;
    togglePause.mutate(newState, {
      onSuccess: () =>
        toast.success(
          newState ? "Envios pausados com sucesso" : "Envios reativados"
        ),
      onError: () => toast.error("Erro ao alterar estado dos envios"),
    });
  };

  const orgStatus = isPaused
    ? "pausado"
    : stats?.hasDegraded
      ? "degradado"
      : "normal";

  const statusConfig = {
    normal: {
      label: "Normal",
      icon: ShieldCheck,
      color: "text-success",
      bg: "bg-success/10",
    },
    pausado: {
      label: "Pausado",
      icon: Pause,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    degradado: {
      label: "Modo Degradado",
      icon: ShieldAlert,
      color: "text-warning",
      bg: "bg-warning/10",
    },
  };

  const currentStatus = statusConfig[orgStatus];

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto px-4 py-6 sm:px-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/whatsapp/configuracoes")}
              className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Configurações
            </Button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  Monitor de Envios
                </h1>
                <p className="text-sm text-muted-foreground">
                  Controle total sobre mensagens enviadas e bloqueadas.
                </p>
              </div>
            </div>
          </div>

          <Button
            variant={isPaused ? "default" : "destructive"}
            onClick={handleTogglePause}
            disabled={togglePause.isPending}
            className="gap-2 shrink-0"
          >
            {togglePause.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isPaused ? (
              <Play className="h-4 w-4" />
            ) : (
              <Pause className="h-4 w-4" />
            )}
            {isPaused ? "Reativar Envios" : "Pausar Envios"}
          </Button>
        </div>

        {/* Alerts */}
        {isPaused && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-destructive">
                Envios pausados
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Nenhuma mensagem está sendo enviada. Reative quando estiver
                pronto.
              </p>
            </div>
          </div>
        )}

        {stats?.hasDegraded && !isPaused && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-warning mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-warning">
                Sistema em modo degradado
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                O guard de proteção encontrou erros. Envios estão limitados a
                1/minuto por contato como medida de segurança.
              </p>
            </div>
          </div>
        )}

        {isLoadingStats ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Send className="h-4 w-4" />
                    <span className="text-xs font-medium">Enviadas hoje</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {stats?.sent ?? 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <ShieldBan className="h-4 w-4" />
                    <span className="text-xs font-medium">Bloqueadas</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {stats?.blocked ?? 0}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-xs font-medium">Taxa de bloqueio</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {stats?.blockRate ?? 0}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <currentStatus.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">Status</span>
                  </div>
                  <Badge
                    variant="secondary"
                    className={`${currentStatus.bg} ${currentStatus.color} font-semibold`}
                  >
                    {currentStatus.label}
                  </Badge>
                </CardContent>
              </Card>
            </div>

            {/* Chart */}
            {stats?.hourly && stats.hourly.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold">
                    Envios por hora (hoje)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-4">
                  <div className="h-52 sm:h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.hourly}>
                        <XAxis
                          dataKey="hour"
                          tick={{ fontSize: 10 }}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fontSize: 10 }}
                          allowDecimals={false}
                          width={30}
                        />
                        <Tooltip
                          contentStyle={{
                            fontSize: 12,
                            borderRadius: 8,
                            border: "none",
                          }}
                        />
                        <Legend
                          iconSize={10}
                          wrapperStyle={{ fontSize: 11 }}
                        />
                        <Bar
                          dataKey="manual"
                          name="Manual"
                          stackId="a"
                          fill="hsl(var(--primary))"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="bot"
                          name="Bot"
                          stackId="a"
                          fill="hsl(var(--warning))"
                        />
                        <Bar
                          dataKey="ai"
                          name="IA"
                          stackId="a"
                          fill="hsl(var(--info))"
                        />
                        <Bar
                          dataKey="cron"
                          name="Auto"
                          stackId="a"
                          fill="hsl(var(--success))"
                          radius={[2, 2, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Block Reasons */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldBan className="h-4 w-4 text-destructive" />
                    Motivos de Bloqueio
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.blockReasons &&
                  Object.keys(stats.blockReasons).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(stats.blockReasons)
                        .sort((a, b) => b[1] - a[1])
                        .map(([reason, count]) => (
                          <div
                            key={reason}
                            className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40"
                          >
                            <span className="text-xs text-foreground font-medium">
                              {REASON_LABELS[reason] || reason}
                            </span>
                            <Badge variant="secondary" className="text-xs">
                              {count}
                            </Badge>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Nenhum bloqueio hoje
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Top Contacts */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" />
                    Contatos mais impactados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {stats?.topContacts && stats.topContacts.length > 0 ? (
                    <div className="space-y-2">
                      {stats.topContacts.map((c, i) => (
                        <div
                          key={c.contact_id}
                          className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/40"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-mono w-4">
                              #{i + 1}
                            </span>
                            <span className="text-xs text-foreground font-medium truncate max-w-[180px]">
                              {c.contact_id.slice(0, 8)}…
                            </span>
                          </div>
                          <Badge
                            variant="secondary"
                            className={`text-xs ${c.count > 20 ? "bg-destructive/10 text-destructive" : ""}`}
                          >
                            {c.count} msgs
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground py-4 text-center">
                      Sem dados hoje
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent Blocks */}
            {blocks.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldBan className="h-4 w-4 text-destructive" />
                    Bloqueios recentes
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/60">
                          <th className="text-left font-medium text-muted-foreground p-3">
                            Hora
                          </th>
                          <th className="text-left font-medium text-muted-foreground p-3">
                            Origem
                          </th>
                          <th className="text-left font-medium text-muted-foreground p-3">
                            Motivo
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {blocks.slice(0, 10).map((b) => (
                          <tr
                            key={b.id}
                            className="border-b border-border/30 last:border-0"
                          >
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {format(new Date(b.created_at), "HH:mm:ss", {
                                locale: ptBR,
                              })}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px]">
                                {SOURCE_LABELS[b.source] || b.source}
                              </Badge>
                            </td>
                            <td className="p-3 text-foreground">
                              {REASON_LABELS[b.blocked_reason || ""] ||
                                b.blocked_reason}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Full Log */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Log detalhado
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/60">
                        <th className="text-left font-medium text-muted-foreground p-3">
                          Data/Hora
                        </th>
                        <th className="text-left font-medium text-muted-foreground p-3">
                          Origem
                        </th>
                        <th className="text-left font-medium text-muted-foreground p-3">
                          Status
                        </th>
                        <th className="text-left font-medium text-muted-foreground p-3">
                          Motivo
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {logs.length === 0 ? (
                        <tr>
                          <td
                            colSpan={4}
                            className="p-6 text-center text-muted-foreground"
                          >
                            Nenhum registro encontrado
                          </td>
                        </tr>
                      ) : (
                        logs.map((l) => (
                          <tr
                            key={l.id}
                            className="border-b border-border/30 last:border-0"
                          >
                            <td className="p-3 text-muted-foreground whitespace-nowrap">
                              {format(
                                new Date(l.created_at),
                                "dd/MM HH:mm:ss",
                                { locale: ptBR }
                              )}
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="text-[10px]">
                                {SOURCE_LABELS[l.source] || l.source}
                              </Badge>
                            </td>
                            <td className="p-3">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] ${STATUS_COLORS[l.status] || ""}`}
                              >
                                {l.status === "sent"
                                  ? "Enviada"
                                  : l.status === "blocked"
                                    ? "Bloqueada"
                                    : "Erro"}
                              </Badge>
                            </td>
                            <td className="p-3 text-foreground max-w-[200px] truncate">
                              {l.blocked_reason
                                ? REASON_LABELS[l.blocked_reason] ||
                                  l.blocked_reason
                                : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
}
