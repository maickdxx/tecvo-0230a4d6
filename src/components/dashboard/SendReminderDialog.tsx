import { useState, useEffect } from "react";
import { MessageCircle, Send, User, Phone, Clock, Loader2, CheckCircle2, Radio, Wifi } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ChannelOption {
  id: string;
  name: string;
  phone_number: string | null;
}

interface SendReminderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  phone: string;
  serviceType: string;
  time: string | null;
  dateFormatted: string;
  message: string;
  onMessageChange: (message: string) => void;
  onSent?: () => void;
}

export function SendReminderDialog({
  open,
  onOpenChange,
  clientName,
  phone,
  serviceType,
  time,
  dateFormatted,
  message,
  onMessageChange,
  onSent,
}: SendReminderDialogProps) {
  const { organizationId } = useAuth();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentChannel, setSentChannel] = useState<string>("");
  const [editing, setEditing] = useState(false);
  const [channelOptions, setChannelOptions] = useState<ChannelOption[] | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Fetch connected channels to show which one will be used
  const { data: connectedChannels } = useQuery({
    queryKey: ["connected-channels-reminder", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from("whatsapp_channels")
        .select("id, name, phone_number")
        .eq("organization_id", organizationId)
        .eq("is_connected", true)
        .eq("channel_status", "connected")
        .in("channel_type", ["CUSTOMER_INBOX", "customer_inbox"]);
      return data || [];
    },
    enabled: !!organizationId && open,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (!open) {
      setSent(false);
      setSentChannel("");
      setEditing(false);
      setChannelOptions(null);
      setSelectedChannelId(null);
    }
  }, [open]);

  const formatPhone = (p: string) => {
    const digits = p.replace(/\D/g, "");
    if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return p;
  };

  const handleSend = async (overrideChannelId?: string) => {
    setSending(true);
    setChannelOptions(null);
    try {
      const body: Record<string, string> = { phone, message, client_name: clientName };
      if (overrideChannelId || selectedChannelId) {
        body.channel_id = overrideChannelId || selectedChannelId!;
      }

      const { data, error } = await supabase.functions.invoke("whatsapp-send-reminder", { body });

      if (error) throw error;

      if (data?.error === "choose_channel") {
        // Multiple channels — show picker
        setChannelOptions(data.channels || []);
        if (data.channels?.length > 0) {
          setSelectedChannelId(data.channels[0].id);
        }
        setSending(false);
        return;
      }

      if (data?.error) {
        const errorMessages: Record<string, string> = {
          no_channel: "Nenhum canal WhatsApp conectado. Conecte um número primeiro.",
          invalid_phone: "Número de telefone inválido.",
          channel_disconnected: "Canal WhatsApp desconectado. Reconecte para enviar.",
          rate_limited: "Limite de envio atingido. Aguarde um momento.",
        };
        toast.error(errorMessages[data.error] || data.message || "Erro ao enviar lembrete.");
        setSending(false);
        return;
      }

      setSent(true);
      setSentChannel(data?.channel_name || "");
      toast.success(`Lembrete enviado${data?.channel_name ? ` via ${data.channel_name}` : ""}!`);
      onSent?.();
      setTimeout(() => onOpenChange(false), 2000);
    } catch (err) {
      console.error("Reminder send error:", err);
      toast.error("Erro ao enviar lembrete. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!sending) onOpenChange(v);
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-primary" />
            </div>
            Enviar Lembrete via WhatsApp
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            A mensagem será enviada diretamente pelo seu WhatsApp conectado na Tecvo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-primary">Lembrete enviado!</p>
            {sentChannel && (
              <p className="text-xs text-muted-foreground">Enviado via canal: {sentChannel}</p>
            )}
          </div>
        ) : channelOptions ? (
          /* Channel picker */
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Você tem múltiplos canais. Escolha por qual enviar:
            </p>
            <div className="space-y-2">
              {channelOptions.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => setSelectedChannelId(ch.id)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                    selectedChannelId === ch.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <Radio className={`h-4 w-4 shrink-0 ${selectedChannelId === ch.id ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className="text-sm font-medium">{ch.name}</p>
                    {ch.phone_number && (
                      <p className="text-xs text-muted-foreground">{ch.phone_number}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setChannelOptions(null)}>
                Voltar
              </Button>
              <Button
                size="sm"
                disabled={!selectedChannelId || sending}
                onClick={() => selectedChannelId && handleSend(selectedChannelId)}
                className="gap-1.5"
              >
                {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Enviar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Client info */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm font-medium">{clientName}</span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {formatPhone(phone)}
                </span>
                {time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {dateFormatted} às {time}
                  </span>
                )}
              </div>
              {serviceType && (
                <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  {serviceType}
                </span>
              )}
              {/* Channel indicator */}
              {connectedChannels && connectedChannels.length > 0 && (
                <div className="flex items-center gap-1.5 pt-1 border-t border-border/50 mt-1">
                  <Wifi className="h-3 w-3 text-green-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Será enviado via:{" "}
                    <span className="font-medium text-foreground">
                      {connectedChannels.length === 1
                        ? connectedChannels[0].name
                        : "Auto (canal do contato)"}
                    </span>
                  </span>
                </div>
              )}
            </div>

            {/* Message preview / editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Mensagem:</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Visualizar" : "Editar"}
                </Button>
              </div>
              {editing ? (
                <Textarea
                  value={message}
                  onChange={(e) => onMessageChange(e.target.value)}
                  className="text-xs min-h-[120px] resize-none"
                />
              ) : (
                <div className="rounded-lg bg-muted/50 border border-border p-3">
                  <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                    {message.replace(/\*/g, "")}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {!sent && !channelOptions && (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <Button
              onClick={() => handleSend()}
              disabled={sending || !message.trim()}
              className="gap-1.5"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Enviar pelo WhatsApp
                </>
              )}
            </Button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
