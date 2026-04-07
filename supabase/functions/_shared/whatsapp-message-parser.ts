/**
 * WhatsApp message content extraction from all known Evolution API message types.
 * Single source of truth for parsing incoming webhook payloads.
 */

export interface ParsedMessage {
  content: string;
  mediaUrl: string | null;
  mediaType: string | null;
}

/**
 * Extract text content, media URL, and media type from a raw Evolution API message object.
 */
export function parseMessageContent(msg: any): ParsedMessage {
  let content = "";
  let mediaUrl: string | null = null;
  let mediaType: string | null = null;

  if (msg.conversation) {
    content = msg.conversation;
  } else if (msg.extendedTextMessage?.text) {
    content = msg.extendedTextMessage.text;
  } else if (msg.imageMessage) {
    content = msg.imageMessage.caption || "";
    mediaType = "image";
    mediaUrl = msg.imageMessage.url || null;
  } else if (msg.videoMessage) {
    content = msg.videoMessage.caption || "";
    mediaType = "video";
    mediaUrl = msg.videoMessage.url || null;
  } else if (msg.audioMessage) {
    mediaType = "audio";
    mediaUrl = msg.audioMessage.url || null;
  } else if (msg.documentWithCaptionMessage) {
    const inner = msg.documentWithCaptionMessage.message?.documentMessage || {};
    content = msg.documentWithCaptionMessage.message?.documentMessage?.caption || inner.fileName || "";
    mediaType = "document";
    mediaUrl = inner.url || null;
  } else if (msg.documentMessage) {
    content = msg.documentMessage.caption || msg.documentMessage.fileName || "";
    mediaType = "document";
    mediaUrl = msg.documentMessage.url || null;
  } else if (msg.stickerMessage) {
    mediaType = "sticker";
    mediaUrl = msg.stickerMessage.url || null;
  } else if (msg.contactMessage) {
    const cName = msg.contactMessage.displayName || "Contato compartilhado";
    let cPhone = "";
    const vcard = msg.contactMessage.vcard || "";
    const telMatch = vcard.match(/TEL[^:]*:([^\r\n]+)/i);
    if (telMatch) cPhone = telMatch[1].replace(/[\s\-()]/g, "");
    content = cPhone ? `${cName}||${cPhone}` : cName;
    mediaType = "contact";
  } else if (msg.contactsArrayMessage) {
    const contacts = msg.contactsArrayMessage.contacts || [];
    const parts = contacts.map((c: any) => {
      const n = c.displayName || "Contato";
      let p = "";
      const vc = c.vcard || "";
      const m = vc.match(/TEL[^:]*:([^\r\n]+)/i);
      if (m) p = m[1].replace(/[\s\-()]/g, "");
      return p ? `${n}||${p}` : n;
    });
    content = parts.join(";;");
    mediaType = "contact";
  } else if (msg.locationMessage) {
    const lat = msg.locationMessage.degreesLatitude;
    const lng = msg.locationMessage.degreesLongitude;
    content = msg.locationMessage.name || msg.locationMessage.address || `Localização: ${lat}, ${lng}`;
    mediaType = "location";
  } else if (msg.liveLocationMessage) {
    content = "Localização em tempo real";
    mediaType = "location";
  } else if (msg.templateMessage) {
    const tmpl = msg.templateMessage.hydratedTemplate || msg.templateMessage.hydratedFourRowTemplate || msg.templateMessage;
    content = tmpl?.hydratedContentText || tmpl?.hydratedTitleText || tmpl?.text || tmpl?.caption || "";
    if (tmpl?.imageMessage) {
      mediaType = "image";
      mediaUrl = tmpl.imageMessage.url || null;
      if (!content && tmpl.imageMessage.caption) content = tmpl.imageMessage.caption;
    } else if (tmpl?.videoMessage) {
      mediaType = "video";
      mediaUrl = tmpl.videoMessage.url || null;
      if (!content && tmpl.videoMessage.caption) content = tmpl.videoMessage.caption;
    } else if (tmpl?.documentMessage) {
      mediaType = "document";
      mediaUrl = tmpl.documentMessage.url || null;
    }
    if (!content) content = "[Mensagem de anúncio]";
  } else if (msg.templateButtonReplyMessage) {
    content = msg.templateButtonReplyMessage.selectedDisplayText || msg.templateButtonReplyMessage.selectedId || "[Resposta de template]";
  } else if (msg.buttonsResponseMessage) {
    content = msg.buttonsResponseMessage.selectedDisplayText || msg.buttonsResponseMessage.selectedButtonId || "[Resposta de botão]";
  } else if (msg.listResponseMessage) {
    content = msg.listResponseMessage.title || msg.listResponseMessage.singleSelectReply?.selectedRowId || "[Seleção de lista]";
  } else if (msg.interactiveMessage) {
    const body = msg.interactiveMessage.body?.text || msg.interactiveMessage.header?.title || "";
    const footer = msg.interactiveMessage.footer?.text || "";
    content = [body, footer].filter(Boolean).join("\n") || "[Mensagem interativa]";
    if (msg.interactiveMessage.header?.imageMessage) {
      mediaType = "image";
      mediaUrl = msg.interactiveMessage.header.imageMessage.url || null;
    } else if (msg.interactiveMessage.header?.videoMessage) {
      mediaType = "video";
      mediaUrl = msg.interactiveMessage.header.videoMessage.url || null;
    } else if (msg.interactiveMessage.header?.documentMessage) {
      mediaType = "document";
      mediaUrl = msg.interactiveMessage.header.documentMessage.url || null;
    }
  } else if (msg.interactiveResponseMessage) {
    content = msg.interactiveResponseMessage.body?.text || msg.interactiveResponseMessage.nativeFlowResponseMessage?.paramsJson || "[Resposta interativa]";
  } else if (msg.orderMessage) {
    content = msg.orderMessage.message || "[Pedido recebido]";
  } else if (msg.productMessage) {
    content = msg.productMessage.product?.title || "[Produto compartilhado]";
  } else if (msg.pollCreationMessage || msg.pollCreationMessageV3) {
    const poll = msg.pollCreationMessage || msg.pollCreationMessageV3;
    content = poll?.name || "[Enquete]";
  } else if (msg.pollUpdateMessage) {
    content = "[Voto em enquete]";
  } else if (msg.viewOnceMessage || msg.viewOnceMessageV2 || msg.viewOnceMessageV2Extension) {
    const inner = msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message || msg.viewOnceMessageV2Extension?.message || {};
    if (inner.imageMessage) {
      content = inner.imageMessage.caption || "";
      mediaType = "image";
      mediaUrl = inner.imageMessage.url || null;
    } else if (inner.videoMessage) {
      content = inner.videoMessage.caption || "";
      mediaType = "video";
      mediaUrl = inner.videoMessage.url || null;
    } else if (inner.audioMessage) {
      mediaType = "audio";
      mediaUrl = inner.audioMessage.url || null;
    } else {
      content = "[Visualização única]";
    }
  } else {
    const msgKeys = Object.keys(msg).filter((k) => k !== "messageContextInfo" && k !== "contextInfo");
    console.warn("[WHATSAPP-PARSER] Unknown message type — keys:", msgKeys.join(", "));
    content = `[${msgKeys[0] || "mensagem"}]`;
  }

  return { content, mediaUrl, mediaType };
}

/**
 * Extract MIME type from any message type including nested ones.
 */
export function extractMimeType(msg: any): string | null {
  const viewOnceInner = msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message || {};
  const templateInner = msg.templateMessage?.hydratedTemplate || msg.templateMessage?.hydratedFourRowTemplate || {};
  const interactiveHeader = msg.interactiveMessage?.header || {};

  return msg.imageMessage?.mimetype ||
    msg.videoMessage?.mimetype ||
    msg.audioMessage?.mimetype ||
    msg.documentMessage?.mimetype ||
    msg.stickerMessage?.mimetype ||
    viewOnceInner.imageMessage?.mimetype ||
    viewOnceInner.videoMessage?.mimetype ||
    viewOnceInner.audioMessage?.mimetype ||
    templateInner.imageMessage?.mimetype ||
    templateInner.videoMessage?.mimetype ||
    templateInner.documentMessage?.mimetype ||
    interactiveHeader.imageMessage?.mimetype ||
    interactiveHeader.videoMessage?.mimetype ||
    null;
}
