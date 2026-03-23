import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWhatsAppMessageActions() {
  const [acting, setActing] = useState(false);

  const deleteMessage = useCallback(async (messageDbId: string, mode: "all" | "local" = "all") => {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-message-action", {
        body: { action: mode === "local" ? "delete_local" : "delete", message_db_id: messageDbId },
      });
      if (error) {
        toast.error("Falha ao excluir mensagem");
        throw error;
      }
      if (data?.error) {
        toast.error(data.error);
        return false;
      }
      toast.success(mode === "local" ? "Mensagem ocultada da plataforma" : "Mensagem excluída para todos");
      return true;
    } catch {
      return false;
    } finally {
      setActing(false);
    }
  }, []);

  const editMessage = useCallback(async (messageDbId: string, newText: string) => {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-message-action", {
        body: { action: "edit", message_db_id: messageDbId, new_text: newText },
      });
      if (error) {
        toast.error("Falha ao editar mensagem no WhatsApp");
        throw error;
      }
      if (data?.error) {
        toast.error(data.error);
        return false;
      }
      toast.success("Mensagem editada");
      return true;
    } catch {
      return false;
    } finally {
      setActing(false);
    }
  }, []);

  const reactToMessage = useCallback(async (messageDbId: string, emoji: string) => {
    setActing(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-message-action", {
        body: { action: "react", message_db_id: messageDbId, emoji },
      });
      if (error) {
        toast.error("Falha ao enviar reação");
        throw error;
      }
      if (data?.error) {
        toast.error(data.error);
        return false;
      }
      return true;
    } catch {
      return false;
    } finally {
      setActing(false);
    }
  }, []);

  return { deleteMessage, editMessage, reactToMessage, acting };
}
