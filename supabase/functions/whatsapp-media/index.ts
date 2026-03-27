import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { classifyEvoError } from "../_shared/evoErrorClassifier.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(input: string): string {
  const beforeAt = input.split("@")[0];
  return beforeAt.replace(/\D/g, "");
}

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

    const formData = await req.formData();
    const channelId = formData.get("channel_id") as string;
    const contactId = formData.get("contact_id") as string;
    const mediaType = formData.get("media_type") as string; // image, document, audio
    const caption = (formData.get("caption") as string) || "";
    const file = formData.get("file") as File;

    if (!channelId || !contactId || !mediaType || !file) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch channel
    const orgId = profile.organization_id;
    const { data: channel } = await supabase
      .from("whatsapp_channels")
      .select("id, instance_name, organization_id, is_connected, channel_status, phone_number")
      .eq("id", channelId)
      .eq("organization_id", orgId)
      .single();

    if (!channel) {
      return new Response(JSON.stringify({ error: "Channel not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTO-FALLBACK for disconnected channels ──
    let activeChannel = channel;
    let didFallback = false;

    if (!channel.is_connected || !channel.instance_name || channel.channel_status !== "connected") {
      console.warn(`[WHATSAPP-MEDIA] Channel ${channel.id} disconnected. Searching fallback...`);
      const { data: fallbackChannel } = await supabase
        .from("whatsapp_channels")
        .select("id, instance_name, organization_id, is_connected, channel_status, phone_number")
        .eq("organization_id", orgId)
        .eq("channel_type", "CUSTOMER_INBOX")
        .eq("is_connected", true)
        .eq("channel_status", "connected")
        .neq("id", channel.id)
        .limit(1)
        .maybeSingle();

      if (fallbackChannel?.instance_name) {
        activeChannel = fallbackChannel;
        didFallback = true;
        await supabase.from("whatsapp_contacts").update({ channel_id: fallbackChannel.id }).eq("id", contactId);
        await supabase.from("whatsapp_channel_transitions").insert({
          organization_id: orgId, contact_id: contactId,
          previous_channel_id: channel.id, new_channel_id: fallbackChannel.id,
          reason: "media_send_fallback",
        });
        console.info(`[WHATSAPP-MEDIA] Fallback to ${fallbackChannel.id} (${fallbackChannel.instance_name})`);
      } else {
        return new Response(JSON.stringify({
          error: "channel_disconnected",
          message: "Nenhum canal ativo disponível. Reconecte nas configurações.",
        }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Fetch contact
    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("id, phone, whatsapp_id, normalized_phone")
      .eq("id", contactId)
      .eq("organization_id", profile.organization_id)
      .single();

    if (!contact) {
      return new Response(JSON.stringify({ error: "Contact not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const digits = contact.normalized_phone || normalizePhone(contact.phone || contact.whatsapp_id || "");
    if (!digits) {
      return new Response(JSON.stringify({ error: "Cannot resolve phone number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipientJid = `${digits}@s.whatsapp.net`;
    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ error: "WhatsApp API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload file to Supabase storage first to get a public URL
    const fileExt = file.name.split(".").pop() || "bin";
    const storagePath = `${profile.organization_id}/${crypto.randomUUID()}.${fileExt}`;
    const fileBuffer = await file.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("whatsapp-media")
      .upload(storagePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[WHATSAPP-MEDIA] Upload error:", uploadError);
      return new Response(JSON.stringify({ error: "Failed to upload file" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: publicUrlData } = supabase.storage
      .from("whatsapp-media")
      .getPublicUrl(storagePath);

    const mediaUrl = publicUrlData.publicUrl;
    console.log("[WHATSAPP-MEDIA] Uploaded to:", mediaUrl);

    // Send via Evolution API
    let evoEndpoint: string;
    let evoBody: any;

    if (mediaType === "audio") {
      // Use sendWhatsAppAudio for audio files
      evoEndpoint = `${vpsUrl}/message/sendWhatsAppAudio/${channel.instance_name}`;
      evoBody = {
        number: recipientJid,
        audio: mediaUrl,
      };
    } else {
      // Use sendMedia for image, video, document
      evoEndpoint = `${vpsUrl}/message/sendMedia/${channel.instance_name}`;
      evoBody = {
        number: recipientJid,
        mediatype: mediaType === "image" ? "image" : mediaType === "video" ? "video" : "document",
        media: mediaUrl,
        caption: caption || undefined,
        fileName: mediaType === "document" ? file.name : undefined,
      };
    }

    console.log("[WHATSAPP-MEDIA] Sending to:", evoEndpoint);

    const evoResponse = await fetch(evoEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify(evoBody),
    });

    if (!evoResponse.ok) {
      const errText = await evoResponse.text();
      console.error("[WHATSAPP-MEDIA] Evolution API error:", evoResponse.status, errText);

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

        console.warn("[WHATSAPP-MEDIA] Channel auto-disconnected:", channel.id);

        return new Response(JSON.stringify({
          error: "channel_disconnected",
          message: classified.userMessage,
          channel_id: channel.id,
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        error: classified.domainError,
        message: classified.userMessage,
        details: classified.technicalReason,
      }), {
        status: classified.domainError === "rate_limited" ? 429 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse Evolution response to get real WhatsApp message ID
    const evoData = await evoResponse.json();
    const fallbackMessageId = `out_${crypto.randomUUID()}`;
    const realMessageId = evoData?.key?.id || fallbackMessageId;
    console.log("[WHATSAPP-MEDIA] Evolution response key.id:", realMessageId);

    // Save outbound message with real WhatsApp message ID
    await supabase.from("whatsapp_messages").insert({
      organization_id: profile.organization_id,
      contact_id: contact.id,
      message_id: realMessageId,
      content: caption || "",
      media_url: mediaUrl,
      media_type: mediaType,
      is_from_me: true,
      status: "sent",
      channel_id: channel.id,
    });

    await supabase
      .from("whatsapp_contacts")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", contact.id);

    console.log("[WHATSAPP-MEDIA] Media sent and saved successfully");

    return new Response(JSON.stringify({ ok: true, message_id: realMessageId, media_url: mediaUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[WHATSAPP-MEDIA] Error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
