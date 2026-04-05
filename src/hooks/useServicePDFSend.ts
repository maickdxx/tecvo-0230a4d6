import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { materializeServicePDF } from "@/lib/materializePDF";
import {
  readOfficialServicePdfStatus,
  waitForOfficialServicePdf,
} from "@/lib/officialPdfStorage";
import { toast } from "sonner";
import type { Service } from "@/hooks/useServices";

export function useServicePDFSend() {
  const [sending, setSending] = useState(false);
  const { channels } = useWhatsAppChannels();

  const getStoredOfficialPdf = useCallback(async (service: Service): Promise<Blob | null> => {
    if (!service.organization_id) return null;

    const status = await readOfficialServicePdfStatus(service.organization_id, service.id);
    if (!status.ready || !status.blob) return null;

    const bytes = new Uint8Array(await status.blob.arrayBuffer());
    return new Blob([bytes], { type: "application/pdf" });
  }, []);

  const retryMaterialization = useCallback(async (service: Service): Promise<Blob | null> => {
    if (!service.organization_id) return null;
    console.log("[PDF-SEND] Attempting materialization retry for service:", service.id);
    try {
      await materializeServicePDF(service.id, service.organization_id);

      const status = await waitForOfficialServicePdf(service.organization_id, service.id);
      if (!status.ready || !status.blob) return null;

      const bytes = new Uint8Array(await status.blob.arrayBuffer());
      return new Blob([bytes], { type: "application/pdf" });
    } catch (err) {
      console.warn("[PDF-SEND] Materialization retry failed:", service.id, err);
      return null;
    }
  }, [getStoredOfficialPdf]);

  const sendOSViaWhatsApp = useCallback(async (
    serviceId: string,
    clientPhone?: string,
    contactId?: string,
    channelId?: string,
  ) => {
    setSending(true);
    const loadingToastId = toast.loading("Preparando e enviando OS oficial via WhatsApp...");
    try {
      // Fetch the full service with client
      const { data: service, error } = await supabase
        .from("services")
        .select("*, client:clients(*)")
        .eq("id", serviceId)
        .single();

      if (error || !service) throw new Error("Serviço não encontrado");

      let blob = await getStoredOfficialPdf(service as Service);

      if (!blob) {
        console.log("[PDF-SEND] Official PDF not found in storage, attempting materialization retry...");
        blob = await retryMaterialization(service as Service);
      }

      if (!blob) {
        throw new Error("PDF oficial não encontrado. Abra a OS no painel para gerar o PDF antes de enviar.");
      }

      // Determine channel & contact
      let finalChannelId = channelId;
      let finalContactId = contactId;
      const phone = clientPhone || service.client?.phone || service.client?.whatsapp;

      if (!finalChannelId) {
        // Use first connected channel
        const connected = channels.find(c => c.is_connected);
        if (!connected) {
          toast.error("Nenhum WhatsApp conectado. Conecte um número primeiro.");
          return false;
        }
        finalChannelId = connected.id;
      }

      if (!finalContactId && phone) {
        // Look up or create contact by phone
        let normalized = phone.replace(/\D/g, "");
        // Ensure Brazilian country code prefix
        if (normalized.length === 10 || normalized.length === 11) {
          normalized = "55" + normalized;
        }
        
        // Try finding existing contact by normalized_phone or variants
        // Some contacts may have the number stored with/without the 9th digit
        const variants = [normalized];
        // If 55 + 2-digit DDD + 9 + 8 digits (13 chars), also try without the 9
        if (normalized.length === 13 && normalized.startsWith("55")) {
          variants.push(normalized.slice(0, 4) + normalized.slice(5)); // remove 9th digit
        }
        // If 55 + 2-digit DDD + 8 digits (12 chars), also try with 9
        if (normalized.length === 12 && normalized.startsWith("55")) {
          variants.push(normalized.slice(0, 4) + "9" + normalized.slice(4)); // add 9th digit
        }

        const { data: existingContacts } = await supabase
          .from("whatsapp_contacts")
          .select("id, channel_id")
          .eq("organization_id", service.organization_id)
          .in("normalized_phone", variants)
          .limit(1);

        if (existingContacts && existingContacts.length > 0) {
          finalContactId = existingContacts[0].id;
          // Use the contact's channel if none specified
          if (!channelId && existingContacts[0].channel_id) {
            finalChannelId = existingContacts[0].channel_id;
          }
        } else {
          // Create contact using the client name from the OS
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

      // Send PDF as document via whatsapp-media edge function
      const fileName = `OS-${service.quote_number?.toString().padStart(4, "0") || "0001"}.pdf`;
      const file = new File([blob], fileName, { type: "application/pdf" });

      const formData = new FormData();
      formData.append("channel_id", finalChannelId!);
      formData.append("contact_id", finalContactId);
      formData.append("media_type", "document");
      formData.append("file", file);
      formData.append("caption", `📋 Ordem de Serviço #${service.quote_number?.toString().padStart(4, "0")}`);

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
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || "Falha ao enviar PDF");
      }

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
  }, [channels, getStoredOfficialPdf, retryMaterialization]);

  return { sendOSViaWhatsApp, sending };
}
