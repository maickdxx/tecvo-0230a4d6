import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * WhatsApp Deep Sync — Imports ALL historical messages from a connected channel
 * via Evolution API. Idempotent by message_id.
 * 
 * Body: { channel_id: string, max_chats?: number, max_messages_per_chat?: number }
 */

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();
    if (!profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = profile.organization_id;
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { channel_id, max_chats = 500, max_messages_per_chat = 100 } = body;

    if (!channel_id) {
      return new Response(JSON.stringify({ error: "channel_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get channel info
    const { data: channel } = await supabase
      .from("whatsapp_channels")
      .select("id, instance_name, organization_id, is_connected")
      .eq("id", channel_id)
      .eq("organization_id", orgId)
      .single();

    if (!channel || !channel.instance_name) {
      return new Response(JSON.stringify({ error: "Channel not found or no instance" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!channel.is_connected) {
      return new Response(JSON.stringify({ error: "Channel is not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = vpsUrl.replace(/\/+$/, "");

    // Fetch ALL chats
    console.log(`[DEEP-SYNC] Starting for channel ${channel.instance_name} (${channel_id})`);

    const chatsResp = await fetch(`${baseUrl}/chat/findChats/${channel.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({}),
    });

    if (!chatsResp.ok) {
      return new Response(JSON.stringify({ error: `findChats failed: ${chatsResp.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chats = await chatsResp.json();
    if (!Array.isArray(chats)) {
      return new Response(JSON.stringify({ error: "findChats returned non-array" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sort by most recent activity and limit
    const sortedChats = chats
      .filter((c: any) => {
        const jid = c.id || c.remoteJid || c.jid || "";
        return jid && !jid.startsWith("status@") && !jid.endsWith("@newsletter");
      })
      .sort((a: any, b: any) => {
        const tsA = a.lastMsgTimestamp || a.conversationTimestamp || 0;
        const tsB = b.lastMsgTimestamp || b.conversationTimestamp || 0;
        return tsB - tsA;
      })
      .slice(0, max_chats);

    console.log(`[DEEP-SYNC] Total chats: ${chats.length}, processing: ${sortedChats.length}`);

    let totalSynced = 0;
    let totalSkipped = 0;
    let totalContacts = 0;
    let totalChatsProcessed = 0;

    for (const chat of sortedChats) {
      const remoteJid = chat.id || chat.remoteJid || chat.jid;
      if (!remoteJid) continue;

      totalChatsProcessed++;

      try {
        // Fetch messages for this chat
        const msgsResp = await fetch(`${baseUrl}/chat/findMessages/${channel.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            where: { key: { remoteJid } },
            limit: max_messages_per_chat,
          }),
        });

        if (!msgsResp.ok) continue;

        const msgsResult = await msgsResp.json();
        
        // Evolution API may return messages in various formats
        let messages: any[];
        if (Array.isArray(msgsResult)) {
          messages = msgsResult;
        } else if (msgsResult?.messages && Array.isArray(msgsResult.messages)) {
          messages = msgsResult.messages;
        } else if (msgsResult?.data && Array.isArray(msgsResult.data)) {
          messages = msgsResult.data;
        } else if (msgsResult?.messages?.records && Array.isArray(msgsResult.messages.records)) {
          messages = msgsResult.messages.records;
        } else if (typeof msgsResult === "object" && msgsResult !== null) {
          // Try to find any array property
          const arrayProp = Object.values(msgsResult).find(v => Array.isArray(v));
          messages = Array.isArray(arrayProp) ? arrayProp as any[] : [];
          if (messages.length === 0 && totalChatsProcessed <= 3) {
            console.log(`[DEEP-SYNC] Unknown format for ${remoteJid}, keys: ${Object.keys(msgsResult).join(",")}, type: ${typeof msgsResult}`);
          }
        } else {
          messages = [];
        }

        if (!Array.isArray(messages) || messages.length === 0) continue;

        const phoneNumber = remoteJid.split("@")[0];
        const isGroup = remoteJid.includes("@g.us");
        const normalizedPhone = phoneNumber.replace(/\D/g, "");

        // Find or create contact — ALWAYS scoped to this channel
        let contactId: string;
        const { data: existingContact } = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("organization_id", orgId)
          .eq("channel_id", channel_id)
          .eq("whatsapp_id", remoteJid)
          .maybeSingle();

        if (existingContact) {
          contactId = existingContact.id;
        } else {
          // Get name from first non-fromMe message
          const firstIncoming = messages.find((m: any) => !m.key?.fromMe);
          const contactName = firstIncoming?.pushName || chat.name || phoneNumber;

          const { data: newContact, error: contactErr } = await supabase
            .from("whatsapp_contacts")
            .insert({
              organization_id: orgId,
              whatsapp_id: remoteJid,
              name: contactName,
              phone: phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`,
              normalized_phone: normalizedPhone,
              is_group: isGroup,
              channel_id: channel_id,
              conversation_status: "novo",
              needs_resolution: false,
              is_unread: false,
              has_conversation: true,
              source: "deep_sync",
            })
            .select("id")
            .single();

          if (contactErr) {
            // Unique constraint = contact already exists with different lookup
            if (contactErr.code === "23505") {
              // Try to find by normalized_phone
              const { data: byPhone } = await supabase
                .from("whatsapp_contacts")
                .select("id")
                .eq("organization_id", orgId)
                .eq("channel_id", channel_id)
                .eq("normalized_phone", normalizedPhone)
                .maybeSingle();
              if (byPhone) {
                contactId = byPhone.id;
                // Update whatsapp_id
                await supabase
                  .from("whatsapp_contacts")
                  .update({ whatsapp_id: remoteJid })
                  .eq("id", byPhone.id);
              } else {
                console.warn(`[DEEP-SYNC] Contact creation failed for ${remoteJid}:`, contactErr.message);
                continue;
              }
            } else {
              console.warn(`[DEEP-SYNC] Contact creation failed for ${remoteJid}:`, contactErr.message);
              continue;
            }
          } else {
            contactId = newContact.id;
          }
          totalContacts++;
        }

        // Ensure has_conversation is true
        await supabase
          .from("whatsapp_contacts")
          .update({ has_conversation: true })
          .eq("id", contactId)
          .eq("has_conversation", false);

        // Insert messages (idempotent by message_id)
        let latestTs: string | null = null;
        let latestContent: string | null = null;
        let latestFromMe = false;

        for (const evoMsg of messages) {
          if (!evoMsg.key?.id) continue;

          const msgContent = evoMsg.message || {};
          if (msgContent.protocolMessage || msgContent.reactionMessage || msgContent.editedMessage) {
            totalSkipped++;
            continue;
          }

          const fromMe = evoMsg.key.fromMe || false;
          const { content, mediaType, mediaUrl } = extractContent(msgContent);

          const evoTs = evoMsg.messageTimestamp;
          const messageTime = evoTs
            ? new Date(typeof evoTs === "number" ? evoTs * 1000 : Number(evoTs) * 1000).toISOString()
            : new Date().toISOString();

          const { error: insertErr } = await supabase
            .from("whatsapp_messages")
            .insert({
              organization_id: orgId,
              contact_id: contactId,
              message_id: evoMsg.key.id,
              content,
              media_url: mediaUrl,
              media_type: mediaType,
              is_from_me: fromMe,
              status: fromMe ? "sent" : "received",
              channel_id: channel_id,
              timestamp: messageTime,
              source: "deep_sync",
              ...(isGroup && evoMsg.key.participant ? { sender_phone: evoMsg.key.participant.split("@")[0] } : {}),
              ...(isGroup && !fromMe && evoMsg.pushName ? { sender_name: evoMsg.pushName } : {}),
            });

          if (insertErr) {
            if (insertErr.code === "23505") {
              totalSkipped++;
              continue;
            }
            console.warn(`[DEEP-SYNC] Message insert error for ${evoMsg.key.id}:`, insertErr.message);
            continue;
          }

          totalSynced++;

          // Track latest message for contact preview
          if (!latestTs || messageTime > latestTs) {
            latestTs = messageTime;
            latestFromMe = fromMe;
            const mediaLabels: Record<string, string> = {
              image: "📷 Imagem", video: "🎥 Vídeo", audio: "🎤 Áudio",
              document: "📄 Documento", sticker: "🏷️ Sticker",
            };
            latestContent = content
              ? content.substring(0, 200)
              : mediaType ? (mediaLabels[mediaType] || `[${mediaType}]`) : "";
          }
        }

        // Update contact preview with latest message
        if (latestTs && latestContent !== null) {
          await supabase
            .from("whatsapp_contacts")
            .update({
              last_message_at: latestTs,
              last_message_content: latestContent,
              last_message_is_from_me: latestFromMe,
            })
            .eq("id", contactId)
            .lt("last_message_at", latestTs);
        }

        // Log progress every 50 chats
        if (totalChatsProcessed % 50 === 0) {
          console.log(`[DEEP-SYNC] Progress: ${totalChatsProcessed}/${sortedChats.length} chats, ${totalSynced} synced, ${totalContacts} new contacts`);
        }
      } catch (chatErr: any) {
        console.warn(`[DEEP-SYNC] Error processing chat ${remoteJid}:`, chatErr.message);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[DEEP-SYNC] Complete — chats: ${totalChatsProcessed}, synced: ${totalSynced}, skipped: ${totalSkipped}, new contacts: ${totalContacts}, duration: ${duration}ms`);

    return new Response(JSON.stringify({
      ok: true,
      chats_processed: totalChatsProcessed,
      messages_synced: totalSynced,
      messages_skipped: totalSkipped,
      new_contacts: totalContacts,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[DEEP-SYNC] Fatal error:", error.message);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
