/**
 * ── SEND FLOW: INTERNAL_TEST ──
 * ⚠️  This function is for INTERNAL TESTING ONLY.
 * It simulates a service completion notification to validate the portal link flow.
 * It is NOT a production send path and must NEVER be used for real customer conversations.
 * The channel resolution here is flexible (picks any connected channel) because
 * this is a test utility — production flows use strict channel isolation instead.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsApp(phone: string, text: string, instanceName: string) {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) throw new Error("WhatsApp VPS not configured");

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  const res = await fetch(`${vpsUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: jid, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send failed [${res.status}]: ${body}`);
  }
  await res.text();
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, organization_id, client_name } = await req.json();

    if (!phone || !organization_id) {
      throw new Error("Missing phone or organization_id");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get org name
    const { data: org } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    // Get portal slug
    const { data: portalConfig } = await supabase
      .from("client_portal_config")
      .select("slug")
      .eq("organization_id", organization_id)
      .maybeSingle();

    // Create portal session
    const { data: session } = await supabase
      .from("client_portal_sessions")
      .insert({
        phone,
        organization_id,
        is_verified: true,
        token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("session_token")
      .single();

    const portalSlug = portalConfig?.slug || "";
    const token = session?.session_token || "";
    const portalUrl = portalSlug
      ? `https://tecvo.com.br/portal/${portalSlug}/login?token=${token}`
      : `https://tecvo.com.br/portal/login?token=${token}`;
    const orgName = org?.name || "nossa empresa";
    const name = client_name || "Cliente";

    const message = `Olá ${name}! Seu serviço foi concluído com sucesso! ✅\n\nVocê pode ver todos os detalhes, fotos e informações aqui:\n${portalUrl}\n\nSe precisar de algo, estamos à disposição.\n\n— ${orgName}`;

    // Find the instance the contact talks on
    const cleanPhone = phone.replace(/\D/g, "");
    const phoneVariants = [cleanPhone];
    if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
      phoneVariants.push("55" + cleanPhone);
    }

    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("channel_id")
      .eq("organization_id", organization_id)
      .eq("is_group", false)
      .in("normalized_phone", phoneVariants)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    let instanceName = TECVO_PLATFORM_INSTANCE;
    if (contact?.channel_id) {
      const { data: ch } = await supabase
        .from("whatsapp_channels")
        .select("instance_name")
        .eq("id", contact.channel_id)
        .single();
      if (ch?.instance_name) instanceName = ch.instance_name;
    }

    await sendWhatsApp(phone, message, instanceName);

    return new Response(
      JSON.stringify({ success: true, instance: instanceName, portal_url: portalUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
