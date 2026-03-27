import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ReplyContext {
  reply_to_id: string;
  reply_to_message_id: string | null;
  reply_to_content: string;
  reply_to_sender: string;
}

export function useWhatsAppSend() {
  const [sending, setSending] = useState(false);

  const sendMessage = useCallback(async (
    channelId: string | null,
    contactId: string,
    message: string,
    replyContext?: ReplyContext | null
  ): Promise<{ ok: boolean; message_id?: string }> => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send", {
        body: { channel_id: channelId, contact_id: contactId, message, reply_context: replyContext || undefined },
      });
      if (error) {
        throw error;
      }
      // Handle structured errors from the edge function
      if (data?.error) {
        const domainError = data.error;
        const userMessage = data.message;

        switch (domainError) {
          case "channel_disconnected":
            toast.error(userMessage || "O número não está conectado. Reconecte para enviar.");
            break;
          case "channel_not_linked":
            toast.error(userMessage || "Contato sem canal vinculado.");
            break;
          case "channel_not_found":
            toast.error(userMessage || "Canal não encontrado.");
            break;
          case "invalid_recipient":
            toast.error(userMessage || "Número inválido ou não registrado no WhatsApp.");
            break;
          case "rate_limited":
            toast.error(userMessage || "Envio limitado. Aguarde antes de tentar novamente.");
            break;
          case "timeout":
            toast.error(userMessage || "Servidor WhatsApp não respondeu. Tente novamente.");
            break;
          case "channel_unavailable":
            toast.error(userMessage || "Canal indisponível no momento.");
            break;
          case "Send blocked":
            toast.error(data.detail || "Envio bloqueado pelo limite de segurança.");
            break;
          default:
            toast.error(userMessage || domainError);
        }
        return { ok: false };
      }
      return { ok: true, message_id: data?.message_id };
    } catch {
      return { ok: false };
    } finally {
      setSending(false);
    }
  }, []);

  return { sendMessage, sending };
}
