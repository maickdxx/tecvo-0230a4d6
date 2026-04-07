import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Sends the OFFICIAL OS PDF through the backend unified pipeline.
 *
 * The backend resolves the canonical file from storage
 * (whatsapp-media/os-pdfs/{orgId}/{serviceId}.pdf), rematerializes if needed,
 * and sends it via the same WhatsApp document pipeline used by Laura.
 */
export function useServicePDFSend() {
  const [sending, setSending] = useState(false);

  const sendOSViaWhatsApp = useCallback(async (
    serviceId: string,
    clientPhone?: string,
    contactId?: string,
    channelId?: string,
  ) => {
    setSending(true);
    const loadingToastId = toast.loading("Enviando OS via WhatsApp...");

    try {
      const { data, error } = await supabase.functions.invoke("send-service-pdf", {
        body: {
          serviceId,
          target: "client",
          clientPhone: clientPhone || null,
          contactId: contactId || null,
          channelId: channelId || null,
        },
      });

      if (error) {
        throw error;
      }

      if (!data?.ok) {
        throw new Error(data?.message || "Falha ao enviar PDF");
      }

      toast.dismiss(loadingToastId);
      toast.success("✅ OS enviada via WhatsApp com sucesso!");
      return true;
    } catch (err: any) {
      toast.dismiss(loadingToastId);
      toast.error(err?.message || "Erro ao enviar OS via WhatsApp");
      return false;
    } finally {
      setSending(false);
    }
  }, []);

  return { sendOSViaWhatsApp, sending };
}
