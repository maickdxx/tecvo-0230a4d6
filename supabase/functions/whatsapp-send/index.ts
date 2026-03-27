/**
 * ── SEND FLOW: CUSTOMER_CONVERSATION ──
 * Manual chat messages sent by an agent to a customer.
 * STRICT channel isolation: uses ONLY the channel bound to the contact/conversation.
 * NO fallback to any other channel or instance. Disconnected channel → BLOCK.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { normalizePhone } from "../_shared/whatsapp-utils.ts";
import { classifyEvoError } from "../_shared/evoErrorClassifier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// normalizePhone imported from shared utils

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's organization
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

    const { channel_id, contact_id, message, reply_context } = await req.json();

    if (!contact_id || !message) {
      return new Response(JSON.stringify({ error: "Missing contact_id or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = profile.organization_id;

    // ── Strict channel resolution ──
    // Each conversation is bound to its channel (the phone number that handled it).
    // We NEVER fallback to a random connected channel — that would change the sender identity.
    //
    // Resolution order:
    // 1. Use channel_id from request (frontend sends the contact's channel_id)
    // 2. If not provided, look up the contact's channel_id from DB
    // No generic fallback — if the correct channel isn't connected, return error.

    // Step 1: Determine which channel this contact belongs to
    let targetChannelId = channel_id || null;

    if (!targetChannelId) {
      const { data: contactData } = await supabase
        .from("whatsapp_contacts")
        .select("channel_id")
        .eq("id", contact_id)
        .eq("organization_id", orgId)
        .single();
      targetChannelId = contactData?.channel_id || null;
    }

    if (!targetChannelId) {
      return new Response(JSON.stringify({
        error: "channel_not_linked",
        message: "Este contato não está vinculado a nenhum canal. Reconecte o número correspondente.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Verify the channel exists, belongs to this org, and is connected
    const { data: channel } = await supabase
      .from("whatsapp_channels")
      .select("id, instance_name, organization_id, is_connected, channel_status, phone_number")
      .eq("id", targetChannelId)
      .eq("organization_id", orgId)
      .single();

    if (!channel) {
      return new Response(JSON.stringify({
        error: "channel_not_found",
        message: "O canal vinculado a esta conversa não foi encontrado.",
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── STRICT CHANNEL POLICY: No fallback between channels ──
    // Each conversation thread is bound to its channel (phone number).
    // Sending via a different channel would change the sender identity — never allowed.
    const activeChannel = channel;

    if (!channel.is_connected || !channel.instance_name || channel.channel_status !== "connected") {
      const phoneLabel = channel.phone_number || "desconhecido";
      console.warn(`[WHATSAPP-SEND] Channel ${channel.id} is disconnected (status: ${channel.channel_status}). Blocking send — no fallback.`);
      return new Response(JSON.stringify({
        error: "channel_disconnected",
        message: `O número ${phoneLabel} não está conectado. Reconecte este canal para enviar mensagens.`,
        phone_number: channel.phone_number,
        channel_id: channel.id,
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch contact by org
    let { data: contact, error: contactErr } = await supabase
      .from("whatsapp_contacts")
      .select("id, phone, whatsapp_id, normalized_phone, organization_id, source")
      .eq("id", contact_id)
      .eq("organization_id", orgId)
      .single();

    if (!contact) {
      console.error("[WHATSAPP-SEND] Contact not found — contact_id:", contact_id, "org:", orgId);
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fallbackMessageId = `out_${crypto.randomUUID()}`;

    // ── SEND GUARD: check rate limits and kill switch ──
    const guard = await checkSendLimit(supabase, orgId, contact.id, "manual");
    if (!guard.allowed) {
      return new Response(JSON.stringify({ error: "Send blocked", reason: guard.reason, detail: guard.detail }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── WEBCHAT contacts: save directly to DB, no WhatsApp API call ──
    const isWebchat = contact.source === "webchat" || (contact.whatsapp_id || "").startsWith("webchat-");

    if (isWebchat) {
      console.log("[WHATSAPP-SEND] Webchat contact detected, saving reply directly to DB");

      const webchatInsert: Record<string, any> = {
        organization_id: orgId,
        contact_id: contact.id,
        message_id: fallbackMessageId,
        content: message,
        is_from_me: true,
        status: "sent",
        channel_id: activeChannel.id,
        timestamp: new Date().toISOString(),
      };
      if (reply_context) {
        webchatInsert.reply_to_id = reply_context.reply_to_id || null;
        webchatInsert.reply_to_message_id = reply_context.reply_to_message_id || null;
        webchatInsert.reply_to_content = reply_context.reply_to_content || null;
        webchatInsert.reply_to_sender = reply_context.reply_to_sender || null;
      }
      await supabase.from("whatsapp_messages").insert(webchatInsert);

      // Fetch current status to avoid overwriting "resolvido"
      const { data: currentContactData } = await supabase
        .from("whatsapp_contacts")
        .select("conversation_status")
        .eq("id", contact.id)
        .single();
      const currentStatus = currentContactData?.conversation_status || "novo";
      const contactUpdate: Record<string, any> = {
        last_message_at: new Date().toISOString(),
        last_message_content: message.substring(0, 200),
        last_message_is_from_me: true,
      };
      // Agent sending message: always set to atendendo (reopens finalized too)
      if (currentStatus !== "atendendo") {
        contactUpdate.conversation_status = "atendendo";
      }
      await supabase
        .from("whatsapp_contacts")
        .update(contactUpdate)
        .eq("id", contact.id);

      console.log("[WHATSAPP-SEND] Webchat reply saved successfully");

      return new Response(JSON.stringify({ ok: true, message_id: fallbackMessageId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── WhatsApp contacts: send via Evolution API ──
    // Detect if this is a group contact by checking the original whatsapp_id
    const isGroup = (contact.whatsapp_id || "").includes("@g.us");
    
    let recipientJid: string;
    if (isGroup) {
      // For groups, use the original group JID as-is
      const groupId = (contact.whatsapp_id || "").split("@")[0];
      if (!groupId) {
        return new Response(JSON.stringify({ error: "Cannot resolve group JID for contact" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientJid = `${groupId}@g.us`;
    } else {
      const digits = contact.normalized_phone || normalizePhone(contact.phone || contact.whatsapp_id || "");
      if (!digits) {
        return new Response(JSON.stringify({ error: "Cannot resolve phone number for contact" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      recipientJid = `${digits}@s.whatsapp.net`;
    }
    console.log("[WHATSAPP-SEND] Sending to:", recipientJid, "via instance:", activeChannel.instance_name);

    // Send via Evolution API
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build Evolution API body with optional quoted message
    const evoBody: Record<string, any> = {
      number: recipientJid,
      text: message,
    };
    
    // If replying, add quoted message context for Evolution API
    if (reply_context?.reply_to_message_id) {
      evoBody.quoted = {
        key: {
          remoteJid: recipientJid,
          fromMe: false, // Will be overridden if we can detect
          id: reply_context.reply_to_message_id,
        },
        message: {
          conversation: reply_context.reply_to_content || "",
        },
      };
      console.log("[WHATSAPP-SEND] Sending with quoted message:", reply_context.reply_to_message_id);
    }

    const evoResponse = await fetch(`${vpsUrl}/message/sendText/${activeChannel.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(evoBody),
    });

    if (!evoResponse.ok) {
      const errText = await evoResponse.text();
      console.error("[WHATSAPP-SEND] Evolution API error:", evoResponse.status, errText);

      // Classify the error using centralized classifier
      const classified = classifyEvoError(evoResponse.status, errText, activeChannel.phone_number || undefined);
      console.warn(`[WHATSAPP-SEND] Classified error: ${classified.domainError} — ${classified.technicalReason}`);

      // Log channel status transition for audit
      const logTransition = async (newStatus: string, reason: string) => {
        try {
          await supabase.from("whatsapp_channel_transitions").insert({
            organization_id: orgId,
            contact_id: contact.id,
            previous_channel_id: activeChannel.id,
            new_channel_id: activeChannel.id,
            reason: `auto_disconnect:${reason}`,
          });
        } catch (_e) { /* best effort */ }
      };

      if (classified.isDisconnection) {
        // Auto-update channel status so UI reflects reality
        await supabase
          .from("whatsapp_channels")
          .update({
            is_connected: false,
            channel_status: "disconnected",
            disconnected_reason: classified.technicalReason.substring(0, 200),
          })
          .eq("id", activeChannel.id);

        await logTransition("disconnected", classified.technicalReason.substring(0, 100));
        console.warn("[WHATSAPP-SEND] Channel auto-disconnected:", activeChannel.id, classified.domainError);

        return new Response(JSON.stringify({
          error: "channel_disconnected",
          message: classified.userMessage,
          phone_number: activeChannel.phone_number,
          channel_id: activeChannel.id,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Non-disconnection errors: return specific domain error
      return new Response(JSON.stringify({
        error: classified.domainError,
        message: classified.userMessage,
        details: classified.technicalReason,
      }), {
        status: classified.domainError === "rate_limited" ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse the Evolution API response to extract the real WhatsApp message ID
    const evoData = await evoResponse.json();
    // Evolution API returns { key: { remoteJid, fromMe, id }, message: {...}, ... }
    const realMessageId = evoData?.key?.id || fallbackMessageId;
    console.log("[WHATSAPP-SEND] Evolution response key.id:", realMessageId, "fallback:", fallbackMessageId);

    // Save outbound message with the REAL WhatsApp message ID
    const sentTimestamp = new Date().toISOString();
    const msgInsert: Record<string, any> = {
      organization_id: orgId,
      contact_id: contact.id,
      message_id: realMessageId,
      content: message,
      is_from_me: true,
      status: "sent",
      channel_id: activeChannel.id,
      timestamp: sentTimestamp,
    };
    if (reply_context) {
      msgInsert.reply_to_id = reply_context.reply_to_id || null;
      msgInsert.reply_to_message_id = reply_context.reply_to_message_id || null;
      msgInsert.reply_to_content = reply_context.reply_to_content || null;
      msgInsert.reply_to_sender = reply_context.reply_to_sender || null;
    }
    await supabase.from("whatsapp_messages").insert(msgInsert);

    // Fetch current status to avoid overwriting "resolvido"
    const { data: currentContactData2 } = await supabase
      .from("whatsapp_contacts")
      .select("conversation_status")
      .eq("id", contact.id)
      .single();
    const currentStatus2 = currentContactData2?.conversation_status || "novo";
    const contactUpdate2: Record<string, any> = {
      last_message_at: new Date().toISOString(),
      last_message_content: message.substring(0, 200),
      last_message_is_from_me: true,
    };
    // Agent sending message: set to atendendo if not already
    if (currentStatus2 !== "atendendo") {
      contactUpdate2.conversation_status = "atendendo";
    }
    await supabase
      .from("whatsapp_contacts")
      .update(contactUpdate2)
      .eq("id", contact.id);

    console.log("[WHATSAPP-SEND] Message sent and saved successfully with real ID:", realMessageId);

    // Return the real message ID so the frontend optimistic update can match it
    return new Response(JSON.stringify({ ok: true, message_id: realMessageId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WHATSAPP-SEND] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
