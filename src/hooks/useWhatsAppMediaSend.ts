import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function useWhatsAppMediaSend() {
  const [sending, setSending] = useState(false);

  const sendMedia = useCallback(async (
    channelId: string,
    contactId: string,
    file: File,
    mediaType: "image" | "audio" | "document" | "video",
    caption?: string,
  ) => {
    setSending(true);
    try {
      const formData = new FormData();
      formData.append("channel_id", channelId);
      formData.append("contact_id", contactId);
      formData.append("media_type", mediaType);
      formData.append("file", file);
      if (caption) formData.append("caption", caption);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        throw new Error("No session");
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 40000);

      let response: Response;
      try {
        response = await fetch(
          `https://${projectId}.supabase.co/functions/v1/whatsapp-media`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
            body: formData,
            signal: controller.signal,
          }
        );
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        toast.error(err.error || "Falha ao enviar mídia");
        throw new Error(err.error || "Failed");
      }

      return await response.json();
    } catch (error: any) {
      if (error?.name === "AbortError") {
        toast.error("Tempo excedido no envio da mídia. Tente novamente.");
      }
      throw error;
    } finally {
      setSending(false);
    }
  }, []);

  return { sendMedia, sending };
}
