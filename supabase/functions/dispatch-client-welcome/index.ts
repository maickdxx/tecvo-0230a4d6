/**
 * ── DISPATCH-CLIENT-WELCOME ──
 * Sends Laura's welcome message to newly registered clients via the org's WhatsApp channel.
 * Called from the frontend after client registration.
 *
 * SEND FLOW: ORG_NOTIFICATION (uses the org's own WhatsApp instance)
 *
 * Message (two bubbles):
 * 1) "Oi, tudo bem? 👋 Eu sou a Laura, secretária inteligente da {empresa}."
 * 2) "Pode ficar tranquilo — eu consigo te ajudar a organizar sua empresa..."
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { normalizePhone } from "../_shared/whatsapp-utils.ts";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { organization_id, client_phone, client_name } = await req.json();

    if (!organization_id || !client_phone) {
      return new Response(JSON.stringify({ error: "organization_id and client_phone required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to org
    const { data: profile } = await admin
      .from("profiles")
      .select("organization_id")
      .eq("user_id", user.id)
      .single();

    if (!profile || profile.organization_id !== organization_id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org name
    const { data: org } = await admin
      .from("organizations")
      .select("name")
      .eq("id", organization_id)
      .single();

    const orgName = org?.name || "sua empresa";

    // Find an active connected WhatsApp channel for this org
    const { data: channel } = await admin
      .from("whatsapp_channels")
      .select("id, instance_name, is_connected, channel_status")
      .eq("organization_id", organization_id)
      .eq("is_connected", true)
      .eq("channel_status", "connected")
      .limit(1)
      .maybeSingle();

    if (!channel) {
      console.log(`[DISPATCH-CLIENT-WELCOME] No connected channel for org=${organization_id}, skipping`);
      return new Response(JSON.stringify({ success: false, reason: "no_channel" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize phone
    const digits = normalizePhone(client_phone);
    if (!digits || digits.length < 10) {
      console.log(`[DISPATCH-CLIENT-WELCOME] Invalid phone: ${client_phone}`);
      return new Response(JSON.stringify({ success: false, reason: "invalid_phone" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
    const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

    if (!vpsUrl || !apiKey) {
      return new Response(JSON.stringify({ success: false, reason: "wa_not_configured" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const name = client_name || "cliente";

    // Two bubbles as per design
    const msg1 = `Oi, tudo bem? 👋 Eu sou a *Laura*, secretária inteligente da *${orgName}*.`;
    const msg2 = `Pode ficar tranquilo — eu consigo te ajudar a organizar seus atendimentos, cuidar da agenda, dos serviços e até do financeiro pra você. E o melhor: você não precisa mexer em nada complicado.\n\nSe precisar de qualquer coisa, é só me chamar aqui! 😊`;

    // Try sending with BR number variations
    const numbersToTry = [digits];
    if (digits.startsWith("55") && digits.length === 13) {
      numbersToTry.push(digits.slice(0, 4) + digits.slice(5));
    } else if (digits.startsWith("55") && digits.length === 12) {
      numbersToTry.push(digits.slice(0, 4) + "9" + digits.slice(4));
    }

    let sent = false;
    let lastError = "";

    for (const num of numbersToTry) {
      const jid = `${num}@s.whatsapp.net`;
      console.log(`[DISPATCH-CLIENT-WELCOME] Trying ${jid} via ${channel.instance_name}`);

      // Send first bubble
      const res1 = await fetch(`${vpsUrl}/message/sendText/${channel.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: jid, text: msg1 }),
      });

      if (!res1.ok) {
        lastError = await res1.text();
        console.log(`[DISPATCH-CLIENT-WELCOME] Failed for ${num}: ${lastError}`);
        if (lastError.includes('"exists":false') && numbersToTry.indexOf(num) < numbersToTry.length - 1) {
          continue;
        }
        break;
      }

      // Small delay between bubbles
      await new Promise(r => setTimeout(r, 1500));

      // Send second bubble
      const res2 = await fetch(`${vpsUrl}/message/sendText/${channel.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: JSON.stringify({ number: jid, text: msg2 }),
      });

      if (!res2.ok) {
        console.warn(`[DISPATCH-CLIENT-WELCOME] Second bubble failed, but first was sent`);
      }

      sent = true;
      break;
    }

    if (!sent) {
      console.error(`[DISPATCH-CLIENT-WELCOME] All attempts failed: ${lastError}`);
      return new Response(JSON.stringify({ success: false, reason: "send_failed", error: lastError }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[DISPATCH-CLIENT-WELCOME] Welcome sent to ${client_phone} for org=${organization_id}`);
    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[DISPATCH-CLIENT-WELCOME] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
