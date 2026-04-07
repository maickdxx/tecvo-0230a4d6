import { sendWhatsAppDocument } from "./sendWhatsAppDocument.ts";

type SendOrigin = "laura_ai" | "manual_inbox" | "manual_panel" | "automation" | "bot_engine";

type SendTarget = "self" | "client";

interface SendOfficialServicePdfParams {
  supabase: any;
  organizationId: string;
  serviceData: any;
  target: SendTarget;
  sentVia: SendOrigin;
  channelSource?: "whatsapp_chat" | "app" | "automation";
  contextChannelId?: string | null;
  contextContactId?: string | null;
  explicitTargetContactId?: string | null;
  fallbackClientPhone?: string | null;
}

interface SendOfficialServicePdfResult {
  ok: boolean;
  error?: string;
  errorCode?: string;
  messageId?: string;
  osNumber: string;
  docType: string;
  clientName: string;
  clientPhone: string | null;
  storagePath: string;
  channelId?: string;
  contactId?: string;
}

function normalizePhone(raw?: string | null): string | null {
  const digits = (raw || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("55")) return digits;
  if (digits.length <= 11) return `55${digits}`;
  return digits;
}

async function materializeOfficialPdf(
  serviceId: string,
  organizationId: string,
  force = false,
): Promise<{ ok: boolean; error?: string }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

  const response = await fetch(`${supabaseUrl}/functions/v1/materialize-service-pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ serviceId, organizationId, force }),
  });

  if (!response.ok) {
    return { ok: false, error: await response.text() };
  }

  const payload = await response.json().catch(() => null);
  if (payload?.status !== "ready") {
    return { ok: false, error: payload?.error || payload?.status || "materialization_failed" };
  }

  return { ok: true };
}

export async function sendOfficialServicePdf(
  params: SendOfficialServicePdfParams,
): Promise<SendOfficialServicePdfResult> {
  const {
    supabase,
    organizationId,
    serviceData,
    target,
    sentVia,
    channelSource = "app",
    contextChannelId,
    contextContactId,
    explicitTargetContactId,
    fallbackClientPhone,
  } = params;

  const osNumber = String(serviceData?.quote_number || 0).padStart(4, "0");
  const docType = serviceData?.document_type === "quote" ? "ORÇAMENTO" : "ORDEM DE SERVIÇO";
  const docLabel = serviceData?.document_type === "quote" ? "orçamento" : "OS";
  const clientName = serviceData?.client?.name || "Cliente";
  const clientPhone = serviceData?.client?.phone || serviceData?.client?.whatsapp || fallbackClientPhone || null;
  const storagePath = `os-pdfs/${organizationId}/${serviceData.id}.pdf`;
  const logPrefix = `[OFFICIAL-PDF:${sentVia}:${target}]`;

  if (!serviceData?.id) {
    return { ok: false, error: "Serviço não encontrado.", errorCode: "service_not_found", osNumber, docType, clientName, clientPhone, storagePath };
  }

  if (serviceData.organization_id !== organizationId) {
    return { ok: false, error: "Erro de segurança: essa OS não pertence à sua organização.", errorCode: "invalid_organization", osNumber, docType, clientName, clientPhone, storagePath };
  }

  if (serviceData.deleted_at) {
    return { ok: false, error: `A ${docLabel} #${osNumber} foi excluída e não pode ser enviada.`, errorCode: "service_deleted", osNumber, docType, clientName, clientPhone, storagePath };
  }

  if (target === "client" && !clientPhone) {
    return { ok: false, error: `O cliente "${clientName}" não tem telefone cadastrado. Cadastre o telefone primeiro para enviar a ${docLabel}.`, errorCode: "missing_client_phone", osNumber, docType, clientName, clientPhone, storagePath };
  }

  if (target === "client" && serviceData.last_pdf_sent_at) {
    const lastSent = new Date(serviceData.last_pdf_sent_at).getTime();
    const diffSeconds = (Date.now() - lastSent) / 1000;
    if (diffSeconds < 30) {
      return {
        ok: false,
        error: `A ${docLabel} #${osNumber} já foi enviada há ${Math.round(diffSeconds)} segundos para ${clientName}. Aguarde antes de enviar novamente.`,
        errorCode: "rate_limited",
        osNumber,
        docType,
        clientName,
        clientPhone,
        storagePath,
      };
    }
  }

  if (serviceData.pdf_status !== "ready") {
    if (serviceData.pdf_status === "pending" || serviceData.pdf_status === "failed" || !serviceData.pdf_status) {
      console.log(`${logPrefix} PDF not ready (${serviceData.pdf_status}), rematerializing ${serviceData.id}`);
      const remat = await materializeOfficialPdf(serviceData.id, organizationId);
      if (!remat.ok) {
        console.error(`${logPrefix} Materialization failed:`, remat.error);
        return {
          ok: false,
          error: `Não foi possível gerar o PDF da ${docLabel} #${osNumber} automaticamente. Tente gerar pelo painel.`,
          errorCode: "materialization_failed",
          osNumber,
          docType,
          clientName,
          clientPhone,
          storagePath,
        };
      }
      serviceData.pdf_status = "ready";
    } else if (serviceData.pdf_status === "generating") {
      return {
        ok: false,
        error: `O PDF da ${docLabel} #${osNumber} está sendo gerado. Aguarde alguns segundos e tente novamente.`,
        errorCode: "pdf_generating",
        osNumber,
        docType,
        clientName,
        clientPhone,
        storagePath,
      };
    } else {
      return {
        ok: false,
        error: `A ${docLabel} #${osNumber} não está pronta para envio. Status do PDF: ${serviceData.pdf_status || "desconhecido"}.`,
        errorCode: "pdf_not_ready",
        osNumber,
        docType,
        clientName,
        clientPhone,
        storagePath,
      };
    }
  }

  const storage = supabase.storage.from("whatsapp-media");
  let { data: pdfFile, error: pdfError } = await storage.createSignedUrl(storagePath, 900);

  if (!pdfFile?.signedUrl || pdfError) {
    return {
      ok: false,
      error: `O PDF oficial da ${docLabel} #${osNumber} não foi encontrado no sistema. Gere o PDF pelo painel antes de enviar.`,
      errorCode: "pdf_missing",
      osNumber,
      docType,
      clientName,
      clientPhone,
      storagePath,
    };
  }

  try {
    const headResp = await fetch(pdfFile.signedUrl, { method: "HEAD" });
    const contentLength = parseInt(headResp.headers.get("content-length") || "0", 10);
    if (contentLength > 0 && contentLength < 50_000) {
      console.warn(`${logPrefix} PDF too small (${contentLength}), forcing rematerialization for ${serviceData.id}`);
      const remat = await materializeOfficialPdf(serviceData.id, organizationId, true);
      if (!remat.ok) {
        return {
          ok: false,
          error: `O PDF da ${docLabel} #${osNumber} está desatualizado e a regeneração falhou. Gere novamente pelo painel.`,
          errorCode: "legacy_pdf_invalid",
          osNumber,
          docType,
          clientName,
          clientPhone,
          storagePath,
        };
      }
      const refresh = await storage.createSignedUrl(storagePath, 900);
      if (refresh.data?.signedUrl) {
        pdfFile = refresh.data;
      }
    }
  } catch {
    // ignore HEAD failures and keep current signed URL
  }

  let targetChannelId = contextChannelId || null;
  let targetContactId: string | null = null;

  if (target === "self") {
    // If we already have context from the current conversation, use it directly
    if (contextChannelId && contextContactId) {
      const { data: selfContextContact } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id")
        .eq("id", contextContactId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (selfContextContact && selfContextContact.channel_id === contextChannelId) {
        targetChannelId = contextChannelId;
        targetContactId = contextContactId;
      }
    }

    // Fallback: discover connected channels if context didn't resolve
    if (!targetChannelId || !targetContactId) {
    const { data: connectedSelfChannels } = await supabase
      .from("whatsapp_channels")
      .select("id, created_at")
      .eq("organization_id", organizationId)
      .eq("channel_type", "CUSTOMER_INBOX")
      .eq("is_connected", true)
      .eq("channel_status", "connected")
      .not("instance_name", "is", null)
      .order("created_at", { ascending: true });

    const connectedSelfChannelIds = (connectedSelfChannels || []).map((channel: any) => channel.id);

    let selfPhone: string | null = null;
    let selfName: string | null = null;

    if (contextContactId) {
      const { data: selfContextContact } = await supabase
        .from("whatsapp_contacts")
        .select("id, name, phone, normalized_phone, whatsapp_id, channel_id")
        .eq("id", contextContactId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (selfContextContact) {
        selfPhone = normalizePhone(
          selfContextContact.normalized_phone ||
          selfContextContact.phone ||
          selfContextContact.whatsapp_id,
        );
        selfName = selfContextContact.name || null;

        const currentChannelIsValid = !!(
          selfContextContact.channel_id &&
          connectedSelfChannelIds.includes(selfContextContact.channel_id)
        );

        if (currentChannelIsValid) {
          targetChannelId = selfContextContact.channel_id;
          targetContactId = selfContextContact.id;
        }
      }
    }

    if ((!targetChannelId || !targetContactId) && selfPhone && connectedSelfChannelIds.length > 0) {
      const { data: existingSelfContact } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id, last_message_at")
        .eq("organization_id", organizationId)
        .eq("normalized_phone", selfPhone)
        .in("channel_id", connectedSelfChannelIds)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle();

      if (existingSelfContact) {
        targetContactId = existingSelfContact.id;
        targetChannelId = existingSelfContact.channel_id;
      }
    }

    if ((!targetChannelId || !targetContactId) && selfPhone && connectedSelfChannelIds.length > 0) {
      targetChannelId = connectedSelfChannelIds[0];

      const { data: createdSelfContact, error: createSelfContactError } = await supabase
        .from("whatsapp_contacts")
        .insert({
          organization_id: organizationId,
          name: selfName || selfPhone,
          phone: selfPhone,
          normalized_phone: selfPhone,
          whatsapp_id: `${selfPhone}@s.whatsapp.net`,
          channel_id: targetChannelId,
        })
        .select("id")
        .single();

      if (createSelfContactError || !createdSelfContact) {
        console.error(`${logPrefix} Failed to create self contact:`, createSelfContactError?.message);
        return {
          ok: false,
          error: `Não consegui preparar seu contato do WhatsApp para enviar a ${docLabel} #${osNumber}.`,
          errorCode: "self_contact_create_failed",
          osNumber,
          docType,
          clientName,
          clientPhone,
          storagePath,
        };
      }

      targetContactId = createdSelfContact.id;
    }

    if (!targetChannelId || !targetContactId) {
      return {
        ok: false,
        error: connectedSelfChannelIds.length === 0
          ? `Não há um WhatsApp da sua empresa conectado para enviar a ${docLabel} #${osNumber} para você.`
          : `PDF da ${docLabel} #${osNumber} está pronto, mas não consegui localizar o seu contato do WhatsApp na empresa.`,
        errorCode: connectedSelfChannelIds.length === 0 ? "channel_unavailable" : "missing_whatsapp_context",
        osNumber,
        docType,
        clientName,
        clientPhone,
        storagePath,
      };
    }
  } else {
    if (explicitTargetContactId) {
      const { data: explicitContact } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id")
        .eq("id", explicitTargetContactId)
        .eq("organization_id", organizationId)
        .maybeSingle();

      if (explicitContact) {
        targetContactId = explicitContact.id;
        targetChannelId = targetChannelId || explicitContact.channel_id || null;
      }
    }

    if (!targetChannelId) {
      const { data: connectedChannel } = await supabase
        .from("whatsapp_channels")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("channel_type", "CUSTOMER_INBOX")
        .eq("is_connected", true)
        .eq("channel_status", "connected")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      targetChannelId = connectedChannel?.id || null;
    }

    if (!targetChannelId) {
      return {
        ok: false,
        error: "Nenhum WhatsApp conectado está disponível para enviar este PDF.",
        errorCode: "channel_unavailable",
        osNumber,
        docType,
        clientName,
        clientPhone,
        storagePath,
      };
    }

    if (!targetContactId) {
      const normalizedClientPhone = normalizePhone(clientPhone);
      if (!normalizedClientPhone) {
        return {
          ok: false,
          error: `O cliente "${clientName}" não tem telefone válido para WhatsApp.`,
          errorCode: "invalid_client_phone",
          osNumber,
          docType,
          clientName,
          clientPhone,
          storagePath,
        };
      }

      const { data: clientContact } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id")
        .eq("organization_id", organizationId)
        .eq("channel_id", targetChannelId)
        .eq("normalized_phone", normalizedClientPhone)
        .maybeSingle();

      if (clientContact) {
        targetContactId = clientContact.id;
      } else {
        const { data: anyChannelContact } = await supabase
          .from("whatsapp_contacts")
          .select("id, channel_id")
          .eq("organization_id", organizationId)
          .eq("normalized_phone", normalizedClientPhone)
          .limit(1)
          .maybeSingle();

        if (anyChannelContact) {
          targetContactId = anyChannelContact.id;
          targetChannelId = anyChannelContact.channel_id || targetChannelId;
        } else {
          const { data: createdContact, error: createContactError } = await supabase
            .from("whatsapp_contacts")
            .insert({
              organization_id: organizationId,
              name: clientName,
              phone: clientPhone,
              normalized_phone: normalizedClientPhone,
              whatsapp_id: `${normalizedClientPhone}@s.whatsapp.net`,
              channel_id: targetChannelId,
            })
            .select("id")
            .single();

          if (createContactError || !createdContact) {
            console.error(`${logPrefix} Failed to create client contact:`, createContactError?.message);
            return {
              ok: false,
              error: `Não foi possível preparar o contato do cliente "${clientName}" para envio no WhatsApp.`,
              errorCode: "contact_create_failed",
              osNumber,
              docType,
              clientName,
              clientPhone,
              storagePath,
            };
          }

          targetContactId = createdContact.id;
        }
      }
    }
  }

  const sendResult = await sendWhatsAppDocument({
    supabase,
    organizationId,
    channelId: targetChannelId!,
    contactId: targetContactId!,
    mediaUrl: pdfFile.signedUrl,
    mediaType: "document",
    caption: target === "self"
      ? `📋 ${docType} #${osNumber}`
      : `📋 ${docType} #${osNumber} - ${clientName}`,
    fileName: `${docType.replace(/ /g, "_")}_${osNumber}.pdf`,
    sentVia,
  });

  if (!sendResult.ok) {
    console.error(`${logPrefix} Unified send failed:`, sendResult.errorCode, sendResult.error);
    return {
      ok: false,
      error: sendResult.error || `Não consegui enviar o PDF da ${docLabel} #${osNumber}.`,
      errorCode: sendResult.errorCode || "send_failed",
      osNumber,
      docType,
      clientName,
      clientPhone,
      storagePath,
      channelId: targetChannelId || undefined,
      contactId: targetContactId || undefined,
    };
  }

  if (target === "client") {
    await supabase
      .from("services")
      .update({ last_pdf_sent_at: new Date().toISOString() })
      .eq("id", serviceData.id)
      .eq("organization_id", organizationId);
  }

  try {
    await supabase.from("data_audit_log").insert({
      organization_id: organizationId,
      table_name: "services",
      operation: target === "self" ? "PDF_SENT_SELF" : "PDF_SENT",
      record_id: serviceData.id,
      metadata: {
        os_number: osNumber,
        doc_type: docType,
        client_name: clientName,
        client_phone: clientPhone,
        target,
        storage_path: storagePath,
        sent_via: sentVia,
        pipeline: "official_service_pdf",
        channel_id: targetChannelId,
        contact_id: targetContactId,
        message_id: sendResult.messageId,
        channel: channelSource,
        sent_at: new Date().toISOString(),
      },
    });
  } catch (auditErr: any) {
    console.warn(`${logPrefix} Failed to write audit log:`, auditErr?.message);
  }

  return {
    ok: true,
    messageId: sendResult.messageId,
    osNumber,
    docType,
    clientName,
    clientPhone,
    storagePath,
    channelId: targetChannelId || undefined,
    contactId: targetContactId || undefined,
  };
}
