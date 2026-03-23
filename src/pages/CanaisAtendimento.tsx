import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  MessageSquare,
  Plus,
  Wifi,
  WifiOff,
  Unplug,
  Trash2,
  Loader2,
  RefreshCw,
  QrCode,
  ArrowLeft,
  Smartphone,
  AlertTriangle,
  Pencil,
  Check,
  X,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useWhatsAppChannels, type WhatsAppChannelInfo } from "@/hooks/useWhatsAppChannels";
import { AppLayout } from "@/components/layout";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ConnectionStatusPanel } from "@/components/whatsapp/ConnectionStatusPanel";
import { WhatsAppReliabilityPanel } from "@/components/whatsapp/WhatsAppReliabilityPanel";

// ── Rename Channel Dialog ──
function RenameChannelDialog({
  open,
  onOpenChange,
  channel,
  onRenamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channel: WhatsAppChannelInfo | null;
  onRenamed: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (channel) {
      setName(channel.name || "");
    }
  }, [channel]);

  const handleSave = async () => {
    if (!channel || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("whatsapp_channels")
      .update({ name: name.trim() })
      .eq("id", channel.id);
    setSaving(false);
    if (error) {
      toast.error("Erro ao renomear canal");
    } else {
      toast.success("Canal renomeado com sucesso");
      onRenamed();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Renomear canal</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="channel-name">Nome do canal</Label>
            <Input
              id="channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Comercial, Suporte, Financeiro..."
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Esse nome ajuda a identificar o WhatsApp dentro da Tecvo.
            </p>
          </div>
          {channel?.phone_number && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <Phone className="h-3.5 w-3.5" />
              <span>{channel.phone_number}</span>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Name Channel After Connection Dialog ──
function NameChannelDialog({
  open,
  onOpenChange,
  channelId,
  phoneNumber,
  onNamed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
  phoneNumber: string | null;
  onNamed: () => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!channelId || !name.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("whatsapp_channels")
      .update({ name: name.trim() })
      .eq("id", channelId);
    setSaving(false);
    if (error) {
      toast.error("Erro ao nomear canal");
    } else {
      toast.success("Canal nomeado com sucesso!");
      onNamed();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
              <Check className="h-4 w-4 text-emerald-600" />
            </div>
            WhatsApp conectado!
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {phoneNumber && (
            <div className="flex items-center gap-2 text-sm bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 rounded-lg px-3 py-2.5 border border-emerald-200 dark:border-emerald-800">
              <Phone className="h-4 w-4" />
              <span className="font-medium">{phoneNumber}</span>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="new-channel-name">Dê um nome para este canal</Label>
            <Input
              id="new-channel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Comercial, Suporte, Atendimento..."
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Esse nome ajuda a identificar o WhatsApp quando você tiver mais de um número conectado.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { onOpenChange(false); onNamed(); }}>
            Pular
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Salvar nome
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── WhatsApp Channel Card ──
function WhatsAppChannelCard({
  channel,
  onDisconnect,
  onDelete,
  onReconnect,
  onRename,
  isDisconnecting,
  isDeletingTarget,
  isDeleteDisabled,
  fetchQRCode,
  qrCode,
  qrLoading,
  connectingChannelId,
}: {
  channel: WhatsAppChannelInfo;
  onDisconnect: () => void;
  onDelete: () => void;
  onReconnect: () => void;
  onRename: () => void;
  isDisconnecting: boolean;
  isDeletingTarget: boolean;
  isDeleteDisabled: boolean;
  fetchQRCode: (channelId: string) => Promise<any>;
  qrCode: string | null;
  qrLoading: boolean;
  connectingChannelId: string | null;
}) {
  const displayName = channel.name || "WhatsApp";
  const displayNumber = channel.phone_number || "Número não identificado";
  const connectedDate = channel.last_connected_at || channel.created_at;
  const isGenericName = displayName === channel.instance_name || displayName.startsWith("org-");
  const isThisConnecting = connectingChannelId === channel.id;

  return (
    <Card className={channel.is_connected ? "border-emerald-200/60 dark:border-emerald-800/40" : "border-amber-200/60 dark:border-amber-800/40"}>
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Mobile: vertical stack | Desktop: horizontal */}
        <div className="flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4">
          {/* Icon + Info */}
          <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
            <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl flex items-center justify-center shrink-0 ${
              channel.is_connected 
                ? "bg-emerald-500/10" 
                : "bg-amber-500/10"
            }`}>
              <MessageSquare className={`h-5 w-5 sm:h-6 sm:w-6 ${
                channel.is_connected ? "text-emerald-600" : "text-amber-600"
              }`} />
            </div>

            <div className="flex-1 min-w-0 space-y-1.5">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {isGenericName ? "WhatsApp" : displayName}
              </h3>

              <div className="flex items-center gap-1.5">
                <Phone className="h-3 w-3 text-muted-foreground/60 shrink-0" />
                <p className="text-sm text-foreground/80 font-medium truncate">{displayNumber}</p>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Conectado em {format(new Date(connectedDate), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </p>
            </div>
          </div>

          {/* Actions — full width on mobile, inline on desktop */}
          <div className="flex items-center gap-1.5 sm:shrink-0 border-t sm:border-t-0 border-border/40 pt-2 sm:pt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={onRename}
              className="gap-1.5 text-xs text-muted-foreground hover:text-foreground flex-1 sm:flex-initial"
            >
              <Pencil className="h-3.5 w-3.5" />
              Renomear
            </Button>
            {channel.is_connected ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onDisconnect}
                disabled={isDisconnecting}
                className="gap-1.5 text-xs text-amber-600 hover:text-amber-600 hover:bg-amber-500/10 flex-1 sm:flex-initial"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unplug className="h-3.5 w-3.5" />
                )}
                Desconectar
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isDeleteDisabled}
              className="gap-1.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 flex-1 sm:flex-initial"
            >
              {isDeletingTarget ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Excluir
            </Button>
          </div>
        </div>

        {/* Connection Status & Diagnostics */}
        <ConnectionStatusPanel
          channelId={channel.id}
          isConnected={channel.is_connected}
          phoneNumber={channel.phone_number}
          lastConnectedAt={channel.last_connected_at}
          onRequestQR={async () => { await fetchQRCode(channel.id); }}
          onReconnect={onReconnect}
          qrCode={isThisConnecting ? qrCode : null}
          qrLoading={isThisConnecting ? qrLoading : false}
          onRefreshQR={async () => { await fetchQRCode(channel.id); }}
        />

        {/* Reliability Monitoring */}
        <WhatsAppReliabilityPanel />
      </CardContent>
    </Card>
  );
}

// ── QR Code Connection Panel ──
function QRCodePanel({
  qrCode,
  qrLoading,
  onRefreshQR,
  onCheckStatus,
  onCancel,
  checking,
}: {
  qrCode: string | null;
  qrLoading: boolean;
  onRefreshQR: () => void;
  onCheckStatus: () => void;
  onCancel: () => void;
  checking: boolean;
}) {
  return (
    <Card className="border-primary/20">
      <CardContent className="p-6 space-y-5">
        <div className="text-center space-y-1">
          <h3 className="text-base font-semibold text-foreground">Escaneie o QR Code</h3>
          <p className="text-xs text-muted-foreground">
            Abra o WhatsApp no celular → Dispositivos conectados → Conectar dispositivo
          </p>
        </div>

        <div className="flex justify-center">
          {qrLoading ? (
            <div className="w-56 h-56 flex items-center justify-center bg-muted/30 rounded-lg">
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
                className="w-56 h-56"
              />
            </div>
          ) : (
            <div className="w-56 h-56 flex items-center justify-center bg-muted/30 rounded-lg">
              <div className="text-center space-y-3">
                <QrCode className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                <p className="text-xs text-muted-foreground">QR Code não disponível</p>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-center gap-3">
          <Button variant="outline" size="sm" onClick={onRefreshQR} disabled={qrLoading} className="gap-1.5">
            <RefreshCw className="h-3.5 w-3.5" />
            Atualizar QR
          </Button>
          <Button variant="outline" size="sm" onClick={onCheckStatus} disabled={checking} className="gap-1.5">
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
            Verificar status
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel} className="text-xs">
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──
export default function CanaisAtendimento() {
  const navigate = useNavigate();
  const {
    channels,
    isLoading,
    canAddMore,
    connectingChannelId,
    deletingChannelId,
    qrCode,
    setQrCode,
    setConnectingChannelId,
    createChannel,
    isCreating,
    disconnect,
    isDisconnecting,
    deleteChannel,
    isDeleting,
    reconnect,
    isReconnecting,
    fetchQRCode,
    checkChannelStatus,
    refetch,
  } = useWhatsAppChannels();

  const [disconnectTarget, setDisconnectTarget] = useState<WhatsAppChannelInfo | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppChannelInfo | null>(null);
  const [qrLoading, setQrLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [renameTarget, setRenameTarget] = useState<WhatsAppChannelInfo | null>(null);
  
  // Naming after connection
  const [namingChannelId, setNamingChannelId] = useState<string | null>(null);
  const [namingPhoneNumber, setNamingPhoneNumber] = useState<string | null>(null);

  // Disconnection alert
  const [disconnectedAlert, setDisconnectedAlert] = useState<{ name: string; phone: string | null } | null>(null);

  // Track previous connected state to detect disconnections
  const prevChannelsRef = useState<Map<string, boolean>>(() => new Map())[0];

  // Poll while connecting — detect connection and trigger naming flow
  useEffect(() => {
    if (!connectingChannelId) return;
    const interval = setInterval(async () => {
      const status = await checkChannelStatus(connectingChannelId);
      if (status?.connected) {
        clearInterval(interval);
        // Trigger naming dialog
        setNamingChannelId(connectingChannelId);
        setNamingPhoneNumber(status.phone_number || null);
        setConnectingChannelId(null);
        setQrCode(null);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [connectingChannelId, checkChannelStatus, setConnectingChannelId, setQrCode]);

  // Auto-poll channel statuses every 30s to detect disconnections
  useEffect(() => {
    if (channels.length === 0) return;

    const visibleChannels = channels.filter((ch) => ch.channel_status !== "deleted");

    visibleChannels.forEach((ch) => {
      const wasConnected = prevChannelsRef.get(ch.id);
      if (wasConnected === true && !ch.is_connected) {
        const displayName = (ch.name && ch.name !== ch.instance_name && !ch.name.startsWith("org-"))
          ? ch.name
          : "WhatsApp";
        setDisconnectedAlert({ name: displayName, phone: ch.phone_number });
      }
      prevChannelsRef.set(ch.id, ch.is_connected);
    });

    const interval = setInterval(() => {
      visibleChannels.forEach((ch) => {
        checkChannelStatus(ch.id);
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [channels, checkChannelStatus, prevChannelsRef]);

  const handleRefreshQR = async () => {
    if (!connectingChannelId) return;
    setQrLoading(true);
    await fetchQRCode(connectingChannelId);
    setQrLoading(false);
  };

  const handleCheckStatus = async () => {
    if (!connectingChannelId) return;
    setChecking(true);
    const status = await checkChannelStatus(connectingChannelId);
    if (status?.connected) {
      setNamingChannelId(connectingChannelId);
      setNamingPhoneNumber(status.phone_number || null);
      setConnectingChannelId(null);
      setQrCode(null);
    }
    setChecking(false);
  };

  const handleCancelConnect = () => {
    setConnectingChannelId(null);
    setQrCode(null);
  };

  const handleReconnect = async (channel: WhatsAppChannelInfo) => {
    // Use the proper reconnect action which creates a new instance
    // and links it to the existing channel (preserving history)
    reconnect(channel);
  };

  const confirmDisconnect = () => {
    if (disconnectTarget) {
      disconnect(disconnectTarget);
      setDisconnectTarget(null);
    }
  };

  const getChannelDisplayName = (ch: WhatsAppChannelInfo) => {
    if (ch.name && ch.name !== ch.instance_name && !ch.name.startsWith("org-")) {
      return ch.name;
    }
    return ch.phone_number || "WhatsApp";
  };

  return (
    <AppLayout>
    <div className="space-y-6 sm:space-y-8 max-w-3xl mx-auto px-4 py-5 sm:p-6">
      {/* Header */}
      <div>
        <Button variant="ghost" size="sm" onClick={() => navigate("/whatsapp/configuracoes")} className="gap-1.5 mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-black tracking-tight text-foreground">Canais WhatsApp</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie os números de WhatsApp conectados.
        </p>
      </div>

      {/* WhatsApp Section */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
              <MessageSquare className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Canais WhatsApp</h2>
              <p className="text-[11px] text-muted-foreground">
                {channels.filter(c => c.is_connected).length}/{channels.length} canais conectados • Limite: 3
              </p>
            </div>
          </div>

          {canAddMore && !connectingChannelId && (
            <Button onClick={() => createChannel()} disabled={isCreating} className="gap-1.5 w-full sm:w-auto" size="sm">
              {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
              Conectar novo WhatsApp
            </Button>
          )}
        </div>

        {/* Limit warning */}
        {!canAddMore && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Limite de 3 canais de WhatsApp atingido.
            </p>
          </div>
        )}

        {/* QR Code panel (when connecting) */}
        {connectingChannelId && (
          <QRCodePanel
            qrCode={qrCode}
            qrLoading={qrLoading}
            onRefreshQR={handleRefreshQR}
            onCheckStatus={handleCheckStatus}
            onCancel={handleCancelConnect}
            checking={checking}
          />
        )}

        {/* Channel cards */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : channels.length === 0 && !connectingChannelId ? (
          <Card className="border-dashed">
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Nenhum WhatsApp conectado</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Conecte o WhatsApp da sua empresa para receber e responder mensagens dos clientes.
                </p>
              </div>
              <Button onClick={() => createChannel()} disabled={isCreating} className="gap-1.5">
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Conectar WhatsApp
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {channels
              .filter((ch) => ch.channel_status !== "deleted")
              .map((ch) => (
                <WhatsAppChannelCard
                  key={ch.id}
                  channel={ch}
                  onDisconnect={() => setDisconnectTarget(ch)}
                  onDelete={() => setDeleteTarget(ch)}
                  onReconnect={() => handleReconnect(ch)}
                  onRename={() => setRenameTarget(ch)}
                  isDisconnecting={isDisconnecting}
                  isDeletingTarget={isDeleting && deletingChannelId === ch.id}
                  isDeleteDisabled={isDeleting}
                  fetchQRCode={fetchQRCode}
                  qrCode={qrCode}
                  qrLoading={qrLoading}
                  connectingChannelId={connectingChannelId}
                />
              ))}
          </div>
        )}
      </section>

      {/* Disconnect Confirmation */}
      <AlertDialog open={!!disconnectTarget} onOpenChange={(open) => !open && setDisconnectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desconectar WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              O canal <strong>{disconnectTarget ? getChannelDisplayName(disconnectTarget) : ""}</strong>{" "}
              {disconnectTarget?.phone_number && `(${disconnectTarget.phone_number})`} será desconectado.
              Você poderá reconectá-lo depois. Todas as conversas anteriores continuam salvas, mas novas mensagens não serão recebidas enquanto estiver desconectado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDisconnect} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Desconectar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-base">Excluir canal permanentemente?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>
                O canal <strong>{deleteTarget ? getChannelDisplayName(deleteTarget) : ""}</strong>
                {deleteTarget?.phone_number && ` (${deleteTarget.phone_number})`} será excluído permanentemente.
              </p>
              <p>
                A sessão será encerrada no servidor e o canal não poderá ser reconectado.
                Para usar esse número novamente, será necessário criar um novo canal.
              </p>
              <p className="text-foreground font-medium">
                ✓ O histórico de conversas e mensagens será preservado.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) {
                  deleteChannel(deleteTarget);
                  setDeleteTarget(null);
                }
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir canal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename Dialog */}
      <RenameChannelDialog
        open={!!renameTarget}
        onOpenChange={(open) => !open && setRenameTarget(null)}
        channel={renameTarget}
        onRenamed={refetch}
      />

      {/* Name Channel After Connection Dialog */}
      <NameChannelDialog
        open={!!namingChannelId}
        onOpenChange={(open) => !open && setNamingChannelId(null)}
        channelId={namingChannelId}
        phoneNumber={namingPhoneNumber}
        onNamed={() => {
          setNamingChannelId(null);
          setNamingPhoneNumber(null);
          refetch();
        }}
      />

      {/* Disconnection Alert Dialog */}
      <AlertDialog open={!!disconnectedAlert} onOpenChange={(open) => !open && setDisconnectedAlert(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                <WifiOff className="h-5 w-5 text-destructive" />
              </div>
              <AlertDialogTitle className="text-base">WhatsApp desconectado</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2">
              <p>
                O canal <strong>{disconnectedAlert?.name}</strong>
                {disconnectedAlert?.phone && ` (${disconnectedAlert.phone})`} foi desconectado.
              </p>
              <p>
                Enquanto estiver desconectado, novas mensagens enviadas para esse número não serão recebidas pela Tecvo.
                Todas as conversas anteriores continuam salvas e disponíveis normalmente.
                Reconecte o WhatsApp para voltar a receber mensagens.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setDisconnectedAlert(null)}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </AppLayout>
  );
}
