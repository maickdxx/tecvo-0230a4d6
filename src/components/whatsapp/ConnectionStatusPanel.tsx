import { useState, useEffect, useCallback } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wifi,
  WifiOff,
  Radio,
  AlertTriangle,
  QrCode,
  RefreshCw,
  Loader2,
  Phone,
  Clock,
  ChevronDown,
  ChevronUp,
  Plug,
  Info,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error" | "qr_available";

interface DiagnosticInfo {
  lastState: string | null;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  errorMessage: string | null;
  phoneNumber: string | null;
}

interface ConnectionStatusPanelProps {
  channelId: string | null;
  isConnected: boolean;
  phoneNumber: string | null;
  lastConnectedAt: string | null;
  onRequestQR: () => void;
  onReconnect: () => void;
  qrCode: string | null;
  qrLoading: boolean;
  onRefreshQR: () => void;
  compact?: boolean;
}

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; icon: typeof Wifi }> = {
  connected: {
    label: "Conectado",
    color: "bg-emerald-500/15 text-emerald-700 border-emerald-200 dark:text-emerald-400 dark:border-emerald-800",
    icon: Wifi,
  },
  connecting: {
    label: "Conectando",
    color: "bg-amber-500/15 text-amber-700 border-amber-200 dark:text-amber-400 dark:border-amber-800",
    icon: Radio,
  },
  disconnected: {
    label: "Desconectado",
    color: "bg-muted text-muted-foreground border-border",
    icon: WifiOff,
  },
  error: {
    label: "Erro de conexão",
    color: "bg-destructive/15 text-destructive border-destructive/30",
    icon: AlertTriangle,
  },
  qr_available: {
    label: "QR Code disponível",
    color: "bg-blue-500/15 text-blue-700 border-blue-200 dark:text-blue-400 dark:border-blue-800",
    icon: QrCode,
  },
};

