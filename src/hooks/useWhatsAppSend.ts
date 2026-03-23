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
        if (data.error === "channel_disconnected") {
          toast.error(data.message || "O número não está conectado. Reconecte para enviar.");
        } else if (data.error === "channel_not_linked") {
          toast.error(data.message || "Contato sem canal vinculado.");
        } else if (data.error === "channel_not_found") {
          toast.error(data.message || "Canal não encontrado.");
        } else {
          toast.error(data.message || data.error);
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
