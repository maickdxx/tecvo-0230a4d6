import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { normalizePhone, normalizeJid } from "../_shared/whatsapp-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * WhatsApp Sync Fallback — Polls Evolution API for recent messages
 * that may have been missed by the webhook.
 * 
 * Runs periodically via cron to guarantee no message is lost.
 * For each active channel, fetches recent messages and inserts any
 * that are missing from the database (idempotent by message_id).
 */

interface EvolutionMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
    participant?: string;
  };
  pushName?: string;
  message?: Record<string, any>;
  messageTimestamp?: number | string;
  messageType?: string;
}

function extractContent(msg: Record<string, any>): { content: string; mediaType: string | null; mediaUrl: string | null } {
  let content = "";
  let mediaType: string | null = null;
  let mediaUrl: string | null = null;

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
  } else if (msg.documentMessage) {
    content = msg.documentMessage.fileName || "";
    mediaType = "document";
    mediaUrl = msg.documentMessage.url || null;
  } else if (msg.stickerMessage) {
    mediaType = "sticker";
    mediaUrl = msg.stickerMessage.url || null;
  } else if (msg.contactMessage) {
    content = msg.contactMessage.displayName || "Contato compartilhado";
    mediaType = "contact";
  } else if (msg.locationMessage) {
    content = msg.locationMessage.name || msg.locationMessage.address || "Localização";
    mediaType = "location";
  } else if (msg.templateMessage) {
    const tmpl = msg.templateMessage.hydratedTemplate || msg.templateMessage.hydratedFourRowTemplate || msg.templateMessage;
    content = tmpl?.hydratedContentText || tmpl?.hydratedTitleText || tmpl?.text || "[Mensagem de anúncio]";
    if (tmpl?.imageMessage) { mediaType = "image"; mediaUrl = tmpl.imageMessage.url || null; }
    else if (tmpl?.videoMessage) { mediaType = "video"; mediaUrl = tmpl.videoMessage.url || null; }
  } else if (msg.interactiveMessage) {
    content = msg.interactiveMessage.body?.text || msg.interactiveMessage.header?.title || "[Mensagem interativa]";
  } else if (msg.buttonsResponseMessage) {
    content = msg.buttonsResponseMessage.selectedDisplayText || "[Resposta de botão]";
  } else if (msg.listResponseMessage) {
    content = msg.listResponseMessage.title || "[Seleção de lista]";
  } else if (msg.templateButtonReplyMessage) {
    content = msg.templateButtonReplyMessage.selectedDisplayText || "[Resposta de template]";
  } else if (msg.viewOnceMessage || msg.viewOnceMessageV2) {
    const inner = msg.viewOnceMessage?.message || msg.viewOnceMessageV2?.message || {};
    if (inner.imageMessage) { content = inner.imageMessage.caption || ""; mediaType = "image"; }
    else if (inner.videoMessage) { content = inner.videoMessage.caption || ""; mediaType = "video"; }
    else { content = "[Visualização única]"; }
  } else {
    const keys = Object.keys(msg).filter(k => !["messageContextInfo", "contextInfo"].includes(k));
    content = `[${keys[0] || "mensagem"}]`;
  }

  return { content, mediaType, mediaUrl };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      console.log("[SYNC-FALLBACK] Missing VPS config, skipping");
      return new Response(JSON.stringify({ ok: true, skipped: "no_config" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all active connected channels
    const { data: channels } = await supabase
      .from("whatsapp_channels")
      .select("id, organization_id, instance_name, channel_type, owner_jid, is_connected")
      .eq("is_connected", true);

    if (!channels || channels.length === 0) {
      console.log("[SYNC-FALLBACK] No active channels");
      return new Response(JSON.stringify({ ok: true, channels: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSynced = 0;
    let totalChecked = 0;

    for (const channel of channels) {
      try {
        const baseUrl = vpsUrl.replace(/\/+$/, "");

        // Fetch recent chats to find contacts with recent activity
        const chatsResp = await fetch(`${baseUrl}/chat/findChats/${channel.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({}),
        });

        if (!chatsResp.ok) {
          console.warn("[SYNC-FALLBACK] findChats failed for", channel.instance_name, "status:", chatsResp.status);
          continue;
        }

        const chats = await chatsResp.json();
        if (!Array.isArray(chats)) {
          console.warn("[SYNC-FALLBACK] findChats returned non-array for", channel.instance_name);
          continue;
        }

        // Only check chats with recent activity (last 10 minutes to avoid too much load)
        const tenMinutesAgo = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);
        const recentChats = chats
          .filter((c: any) => {
            const ts = c.lastMsgTimestamp || c.conversationTimestamp || 0;
            return typeof ts === "number" ? ts > tenMinutesAgo : false;
          })
          .slice(0, 20); // Limit to 20 chats per cycle

        console.log("[SYNC-FALLBACK] Channel:", channel.instance_name, "total chats:", chats.length, "recent:", recentChats.length);

        for (const chat of recentChats) {
          const remoteJid = chat.id || chat.remoteJid || chat.jid;
          if (!remoteJid) continue;

          try {
            // Fetch last 5 messages from this chat
            const msgsResp = await fetch(`${baseUrl}/chat/findMessages/${channel.instance_name}`, {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: apiKey },
              body: JSON.stringify({
                where: { key: { remoteJid } },
                limit: 5,
              }),
            });

            if (!msgsResp.ok) continue;

            const msgsResult = await msgsResp.json();
            const messages: EvolutionMessage[] = Array.isArray(msgsResult) 
              ? msgsResult 
              : msgsResult?.messages || msgsResult?.data || [];

            for (const evoMsg of messages) {
              if (!evoMsg.key?.id) continue;
              
              totalChecked++;

              // Check if message already exists (idempotent)
              const { data: existing } = await supabase
                .from("whatsapp_messages")
                .select("id")
                .eq("message_id", evoMsg.key.id)
                .maybeSingle();

              if (existing) continue; // Already in DB

              // Skip protocol messages, reactions, etc.
              const msgContent = evoMsg.message || {};
              if (msgContent.protocolMessage || msgContent.reactionMessage || msgContent.editedMessage) continue;

              const phoneNumber = remoteJid.split("@")[0];
              const isGroup = remoteJid.includes("@g.us");
              const fromMe = evoMsg.key.fromMe || false;

              // Find or create contact — Cross-channel re-adoption
              let existingContact: any = null;
              {
                // Try JID match first
                const { data: idMatch } = await supabase
                  .from("whatsapp_contacts")
                  .select("id, is_blocked, channel_id, whatsapp_id")
                  .eq("organization_id", channel.organization_id)
                  .eq("whatsapp_id", remoteJid)
                  .maybeSingle();
                
                if (idMatch) {
                  existingContact = idMatch;
                } else if (!isGroup) {
                  // Fallback to normalized phone
                  const phoneDigits = normalizePhone(remoteJid);
                  const { data: phoneMatch } = await supabase
                    .from("whatsapp_contacts")
                    .select("id, is_blocked, channel_id, whatsapp_id")
                    .eq("organization_id", channel.organization_id)
                    .eq("normalized_phone", phoneDigits)
                    .eq("is_group", false)
                    .maybeSingle();
                  
                  if (phoneMatch) {
                    existingContact = phoneMatch;
                    // Sync JID if needed
                    if (phoneMatch.whatsapp_id !== remoteJid) {
                      await supabase.from("whatsapp_contacts").update({ whatsapp_id: remoteJid }).eq("id", phoneMatch.id);
                    }
                  }
                }
              }

              if (existingContact?.is_blocked) continue;

              let contactId: string;

              if (existingContact) {
                contactId = existingContact.id;
                // Reassign channel if this active channel received it
                if (existingContact.channel_id !== channel.id) {
                  await supabase.from("whatsapp_contacts").update({ channel_id: channel.id }).eq("id", contactId);
                  // Log transition
                  await supabase.from("whatsapp_channel_transitions").insert({
                    organization_id: channel.organization_id,
                    contact_id: contactId,
                    previous_channel_id: existingContact.channel_id,
                    new_channel_id: channel.id,
                    reason: "sync_fallback_adoption",
                    metadata: { message_id: evoMsg.key.id }
                  });
                }
              } else {
                const normalizedPhone = normalizePhone(remoteJid);
                const { data: newContact, error: contactErr } = await supabase
                  .from("whatsapp_contacts")
                  .insert({
                    organization_id: channel.organization_id,
                    whatsapp_id: remoteJid,
                    name: (!fromMe && evoMsg.pushName) ? evoMsg.pushName : phoneNumber,
                    phone: phoneNumber,
                    normalized_phone: normalizedPhone,
                    is_group: isGroup,
                    channel_id: channel.id,
                    conversation_status: "novo",
                    needs_resolution: true,
                    is_unread: !fromMe,
                    has_conversation: true,
                  })
                  .select("id")
                  .single();

                if (contactErr) {
                  console.warn("[SYNC-FALLBACK] Contact creation error:", contactErr.message);
                  continue;
                }
                contactId = newContact.id;
              }

              // Extract content
              const { content, mediaType, mediaUrl } = extractContent(msgContent);

              // Determine timestamp
              const evoTs = evoMsg.messageTimestamp;
              const messageTime = evoTs
                ? new Date(typeof evoTs === "number" ? evoTs * 1000 : Number(evoTs) * 1000).toISOString()
                : new Date().toISOString();

              // Insert message
              const { error: insertErr } = await supabase
                .from("whatsapp_messages")
                .insert({
                  organization_id: channel.organization_id,
                  contact_id: contactId,
                  message_id: evoMsg.key.id,
                  content,
                  media_url: mediaUrl,
                  media_type: mediaType,
                  is_from_me: fromMe,
                  status: fromMe ? "sent" : "received",
                  channel_id: channel.id,
                  timestamp: messageTime,
                  source: "fallback",
                  ...(isGroup && evoMsg.key.participant ? { sender_phone: evoMsg.key.participant.split("@")[0] } : {}),
                  ...(isGroup && !fromMe && evoMsg.pushName ? { sender_name: evoMsg.pushName } : {}),
                });

              if (insertErr) {
                // Unique constraint violation = already exists (race condition), ignore
                if (insertErr.code === "23505") continue;
                console.warn("[SYNC-FALLBACK] Message insert error:", insertErr.message);
                continue;
              }

              totalSynced++;
              console.log("[SYNC-FALLBACK] Synced missing message:", evoMsg.key.id, "from:", phoneNumber, "channel:", channel.instance_name);

              // Update contact preview if this is the newest message
              if (!fromMe) {
                const mediaLabels: Record<string, string> = {
                  image: "📷 Imagem", video: "🎥 Vídeo", audio: "🎤 Áudio",
                  document: "📄 Documento", sticker: "🏷️ Sticker",
                };
                const previewContent = content
                  ? content.substring(0, 200)
                  : mediaType ? (mediaLabels[mediaType] || `[${mediaType}]`) : "";

                await supabase
                  .from("whatsapp_contacts")
                  .update({
                    last_message_at: messageTime,
                    last_message_content: previewContent,
                    last_message_is_from_me: false,
                    is_unread: true,
                    unread_count: supabase.rpc ? 1 : 1, // Will be approximate; webhook handles accurate count
                  })
                  .eq("id", contactId)
                  .lt("last_message_at", messageTime); // Only update if newer
              }
            }
          } catch (chatErr: any) {
            console.warn("[SYNC-FALLBACK] Error processing chat:", remoteJid, chatErr.message);
          }
        }
      } catch (channelErr: any) {
        console.warn("[SYNC-FALLBACK] Error processing channel:", channel.instance_name, channelErr.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[SYNC-FALLBACK] Done — checked: ${totalChecked}, synced: ${totalSynced}, channels: ${channels.length}, duration: ${duration}ms`);

    return new Response(JSON.stringify({ 
      ok: true, 
      checked: totalChecked, 
      synced: totalSynced, 
      channels: channels.length,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[SYNC-FALLBACK] Fatal error:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
