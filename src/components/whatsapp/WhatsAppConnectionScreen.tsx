import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Smartphone,
  QrCode,
  Loader2,
  RefreshCw,
  CheckCircle2,
  WifiOff,
  Wifi,
  Radio,
  ArrowRight,
  Phone,
  Check,
} from "lucide-react";
import { useWhatsAppChannel } from "@/hooks/useWhatsAppChannel";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppConnectionScreenProps {
  onConnected: () => void;
}

type ConnectionState = "disconnected" | "connecting" | "scanning" | "naming" | "connected";

export function WhatsAppConnectionScreen({ onConnected }: WhatsAppConnectionScreenProps) {
  const { organization } = useOrganization();
  const { createInstance, fetchQRCode, checkStatus, qrCode, qrLoading, channel, refetch } =
    useWhatsAppChannel();
  const [state, setState] = useState<ConnectionState>("disconnected");
  const [verifying, setVerifying] = useState(false);
  const [channelName, setChannelName] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [detectedPhone, setDetectedPhone] = useState<string | null>(null);

  const generateInstanceName = useCallback(() => {
    if (!organization?.id) return "";
    return `org-${organization.id.replace(/-/g, "").substring(0, 12)}`;
  }, [organization?.id]);

  const handleConnect = async () => {
    if (!organization?.id) return;
    setState("connecting");
    try {
      // If a channel already exists (disconnected), just fetch QR to reconnect
      if (channel?.id) {
        setState("scanning");
        await fetchQRCode();
        return;
      }
      // Create a new channel
      const instanceName = generateInstanceName();
      const result = await createInstance(instanceName);
      if (result?.ok) {
        setState("scanning");
        if (!result.qrcode) {
          setTimeout(() => fetchQRCode(), 1500);
        }
      } else {
        toast.error("Falha ao criar instância. Tente novamente.");
        setState("disconnected");
      }
    } catch {
      toast.error("Erro ao conectar. Tente novamente.");
      setState("disconnected");
    }
  };

  const handleVerifyStatus = async () => {
    setVerifying(true);
    try {
      const status = await checkStatus();
      if (status?.connected) {
        setDetectedPhone(status.phone_number || null);
        setState("naming");
        await refetch();
      } else {
        toast.info("Ainda não conectado. Escaneie o QR Code pelo celular.");
      }
    } catch {
      toast.error("Erro ao verificar status.");
    } finally {
      setVerifying(false);
    }
  };

  const handleSaveName = async () => {
    if (!channel?.id) return;
    if (channelName.trim()) {
      setSavingName(true);
      await supabase
        .from("whatsapp_channels")
        .update({ name: channelName.trim() })
        .eq("id", channel.id);
      setSavingName(false);
    }
    setState("connected");
    await refetch();
  };

  // Poll while scanning
  useEffect(() => {
    if (state !== "scanning" || !channel?.id) return;
    const interval = setInterval(async () => {
      const status = await checkStatus();
      if (status?.connected) {
        setDetectedPhone(status.phone_number || null);
        setState("naming");
        clearInterval(interval);
        await refetch();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [state, channel?.id, checkStatus, refetch]);

  const statusBadge = () => {
    switch (state) {
      case "connected":
      case "naming":
        return (
          <Badge className="gap-1.5 bg-emerald-500/15 text-emerald-700 border-emerald-200 hover:bg-emerald-500/20">
            <Wifi className="h-3 w-3" />
            Conectado
          </Badge>
        );
      case "scanning":
      case "connecting":
        return (
          <Badge className="gap-1.5 bg-amber-500/15 text-amber-700 border-amber-200 hover:bg-amber-500/20">
            <Radio className="h-3 w-3 animate-pulse" />
            Conectando
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="gap-1.5">
            <WifiOff className="h-3 w-3" />
            Desconectado
          </Badge>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-black tracking-tight text-foreground">WhatsApp</h1>
          {statusBadge()}
        </div>
        <p className="text-sm text-muted-foreground">
          Conecte o número da sua empresa para atender clientes diretamente pela Tecvo.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg space-y-6">
          {/* Success State */}
          {state === "connected" ? (
            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-8 text-center space-y-5">
                <div className="mx-auto w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-lg font-semibold text-foreground">
                    WhatsApp conectado com sucesso
                  </h2>
                  {detectedPhone && (
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                      <Phone className="h-4 w-4" />
                      <span className="font-medium">{detectedPhone}</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    Sua central de atendimento está pronta. As mensagens recebidas aparecerão
                    automaticamente.
                  </p>
                </div>
                <Button size="lg" onClick={onConnected} className="gap-2">
                  Abrir central de atendimento
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ) : state === "naming" ? (
            /* Naming step after connection */
            <Card className="border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardContent className="p-8 space-y-6">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                    <Check className="h-7 w-7 text-emerald-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-foreground">
                    WhatsApp conectado!
                  </h2>
                  {detectedPhone && (
                    <div className="flex items-center justify-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-100/50 dark:bg-emerald-900/30 rounded-lg py-2 px-4 mx-auto w-fit">
                      <Phone className="h-4 w-4" />
                      <span className="font-medium">{detectedPhone}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="channel-name-input">Dê um nome para este canal</Label>
                  <Input
                    id="channel-name-input"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="Ex: Comercial, Suporte, Atendimento..."
                    onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                    autoFocus
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Esse nome ajuda a identificar o WhatsApp quando você tiver múltiplos números.
                  </p>
                </div>

                <div className="flex justify-center gap-3">
                  <Button variant="ghost" onClick={handleSaveName}>
                    Pular
                  </Button>
                  <Button onClick={handleSaveName} disabled={savingName} className="gap-2">
                    {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {channelName.trim() ? "Salvar e continuar" : "Continuar"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : state === "scanning" ? (
            /* QR Code Card */
            <Card>
              <CardContent className="p-6 space-y-5">
                <div className="text-center space-y-1">
                  <h2 className="text-base font-semibold text-foreground">Escaneie o QR Code</h2>
                  <p className="text-xs text-muted-foreground">
                    Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
                  </p>
                </div>

                <div className="flex justify-center">
                  {qrLoading ? (
                    <div className="w-64 h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                      <div className="text-center space-y-3">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto" />
                        <p className="text-xs text-muted-foreground">Gerando QR Code...</p>
                      </div>
                    </div>
                  ) : qrCode ? (
                    <div className="bg-white p-3 rounded-lg border border-border">
                      <img
                        src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                        alt="QR Code WhatsApp"
                        className="w-64 h-64"
                      />
                    </div>
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-muted/30 rounded-lg">
                      <div className="text-center space-y-3">
                        <QrCode className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                        <p className="text-xs text-muted-foreground">QR Code não disponível</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fetchQRCode()}
                    disabled={qrLoading}
                    className="gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Atualizar QR
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleVerifyStatus}
                    disabled={verifying}
                    className="gap-1.5"
                  >
                    {verifying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" />
                    )}
                    Verificar status
                  </Button>
                </div>

                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    O status será verificado automaticamente. Quando a conexão for detectada, você poderá
                    nomear o canal.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Initial / Disconnected State */
            <Card>
              <CardContent className="p-8 space-y-6">
                <div className="text-center space-y-3">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Smartphone className="h-8 w-8 text-primary" />
                  </div>
                  <div className="space-y-1.5">
                    <h2 className="text-lg font-semibold text-foreground">Conecte seu WhatsApp</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
                      Vincule o WhatsApp da sua empresa para receber e responder mensagens dos seus
                      clientes diretamente por aqui.
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 bg-muted/40 rounded-lg p-4">
                  {[
                    'Clique em "Conectar WhatsApp" abaixo',
                    "Escaneie o QR Code com o WhatsApp do celular",
                    "Dê um nome ao canal para identificá-lo facilmente",
                    "Pronto! As mensagens aparecerão automaticamente",
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{step}</p>
                    </div>
                  ))}
                </div>

                <div className="text-center">
                  <Button
                    size="lg"
                    onClick={handleConnect}
                    disabled={state === "connecting"}
                    className="gap-2"
                  >
                    {state === "connecting" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Smartphone className="h-4 w-4" />
                    )}
                    {state === "connecting" ? "Preparando conexão..." : "Conectar WhatsApp"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
