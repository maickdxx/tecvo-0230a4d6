/**
 * ── SEND FLOW: ORG_AUTOMATION (Reminder) ──
 * Sends a reminder message to a client by phone number.
 * Respects channel isolation: uses existing contact's channel or requires explicit channel_id.
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
    const { phone, message, client_name, channel_id: requestedChannelId } = await req.json();

    if (!phone || !message) {
      return new Response(JSON.stringify({ error: "Missing phone or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      return new Response(JSON.stringify({ error: "invalid_phone", message: "Número de telefone inválido." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all connected CUSTOMER_INBOX channels for this org
    const { data: connectedChannels } = await supabase
      .from("whatsapp_channels")
      .select("id, instance_name, phone_number, is_connected, channel_status, name")
      .eq("organization_id", orgId)
      .eq("is_connected", true)
      .eq("channel_status", "connected")
      .in("channel_type", ["CUSTOMER_INBOX", "customer_inbox"]);

    if (!connectedChannels || connectedChannels.length === 0) {
      return new Response(JSON.stringify({
        error: "no_channel",
        message: "Nenhum canal WhatsApp conectado. Conecte um número para enviar lembretes.",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Try to find existing contact by phone across all channels
    const phoneSuffix = normalizedPhone.slice(-8);
    const { data: existingContacts } = await supabase
      .from("whatsapp_contacts")
      .select("id, phone, normalized_phone, whatsapp_id, channel_id")
      .eq("organization_id", orgId)
      .or(`normalized_phone.like.%${phoneSuffix},phone.like.%${phoneSuffix}`);

    let contactId: string | null = null;
    let activeChannel: typeof connectedChannels[0] | null = null;

    if (existingContacts && existingContacts.length > 0) {
      // Prefer contact on a connected channel
      for (const c of existingContacts) {
        const ch = connectedChannels.find(ch => ch.id === c.channel_id);
        if (ch) {
          contactId = c.id;
          activeChannel = ch;
          break;
        }
      }
      // If no contact on a connected channel, we still have the contact but need a channel
      if (!contactId && existingContacts.length > 0) {
        contactId = existingContacts[0].id;
      }
    }

    // If no channel resolved from contact, use requested channel_id or pick the single available one
    if (!activeChannel) {
      if (requestedChannelId) {
        activeChannel = connectedChannels.find(ch => ch.id === requestedChannelId) || null;
      }
      if (!activeChannel) {
        if (connectedChannels.length === 1) {
          activeChannel = connectedChannels[0];
        } else {
          // Multiple channels, no contact found, no channel specified — return channels for user to pick
          return new Response(JSON.stringify({
            error: "choose_channel",
            message: "Selecione o canal para enviar o lembrete.",
            channels: connectedChannels.map(ch => ({ id: ch.id, name: ch.name, phone_number: ch.phone_number })),
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Create contact if none found
    if (!contactId) {
      const whatsappId = `${normalizedPhone}@s.whatsapp.net`;
      const { data: newContact, error: createErr } = await supabase
        .from("whatsapp_contacts")
        .insert({
          organization_id: orgId,
          channel_id: activeChannel.id,
          phone: normalizedPhone,
          normalized_phone: normalizedPhone,
          whatsapp_id: whatsappId,
          name: client_name || normalizedPhone,
          source: "manual",
          conversation_status: "atendendo",
        })
        .select("id")
        .single();

      if (createErr || !newContact) {
        console.error("[REMINDER-SEND] Failed to create contact:", createErr);
        return new Response(JSON.stringify({ error: "Failed to create contact" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      contactId = newContact.id;
    }

    // Send guard
    const guard = await checkSendLimit(supabase, orgId, contactId, "reminder");
    if (!guard.allowed) {
      return new Response(JSON.stringify({ error: "Send blocked", reason: guard.reason, detail: guard.detail }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via Evolution API
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientJid = `${normalizedPhone}@s.whatsapp.net`;
    console.log("[REMINDER-SEND] Sending to:", recipientJid, "via:", activeChannel.instance_name, "channel:", activeChannel.name);

    const evoResponse = await fetch(`${vpsUrl}/message/sendText/${activeChannel.instance_name}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({ number: recipientJid, text: message }),
    });

    if (!evoResponse.ok) {
      const errText = await evoResponse.text();
      console.error("[REMINDER-SEND] Evolution API error:", evoResponse.status, errText);

      const classified = classifyEvoError(evoResponse.status, errText, activeChannel.phone_number || undefined);

      if (classified.isDisconnection) {
        await supabase
          .from("whatsapp_channels")
          .update({
            is_connected: false,
            channel_status: "disconnected",
            disconnected_reason: classified.technicalReason.substring(0, 200),
          })
          .eq("id", activeChannel.id);
      }

      return new Response(JSON.stringify({
        error: classified.domainError,
        message: classified.userMessage,
      }), {
        status: classified.domainError === "rate_limited" ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const evoData = await evoResponse.json();
    const realMessageId = evoData?.key?.id || `reminder_${crypto.randomUUID()}`;

    // Save message
    await supabase.from("whatsapp_messages").insert({
      organization_id: orgId,
      contact_id: contactId,
      message_id: realMessageId,
      content: message,
      is_from_me: true,
      status: "sent",
      channel_id: activeChannel.id,
      timestamp: new Date().toISOString(),
    });

    // Update contact
    await supabase
      .from("whatsapp_contacts")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_content: message.substring(0, 200),
        last_message_is_from_me: true,
      })
      .eq("id", contactId);

    console.log("[REMINDER-SEND] Reminder sent successfully via", activeChannel.name, ":", realMessageId);

    return new Response(JSON.stringify({ ok: true, message_id: realMessageId, channel_name: activeChannel.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[REMINDER-SEND] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
