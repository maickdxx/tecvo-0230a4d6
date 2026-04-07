import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "npm:zod@3.25.76";
import { sendOfficialServicePdf } from "../_shared/sendOfficialServicePdf.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  serviceId: z.string().uuid(),
  target: z.enum(["self", "client"]).optional().default("client"),
  clientPhone: z.string().min(8).optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  channelId: z.string().uuid().optional().nullable(),
});

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

    const rawBody = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
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

    if (!profile?.organization_id) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { serviceId, target, clientPhone, contactId, channelId } = parsed.data;

    const { data: serviceData, error: serviceError } = await supabase
      .from("services")
      .select("*, client:clients(name, phone, whatsapp)")
      .eq("id", serviceId)
      .eq("organization_id", profile.organization_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (serviceError || !serviceData) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (clientPhone && !serviceData.client?.phone && !serviceData.client?.whatsapp) {
      serviceData.client = {
        ...(serviceData.client || {}),
        phone: clientPhone,
      };
    }

    const result = await sendOfficialServicePdf({
      supabase,
      organizationId: profile.organization_id,
      serviceData,
      target,
      sentVia: "manual_panel",
      channelSource: "app",
      contextChannelId: channelId || null,
      contextContactId: target === "self" ? (contactId || null) : null,
      explicitTargetContactId: target === "client" ? (contactId || null) : null,
      fallbackClientPhone: clientPhone || null,
    });

    if (!result.ok) {
      const statusCode = result.errorCode === "rate_limited"
        ? 429
        : result.errorCode === "channel_disconnected" || result.errorCode === "channel_unavailable"
          ? 400
          : 422;

      return new Response(JSON.stringify({
        error: result.errorCode || "send_failed",
        message: result.error,
      }), {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      message_id: result.messageId,
      os_number: result.osNumber,
      storage_path: result.storagePath,
      channel_id: result.channelId,
      contact_id: result.contactId,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[SEND-SERVICE-PDF] Error:", error?.message || error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
