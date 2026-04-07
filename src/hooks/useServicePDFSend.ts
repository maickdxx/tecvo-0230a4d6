import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { toast } from "sonner";

/**
 * Sends the OFFICIAL OS PDF from storage via WhatsApp.
 * 
 * This hook does NOT generate a PDF — it fetches the same canonical file
 * from storage that Laura and the panel use:
 *   whatsapp-media/os-pdfs/{orgId}/{serviceId}.pdf
 *
 * If the PDF doesn't exist, it triggers backend materialization first.
 */
export function useServicePDFSend() {
  const [sending, setSending] = useState(false);
  const { organization } = useOrganization();
  const { channels } = useWhatsAppChannels();

  /**
   * Fetch the official PDF blob from storage.
   * If not found, trigger backend materialization once and retry.
   */
  const fetchOfficialPDF = useCallback(async (
    serviceId: string,
    organizationId: string,
  ): Promise<{ blob: Blob; storagePath: string } | null> => {
    const storagePath = `os-pdfs/${organizationId}/${serviceId}.pdf`;

    // Try downloading the canonical file
    const { data, error } = await supabase.storage
      .from("whatsapp-media")
      .download(storagePath);

    if (data && !error) {
      console.log(`[PDF-SEND] Official PDF found: ${storagePath} (${data.size} bytes)`);
      return { blob: data, storagePath };
    }

    // Not found — attempt one backend materialization
    console.warn(`[PDF-SEND] PDF not in storage, triggering materialization for ${serviceId}`);
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const { data: { session } } = await supabase.auth.getSession();

    const materializeResp = await fetch(
      `https://${projectId}.supabase.co/functions/v1/materialize-service-pdf`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token || ""}`,
        },
        body: JSON.stringify({ serviceId, organizationId }),
      },
    );

    if (!materializeResp.ok) {
      console.error("[PDF-SEND] Materialization failed:", materializeResp.status);
      return null;
    }

    const result = await materializeResp.json();
    if (result.status !== "ready") {
      console.error("[PDF-SEND] Materialization returned non-ready status:", result.status);
      return null;
    }

    // Retry download after materialization
    const { data: retryData, error: retryError } = await supabase.storage
      .from("whatsapp-media")
      .download(storagePath);

    if (retryData && !retryError) {
      console.log(`[PDF-SEND] PDF materialized and downloaded: ${storagePath} (${retryData.size} bytes)`);
      return { blob: retryData, storagePath };
    }

    console.error("[PDF-SEND] PDF still not found after materialization");
    return null;
  }, []);

  const sendOSViaWhatsApp = useCallback(async (
    serviceId: string,
    clientPhone?: string,
    contactId?: string,
    channelId?: string,
  ) => {
    setSending(true);
    const loadingToastId = toast.loading("Enviando OS via WhatsApp...");
    try {
      // Fetch the service to get metadata
      const { data: service, error } = await supabase
        .from("services")
        .select("*, client:clients(*)")
        .eq("id", serviceId)
        .single();

      if (error || !service) throw new Error("Serviço não encontrado");

      // ── Fetch the OFFICIAL PDF from storage ──
      const pdfResult = await fetchOfficialPDF(serviceId, service.organization_id);
      if (!pdfResult) {
        throw new Error("PDF oficial não encontrado. Gere o PDF pelo painel primeiro.");
      }

      const { blob, storagePath } = pdfResult;

      // ── Determine channel & contact ──
      let finalChannelId = channelId;
      let finalContactId = contactId;
      const phone = clientPhone || service.client?.phone || service.client?.whatsapp;

      if (!finalChannelId) {
        const connected = channels.find(c => c.is_connected);
        if (!connected) {
          toast.error("Nenhum WhatsApp conectado. Conecte um número primeiro.");
          return false;
        }
        finalChannelId = connected.id;
      }

      if (!finalContactId && phone) {
        let normalized = phone.replace(/\D/g, "");
        if (normalized.length === 10 || normalized.length === 11) {
          normalized = "55" + normalized;
        }

        const variants = [normalized];
        if (normalized.length === 13 && normalized.startsWith("55")) {
          variants.push(normalized.slice(0, 4) + normalized.slice(5));
        }
        if (normalized.length === 12 && normalized.startsWith("55")) {
          variants.push(normalized.slice(0, 4) + "9" + normalized.slice(4));
        }

        const { data: existingContacts } = await supabase
          .from("whatsapp_contacts")
          .select("id, channel_id")
          .eq("organization_id", service.organization_id)
          .in("normalized_phone", variants)
          .limit(1);

        if (existingContacts && existingContacts.length > 0) {
          finalContactId = existingContacts[0].id;
          if (!channelId && existingContacts[0].channel_id) {
            finalChannelId = existingContacts[0].channel_id;
          }
        } else {
          const { data: newContact, error: createErr } = await supabase
            .from("whatsapp_contacts")
            .insert({
              organization_id: service.organization_id,
              name: service.client?.name || "Cliente",
              phone: phone,
              normalized_phone: normalized,
              whatsapp_id: `${normalized}@s.whatsapp.net`,
              channel_id: finalChannelId,
            })
            .select("id")
            .single();

          if (createErr || !newContact) throw new Error("Falha ao criar contato");
          finalContactId = newContact.id;
        }
      }

      if (!finalContactId) {
        toast.error("Cliente sem telefone cadastrado. Adicione um telefone ao cliente.");
        return false;
      }

      // ── Send the OFFICIAL PDF as document ──
      const osNumber = service.quote_number?.toString().padStart(4, "0") || "0001";
      const fileName = `OS-${osNumber}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      const formData = new FormData();
      formData.append("channel_id", finalChannelId!);
      formData.append("contact_id", finalContactId);
      formData.append("media_type", "document");
      formData.append("file", file);
      formData.append("caption", `📋 Ordem de Serviço #${osNumber}`);

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sessão expirada. Faça login novamente.");
        return false;
      }

      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/whatsapp-media`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        },
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao enviar PDF");
      }

      // ── Audit log ──
      try {
        await supabase.from("data_audit_log").insert({
          organization_id: service.organization_id,
          table_name: "services",
          operation: "PDF_SENT_MANUAL",
          record_id: serviceId,
          metadata: {
            os_number: osNumber,
            storage_path: storagePath,
            file_size: blob.size,
            client_name: service.client?.name,
            sent_via: "manual_whatsapp_send",
            sent_at: new Date().toISOString(),
          },
        });
      } catch { /* logging should never block */ }

      toast.dismiss(loadingToastId);
      toast.success("✅ OS enviada via WhatsApp com sucesso!");
      return true;
    } catch (err: any) {
      toast.dismiss(loadingToastId);
      toast.error(err.message || "Erro ao enviar OS via WhatsApp");
      return false;
    } finally {
      setSending(false);
    }
  }, [fetchOfficialPDF, channels]);

  return { sendOSViaWhatsApp, sending };
}
