/**
 * ── SEND FLOW: CUSTOMER_CONVERSATION ──
 * Sends media (images, audio, documents, video) within customer conversations.
 * STRICT channel isolation: uses ONLY the contact's bound channel.
 * NO fallback to any other channel or instance. Disconnected channel → BLOCK.
 * 
 * Now delegates to the shared sendWhatsAppDocument pipeline for consistency.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { sendWhatsAppDocument } from "../_shared/sendWhatsAppDocument.ts";

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

    const formData = await req.formData();
    const channelId = formData.get("channel_id") as string;
    const contactId = formData.get("contact_id") as string;
    const mediaType = formData.get("media_type") as string;
    const caption = (formData.get("caption") as string) || "";
    const file = formData.get("file") as File;

    if (!channelId || !contactId || !mediaType || !file) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Upload file to Supabase storage first to get a public URL
    const orgId = profile.organization_id;
    const fileExt = file.name.split(".").pop() || "bin";
    const storagePath = `${orgId}/${crypto.randomUUID()}.${fileExt}`;
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

    // ── UNIFIED PIPELINE: Delegate to shared sendWhatsAppDocument ──
    const result = await sendWhatsAppDocument({
      supabase,
      organizationId: orgId,
      channelId,
      contactId,
      mediaUrl,
      mediaType: mediaType as "image" | "audio" | "document" | "video",
      caption: caption || undefined,
      fileName: file.name,
      sentVia: "manual_inbox",
    });

    if (!result.ok) {
      const statusCode = result.errorCode === "channel_disconnected" ? 400
        : result.errorCode === "rate_limited" ? 429
        : 502;

      return new Response(JSON.stringify({
        error: result.errorCode || "send_failed",
        message: result.error,
        ...(result.channelDisconnected ? { channel_id: channelId } : {}),
      }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[WHATSAPP-MEDIA] Media sent and saved successfully via unified pipeline");

    return new Response(JSON.stringify({
      ok: true,
      message_id: result.messageId,
      media_url: mediaUrl,
    }), {
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