export function ConnectionStatusPanel({
  channelId,
  isConnected,
  phoneNumber,
  lastConnectedAt,
  onRequestQR,
  onReconnect,
  qrCode,
  qrLoading,
  onRefreshQR,
  compact = false,
}: ConnectionStatusPanelProps) {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticInfo>({
    lastState: null,
    lastConnectedAt: lastConnectedAt,
    lastDisconnectedAt: null,
    errorMessage: null,
    phoneNumber: phoneNumber,
  });
  const [refreshing, setRefreshing] = useState(false);

  // Determine current status
  const getStatus = (): ConnectionStatus => {
    if (diagnostics.errorMessage) return "error";
    if (qrCode) return "qr_available";
    if (isConnected) return "connected";
    if (qrLoading) return "connecting";
    return "disconnected";
  };

  const status = getStatus();
  const config = STATUS_CONFIG[status];
  const StatusIcon = config.icon;

  const handleRefreshStatus = useCallback(async () => {
    if (!channelId) return;
    setRefreshing(true);
    try {
      const { data } = await supabase.functions.invoke("whatsapp-instance", {
        body: { action: "status", channel_id: channelId },
      });
      if (data) {
        setDiagnostics((prev) => ({
          ...prev,
          lastState: data.raw_state || data.state,
          lastConnectedAt: data.last_connected_at || prev.lastConnectedAt,
          errorMessage: data.error_message || null,
          phoneNumber: data.phone_number || prev.phoneNumber,
          lastDisconnectedAt: !data.connected && prev.lastConnectedAt ? new Date().toISOString() : prev.lastDisconnectedAt,
        }));
      }
    } catch {
      setDiagnostics((prev) => ({
        ...prev,
        errorMessage: "Falha ao consultar status da instância",
      }));
    } finally {
      setRefreshing(false);
    }
  }, [channelId]);

  // Auto-refresh on mount
  useEffect(() => {
    if (channelId && !isConnected) {
      handleRefreshStatus();
    }
  }, [channelId, isConnected, handleRefreshStatus]);

  const isErrorTechnical = diagnostics.errorMessage?.includes("Connection failed") ||
    diagnostics.errorMessage?.includes("Evolution API returned 5") ||
    diagnostics.lastState === "refused";

  // Compact badge-only mode for the top bar
  if (compact) {
    return (
      <Badge className={`gap-1.5 text-[11px] ${config.color} hover:opacity-90 cursor-pointer`} onClick={() => setShowDiagnostics(!showDiagnostics)}>
        <StatusIcon className={`h-3 w-3 ${status === "connecting" ? "animate-pulse" : ""}`} />
        {config.label}
      </Badge>
    );
  }

  return (
    <div className="space-y-3">
      {/* Status Badge */}
      <div className="flex items-center gap-2.5 flex-wrap">
        <Badge className={`gap-1.5 ${config.color}`}>
          <StatusIcon className={`h-3 w-3 ${status === "connecting" ? "animate-pulse" : ""}`} />
          {config.label}
        </Badge>
        {diagnostics.phoneNumber && (
          <span className="hidden sm:flex text-xs text-muted-foreground items-center gap-1">
            <Phone className="h-3 w-3" />
            {diagnostics.phoneNumber}
          </span>
        )}
      </div>

      {/* Actions — grid on mobile, inline on desktop */}
      <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-1.5">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefreshStatus}
          disabled={refreshing}
          className="gap-1.5 text-xs h-8"
        >
          <RefreshCw className={`h-3 w-3 shrink-0 ${refreshing ? "animate-spin" : ""}`} />
          <span className="truncate">Atualizar status</span>
        </Button>

        {status !== "connected" && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onRequestQR}
              disabled={qrLoading}
              className="gap-1.5 text-xs h-8"
            >
              <QrCode className="h-3 w-3 shrink-0" />
              <span className="truncate">Gerar QR Code</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onReconnect}
              className="gap-1.5 text-xs h-8"
            >
              <Plug className="h-3 w-3 shrink-0" />
              <span className="truncate">Reconectar</span>
            </Button>
          </>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDiagnostics(!showDiagnostics)}
          className="gap-1 text-xs h-8 text-muted-foreground"
        >
          <Info className="h-3 w-3 shrink-0" />
          <span className="truncate">Diagnóstico</span>
          {showDiagnostics ? <ChevronUp className="h-3 w-3 shrink-0" /> : <ChevronDown className="h-3 w-3 shrink-0" />}
        </Button>
      </div>

      {/* Error message banner */}
      {status === "error" && (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1.5 text-sm">
                {isErrorTechnical ? (
                  <>
                    <p className="font-medium text-destructive">Erro técnico na conexão</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      O servidor do WhatsApp pode estar em manutenção ou houve uma incompatibilidade de versão.
                      Este problema requer ajuste técnico no servidor. A equipe de suporte foi notificada.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-destructive">WhatsApp desconectado</p>
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      A sessão do WhatsApp Web foi encerrada. Isso pode ocorrer por inatividade ou atualização do aplicativo.
                      Clique em <strong>"Gerar QR Code"</strong> e escaneie novamente pelo celular.
                    </p>
                  </>
                )}
                {diagnostics.errorMessage && (
                  <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                    Detalhe: {diagnostics.errorMessage}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code inline */}
      {(qrCode || qrLoading) && status !== "connected" && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-4">
            <div className="text-center space-y-1">
              <h3 className="text-sm font-semibold text-foreground">Escaneie o QR Code</h3>
              <p className="text-[11px] text-muted-foreground">
                WhatsApp → Dispositivos conectados → Conectar dispositivo
              </p>
            </div>
            <div className="flex justify-center">
              {qrLoading ? (
                <div className="w-52 h-52 flex items-center justify-center bg-muted/30 rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : qrCode ? (
                <div className="bg-white p-2.5 rounded-lg border border-border">
                  <img
                    src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-52 h-52"
                  />
                </div>
              ) : null}
            </div>
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={onRefreshQR} disabled={qrLoading} className="gap-1.5 text-xs">
                <RefreshCw className="h-3.5 w-3.5" />
                Atualizar QR Code
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Diagnostics panel */}
      {showDiagnostics && (
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5" />
              Diagnóstico da instância
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <DiagnosticRow
                label="Status da API"
                value={diagnostics.lastState || "—"}
              />
              <DiagnosticRow
                label="Última conexão válida"
                value={
                  diagnostics.lastConnectedAt
                    ? format(new Date(diagnostics.lastConnectedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "—"
                }
              />
              <DiagnosticRow
                label="Última desconexão"
                value={
                  diagnostics.lastDisconnectedAt
                    ? format(new Date(diagnostics.lastDisconnectedAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                    : "—"
                }
              />
              <DiagnosticRow
                label="Erro da API"
                value={diagnostics.errorMessage || "Nenhum"}
                isError={!!diagnostics.errorMessage}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function DiagnosticRow({ label, value, isError }: { label: string; value: string; isError?: boolean }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
      <p className={`text-xs ${isError ? "text-destructive font-mono" : "text-foreground"}`}>{value}</p>
    </div>
  );
}
