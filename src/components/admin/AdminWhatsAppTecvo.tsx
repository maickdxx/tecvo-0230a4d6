import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  RefreshCw,
  Smartphone,
  Wifi,
  WifiOff,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Send,
  Power,
  PowerOff,
  RotateCcw,
  Activity,
  Server,
  MessageSquare,
  XCircle,
} from "lucide-react";

const INSTANCE_NAME = "tecvo";

interface LiveStatus {
  state: string;
  phone_number: string | null;
  error_message: string | null;
  checked_at: string;
}

interface SendMetrics {
  sent_24h: number;
  errors_24h: number;
  recent_errors: Array<{
    error_message: string | null;
    sent_at: string | null;
    channel: string | null;
    metadata: any;
  }>;
}

export function AdminWhatsAppTecvo() {
  const [status, setStatus] = useState<LiveStatus | null>(null);
  const [metrics, setMetrics] = useState<SendMetrics | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrString, setQrString] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrLoading, setQrLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [testModalOpen, setTestModalOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testMessage, setTestMessage] = useState("Teste de envio Tecvo ✅");
  const [testResult, setTestResult] = useState<{ ok: boolean; elapsed_ms?: number; error?: string; message_id?: string } | null>(null);
  const [testSending, setTestSending] = useState(false);

  const invoke = useCallback(async (action: string, extra?: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-admin-status", {
      body: { action, instance_name: INSTANCE_NAME, ...extra },
    });
    if (error) throw error;
    return data;
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await invoke("status");
      if (data?.ok) {
        setStatus({
          state: data.state,
          phone_number: data.phone_number,
          error_message: data.error_message,
          checked_at: data.checked_at,
        });
        if (data.state === "open") {
          setQrCode(null);
          setQrString(null);
        }
      }
    } catch (e) {
      console.error("Failed to fetch status:", e);
    }
  }, [invoke]);

  const fetchMetrics = useCallback(async () => {
    try {
      const data = await invoke("send_metrics");
      if (data?.ok) {
        setMetrics({
          sent_24h: data.sent_24h,
          errors_24h: data.errors_24h,
          recent_errors: data.recent_errors || [],
        });
      }
    } catch (e) {
      console.error("Failed to fetch metrics:", e);
    }
  }, [invoke]);

  const fetchQR = useCallback(async () => {
    setQrLoading(true);
    try {
      const data = await invoke("qrcode");
      if (data?.ok) {
        if (data.state === "open") {
          setQrCode(null);
          setQrString(null);
          setStatus(prev => prev ? { ...prev, state: "open", checked_at: data.checked_at } : prev);
        } else {
          setQrCode(data.qrcode);
          setQrString(data.qr_string);
        }
      }
    } catch (e) {
      console.error("Failed to fetch QR:", e);
    } finally {
      setQrLoading(false);
    }
  }, [invoke]);

  const handleDisconnect = async () => {
    setActionLoading("disconnect");
    try {
      await invoke("disconnect");
      await fetchStatus();
    } catch (e) {
      console.error("Failed to disconnect:", e);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRestart = async () => {
    setActionLoading("restart");
    try {
      await invoke("restart");
      // Wait a moment then refresh status
      setTimeout(async () => {
        await fetchStatus();
        setActionLoading(null);
      }, 2000);
    } catch (e) {
      console.error("Failed to restart:", e);
      setActionLoading(null);
    }
  };

  const handleSendTest = async () => {
    if (!testPhone.trim()) {
      toast.error("Informe o número de destino");
      return;
    }
    setTestSending(true);
    setTestResult(null);
    try {
      const data = await invoke("send_test", { phone: testPhone, message: testMessage });
      setTestResult(data);
      if (data?.ok) {
        toast.success("Mensagem de teste enviada com sucesso!");
        fetchMetrics();
      } else {
        toast.error(data?.error || "Erro ao enviar mensagem de teste");
      }
    } catch (e: any) {
      setTestResult({ ok: false, error: e.message || "Erro desconhecido" });
      toast.error("Falha ao enviar mensagem de teste");
    } finally {
      setTestSending(false);
    }
  };


  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([fetchStatus(), fetchMetrics()]);
      setLoading(false);
    };
    init();
  }, [fetchStatus, fetchMetrics]);

  // Polling
  useEffect(() => {
    if (pollingRef.current) clearInterval(pollingRef.current);

    pollingRef.current = setInterval(() => {
      if (status?.state === "open") {
        fetchStatus();
      } else {
        fetchStatus();
        if (qrCode || qrString) {
          fetchQR();
        }
      }
    }, 8000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [status?.state, qrCode, qrString, fetchStatus, fetchQR]);

  const isConnected = status?.state === "open";
  const isConnecting = status?.state === "connecting";

  const formatDate = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-48 w-full" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          WhatsApp Institucional Tecvo
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Canal utilizado para automações, onboarding, cobranças e notificações da plataforma.
        </p>
      </div>

      {/* Status Principal */}
      <Card className={isConnected ? "border-green-500/30" : "border-destructive/30"}>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                isConnected ? "bg-green-500/10" : "bg-destructive/10"
              }`}>
                {isConnected ? (
                  <Wifi className="h-6 w-6 text-green-600" />
                ) : isConnecting ? (
                  <Loader2 className="h-6 w-6 text-yellow-600 animate-spin" />
                ) : (
                  <WifiOff className="h-6 w-6 text-destructive" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">
                  {isConnected ? "Conectado" : isConnecting ? "Conectando..." : "Desconectado"}
                </CardTitle>
                <CardDescription>
                  {isConnected && status?.phone_number
                    ? `Número: ${status.phone_number}`
                    : isConnected
                    ? "Sessão ativa"
                    : "O canal institucional não está conectado"
                  }
                </CardDescription>
              </div>
            </div>

            <StatusBadge state={status?.state || "unknown"} />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Instância</span>
              <p className="font-mono font-medium">{INSTANCE_NAME}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Estado</span>
              <p className="font-medium">{status?.state || "Desconhecido"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Número</span>
              <p className="font-medium">{status?.phone_number || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Última verificação</span>
              <p className="font-mono text-xs">{formatDate(status?.checked_at || null)}</p>
            </div>
          </div>

          {status?.error_message && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 rounded-lg border border-destructive/20">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
              <p className="text-xs text-destructive">{status.error_message}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { fetchStatus(); fetchMetrics(); }}
              disabled={!!actionLoading}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar Status
            </Button>

            {!isConnected && (
              <Button
                size="sm"
                onClick={fetchQR}
                disabled={qrLoading || !!actionLoading}
              >
                {qrLoading ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                {qrCode ? "Regenerar QR Code" : "Conectar WhatsApp"}
              </Button>
            )}

            {isConnected && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={!!actionLoading}>
                    {actionLoading === "disconnect" ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <PowerOff className="h-4 w-4 mr-2" />
                    )}
                    Desconectar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Desconectar WhatsApp Institucional?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso vai encerrar a sessão do WhatsApp institucional da Tecvo. 
                      Todas as automações (trial, cobrança, onboarding) ficarão sem canal de envio até reconectar.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDisconnect} className="bg-destructive text-destructive-foreground">
                      Sim, desconectar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={!!actionLoading}>
                  {actionLoading === "restart" ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RotateCcw className="h-4 w-4 mr-2" />
                  )}
                  Reiniciar Conexão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Reiniciar conexão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Isso vai desconectar e reconectar a instância. Pode ser necessário escanear um novo QR Code.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRestart}>Reiniciar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {isConnected && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setTestResult(null); setTestModalOpen(true); }}
                disabled={!!actionLoading}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar Teste
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Modal de Teste de Envio */}
      <Dialog open={testModalOpen} onOpenChange={setTestModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enviar mensagem de teste</DialogTitle>
            <DialogDescription>
              Valide se o canal institucional está enviando mensagens corretamente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="test-phone">Número de destino</Label>
              <Input
                id="test-phone"
                placeholder="5511999999999"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Formato: código do país + DDD + número (sem espaços ou traços)</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="test-message">Mensagem</Label>
              <Textarea
                id="test-message"
                value={testMessage}
                onChange={(e) => setTestMessage(e.target.value)}
                rows={3}
              />
            </div>
            {testResult && (
              <div className={`p-3 rounded-lg border text-sm ${testResult.ok ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"}`}>
                <div className="flex items-center gap-2 mb-1">
                  {testResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <span className="font-medium">
                    {testResult.ok ? "Enviado com sucesso" : "Falha no envio"}
                  </span>
                </div>
                {testResult.elapsed_ms != null && (
                  <p className="text-xs text-muted-foreground">Tempo: {testResult.elapsed_ms}ms</p>
                )}
                {testResult.message_id && (
                  <p className="text-xs text-muted-foreground font-mono">ID: {testResult.message_id}</p>
                )}
                {testResult.error && (
                  <p className="text-xs text-destructive mt-1">{testResult.error}</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestModalOpen(false)}>Fechar</Button>
            <Button onClick={handleSendTest} disabled={testSending}>
              {testSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              Enviar Teste
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code */}
      {!isConnected && (qrCode || qrString) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              QR Code de Conexão
            </CardTitle>
            <CardDescription>
              Abra o WhatsApp no celular → Aparelhos conectados → Conectar um aparelho → Escaneie o QR Code abaixo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center gap-4 p-6 bg-white dark:bg-card rounded-lg border">
              {qrCode ? (
                <img
                  src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                  alt="QR Code WhatsApp Tecvo"
                  className="w-72 h-72 object-contain"
                />
              ) : qrString ? (
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">QR String (copie e cole):</p>
                  <code className="text-xs bg-muted p-3 rounded block break-all max-w-sm">
                    {qrString}
                  </code>
                </div>
              ) : null}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Atualiza automaticamente a cada 8 segundos
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Métricas e Info Técnica */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Validação de Envio */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Envios (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metrics?.sent_24h ?? "—"}</div>
            <p className="text-xs text-muted-foreground mt-1">mensagens enviadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              Erros (24h)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-3xl font-bold ${(metrics?.errors_24h ?? 0) > 0 ? "text-destructive" : ""}`}>
              {metrics?.errors_24h ?? "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">falhas de envio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              Saúde do Canal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isConnected ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium text-green-700">Operacional</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <span className="text-sm font-medium text-destructive">Fora do ar</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">
              {isConnected
                ? (metrics?.errors_24h ?? 0) === 0
                  ? "Nenhum erro nas últimas 24h"
                  : `${metrics?.errors_24h} erro(s) nas últimas 24h`
                : "Canal desconectado — automações não serão enviadas"
              }
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Informações Técnicas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Server className="h-4 w-4" />
            Informações Técnicas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Instância</span>
              <p className="font-mono font-medium">{INSTANCE_NAME}</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Tipo</span>
              <p className="font-medium">Institucional (plataforma)</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Uso</span>
              <p className="font-medium text-xs">Automações, onboarding, cobrança, avisos</p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Separação</span>
              <p className="font-medium text-xs">Isolado dos canais dos clientes</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Erros Recentes */}
      {metrics && metrics.recent_errors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-destructive" />
              Erros Recentes de Envio
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {metrics.recent_errors.map((err, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-destructive/5 rounded-lg border border-destructive/10">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-destructive truncate">
                      {err.error_message || "Erro desconhecido"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatDate(err.sent_at)} • Canal: {err.channel || "whatsapp"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StatusBadge({ state }: { state: string }) {
  switch (state) {
    case "open":
      return (
        <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-sm px-3 py-1">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Conectado
        </Badge>
      );
    case "close":
      return (
        <Badge variant="destructive" className="bg-red-500/10 text-red-600 border-red-500/20 text-sm px-3 py-1">
          <WifiOff className="h-3.5 w-3.5 mr-1.5" />
          Desconectado
        </Badge>
      );
    case "connecting":
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 text-sm px-3 py-1">
          <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          Conectando
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-sm px-3 py-1">
          <AlertCircle className="h-3.5 w-3.5 mr-1.5" />
          {state}
        </Badge>
      );
  }
}
