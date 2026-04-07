/**
 * ═══════════════════════════════════════════════════════════════
 *  UNIFIED WHATSAPP DOCUMENT SENDER
 * ═══════════════════════════════════════════════════════════════
 *
 *  Single Source of Truth for sending documents (PDFs, images, etc.)
 *  via WhatsApp Evolution API. Used by:
 *    - whatsapp-media edge function (manual sends from inbox)
 *    - Laura AI (send_service_pdf tool)
 *    - Any future automated send flow
 *
 *  This ensures every send:
 *    ✓ Uses the same Evolution API pipeline
 *    ✓ Tracks message_id from provider
 *    ✓ Saves to whatsapp_messages
 *    ✓ Updates contact last_message_at
 *    ✓ Handles disconnection detection
 *    ✓ Returns real success/failure (no false positives)
 */

import { classifyEvoError } from "./evoErrorClassifier.ts";

export interface SendDocumentParams {
  supabase: any;
  organizationId: string;
  channelId: string;
  contactId: string;
  /** Public or signed URL of the document to send */
  mediaUrl: string;
  mediaType: "image" | "audio" | "document" | "video";
  /** Caption/text to attach to the media */
  caption?: string;
  /** Original file name (used for document type) */
  fileName?: string;
  /** Origin for audit trail */
  sentVia: "laura_ai" | "manual_inbox" | "manual_panel" | "automation" | "bot_engine";
}

export interface SendDocumentResult {
  ok: boolean;
  messageId?: string;
  error?: string;
  errorCode?: string;
  /** If the channel was auto-disconnected due to error */
  channelDisconnected?: boolean;
}

/**
 * Send a document via WhatsApp using the unified pipeline.
 * 
 * This function:
 * 1. Validates and fetches channel + contact
 * 2. Sends via Evolution API
 * 3. Saves the outbound message with real message_id
 * 4. Updates contact last_message_at
 * 5. Returns real success/failure
 */
export async function sendWhatsAppDocument(params: SendDocumentParams): Promise<SendDocumentResult> {
  const {
    supabase,
    organizationId,
    channelId,
    contactId,
    mediaUrl,
    mediaType,
    caption,
    fileName,
    sentVia,
  } = params;

  const logPrefix = `[SEND-DOC:${sentVia}]`;

  // ── 1. Fetch and validate channel ──
  const { data: channel, error: chErr } = await supabase
    .from("whatsapp_channels")
    .select("id, instance_name, organization_id, is_connected, channel_status, phone_number")
    .eq("id", channelId)
    .eq("organization_id", organizationId)
    .single();

  if (chErr || !channel) {
    console.error(`${logPrefix} Channel not found: ${channelId}`, chErr?.message);
    return { ok: false, error: "Canal não encontrado.", errorCode: "channel_not_found" };
  }

  if (!channel.is_connected || !channel.instance_name || channel.channel_status !== "connected") {
    console.warn(`${logPrefix} Channel ${channelId} disconnected.`);
    return { ok: false, error: "Canal desconectado. Reconecte para enviar.", errorCode: "channel_disconnected" };
  }

  // ── 2. Fetch and validate contact ──
  const { data: contact, error: ctErr } = await supabase
    .from("whatsapp_contacts")
    .select("id, phone, whatsapp_id, normalized_phone")
    .eq("id", contactId)
    .eq("organization_id", organizationId)
    .single();

  if (ctErr || !contact) {
    console.error(`${logPrefix} Contact not found: ${contactId}`, ctErr?.message);
    return { ok: false, error: "Contato não encontrado.", errorCode: "contact_not_found" };
  }

  const digits = contact.normalized_phone || normalizePhone(contact.phone || contact.whatsapp_id || "");
  if (!digits) {
    return { ok: false, error: "Número de telefone não identificado.", errorCode: "invalid_recipient" };
  }

  const recipientJid = `${digits}@s.whatsapp.net`;

  // ── 3. Get Evolution API config ──
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL")?.replace(/\/+$/, "");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

  if (!vpsUrl || !apiKey) {
    return { ok: false, error: "API WhatsApp não configurada.", errorCode: "api_not_configured" };
  }

  // ── 4. Send via Evolution API ──
  let evoEndpoint: string;
  let evoBody: any;

  if (mediaType === "audio") {
    evoEndpoint = `${vpsUrl}/message/sendWhatsAppAudio/${channel.instance_name}`;
    evoBody = { number: recipientJid, audio: mediaUrl };
  } else {
    evoEndpoint = `${vpsUrl}/message/sendMedia/${channel.instance_name}`;
    evoBody = {
      number: recipientJid,
      mediatype: mediaType === "image" ? "image" : mediaType === "video" ? "video" : "document",
      media: mediaUrl,
      caption: caption || undefined,
      fileName: mediaType === "document" ? (fileName || "document.pdf") : undefined,
    };
  }

  console.log(`${logPrefix} Sending to ${evoEndpoint} | contact=${contactId} | channel=${channelId}`);

  let evoResponse: Response;
  try {
    evoResponse = await fetch(evoEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify(evoBody),
    });
  } catch (fetchErr: any) {
    console.error(`${logPrefix} Fetch error:`, fetchErr.message);
    return { ok: false, error: "Erro de rede ao enviar.", errorCode: "network_error" };
  }

  if (!evoResponse.ok) {
    const errText = await evoResponse.text();
    console.error(`${logPrefix} Evolution error: ${evoResponse.status}`, errText);

    const classified = classifyEvoError(evoResponse.status, errText);

    if (classified.isDisconnection) {
      await supabase
        .from("whatsapp_channels")
        .update({
          is_connected: false,
          channel_status: "disconnected",
          disconnected_reason: classified.technicalReason.substring(0, 200),
        })
        .eq("id", channel.id);

      console.warn(`${logPrefix} Channel auto-disconnected: ${channel.id}`);
      return {
        ok: false,
        error: classified.userMessage,
        errorCode: "channel_disconnected",
        channelDisconnected: true,
      };
    }

    return {
      ok: false,
      error: classified.userMessage,
      errorCode: classified.domainError,
    };
  }

  // ── 5. Parse response and extract message_id ──
  const evoData = await evoResponse.json();
  const fallbackMessageId = `out_${crypto.randomUUID()}`;
  const realMessageId = evoData?.key?.id || fallbackMessageId;
  console.log(`${logPrefix} Success — message_id: ${realMessageId}`);

  // ── 6. Save outbound message ──
  const { error: insertErr } = await supabase.from("whatsapp_messages").insert({
    organization_id: organizationId,
    contact_id: contact.id,
    message_id: realMessageId,
    content: caption || "",
    media_url: mediaUrl,
    media_type: mediaType,
    is_from_me: true,
    status: "sent",
    channel_id: channel.id,
  });

  if (insertErr) {
    console.error(`${logPrefix} Message insert error (non-blocking):`, insertErr.message);
  }

  // ── 7. Update contact last_message_at ──
  await supabase
    .from("whatsapp_contacts")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", contact.id);

  console.log(`${logPrefix} Document sent and saved successfully`);

  return { ok: true, messageId: realMessageId };
}

// ── Helper ──
function normalizePhone(input: string): string {
  const beforeAt = input.split("@")[0];
  return beforeAt.replace(/\D/g, "");
}
