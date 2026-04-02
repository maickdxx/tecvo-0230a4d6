import { useState } from "react";
import { MessageCircle, Send, User, Phone, Clock, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
}: SendReminderDialogProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [editing, setEditing] = useState(false);

  const formatPhone = (p: string) => {
    const digits = p.replace(/\D/g, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return p;
  };

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-reminder", {
        body: { phone, message, client_name: clientName },
      });

      if (error) throw error;

      if (data?.error) {
        const errorMessages: Record<string, string> = {
          no_channel: "Nenhum canal WhatsApp conectado. Conecte um número primeiro.",
          invalid_phone: "Número de telefone inválido.",
          channel_disconnected: "Canal WhatsApp desconectado. Reconecte para enviar.",
          rate_limited: "Limite de envio atingido. Aguarde um momento.",
        };
        toast.error(errorMessages[data.error] || data.message || "Erro ao enviar lembrete.");
        return;
      }

      setSent(true);
      toast.success("Lembrete enviado com sucesso!");
      setTimeout(() => {
        onOpenChange(false);
        setSent(false);
      }, 1500);
    } catch (err) {
      console.error("Reminder send error:", err);
      toast.error("Erro ao enviar lembrete. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  const handleClose = (v: boolean) => {
    if (!sending) {
      onOpenChange(v);
      setSent(false);
      setEditing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleClose}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-full bg-green-500/15 flex items-center justify-center">
              <MessageCircle className="h-4 w-4 text-green-600" />
            </div>
            Enviar Lembrete via WhatsApp
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            A mensagem será enviada diretamente pelo seu WhatsApp conectado na Tecvo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-sm font-medium text-green-700 dark:text-green-300">Lembrete enviado!</p>
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
                <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 p-3">
                  <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                    {message.replace(/\*/g, "")}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {!sent && (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancelar</AlertDialogCancel>
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
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
