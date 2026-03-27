/**
 * ── SEND FLOW: PLATFORM_AUTH ──
 * Client portal OTP verification codes sent via WhatsApp.
 * These are fire-and-forget security messages, NOT conversation replies.
 * Uses the client's org channel if found, falls back to TECVO_PLATFORM_INSTANCE.
 * Must NEVER participate in conversation thread history.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(input: string): string {
  return input.replace(/\D/g, "");
}

function generateOTP4(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function generateOTP6(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `final ${digits.slice(-4)}`;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  const masked = local[0] + "***";
  return `${masked}@${domain}`;
}

async function sendWhatsApp(phone: string, text: string, instanceName = TECVO_PLATFORM_INSTANCE): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findClientChannelInstance(supabase: any, organizationId: string, clientPhone: string): Promise<string | null> {
  const cleanPhone = clientPhone.replace(/\D/g, "");
  const phoneVariants = [cleanPhone];
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
    phoneVariants.push("55" + cleanPhone);
  }

  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("channel_id")
    .eq("organization_id", organizationId)
    .or(phoneVariants.map(p => `phone.ilike.%${p.slice(-8)}%`).join(","))
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!contact?.channel_id) return null;

  const { data: channel } = await supabase
    .from("whatsapp_channels")
    .select("instance_name")
    .eq("id", contact.channel_id)
    .maybeSingle();

  return channel?.instance_name || null;
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { action, ...body } = await req.json();

    // ── SEND OTP (phone-based login, no token) ──
    if (action === "send_otp") {
      const phone = normalizePhone(body.phone || "");
      if (phone.length < 10) {
        return json({ error: "Telefone inválido" }, 400);
      }

      const { data: clients } = await supabase
        .from("clients")
        .select("id, organization_id, name, phone")
        .is("deleted_at", null)
        .or(`phone.ilike.%${phone.slice(-8)}%,whatsapp.ilike.%${phone.slice(-8)}%`);

      if (!clients || clients.length === 0) {
        return json({ error: "Telefone não encontrado. Verifique com a empresa." }, 404);
      }

      const client = clients[0];
      const otp = generateOTP6();

      await supabase
        .from("client_portal_sessions")
        .delete()
        .eq("phone", phone)
        .eq("is_verified", false);

      const { data: session, error: insertError } = await supabase
        .from("client_portal_sessions")
        .insert({
          phone,
          client_id: client.id,
          organization_id: client.organization_id,
          otp_code: otp,
          otp_expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          is_verified: false,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Send guard check for OTP
      const otpGuard = await checkSendLimit(supabase, client.organization_id, null, "portal_otp");
      let sent = false;
      if (!otpGuard.allowed) {
        console.warn(`[CLIENT-PORTAL] OTP blocked by send guard: ${otpGuard.reason}`);
      } else {
        const message = `🔐 *Tecvo — Área do Cliente*\n\nSeu código de acesso: *${otp}*\n\n⏱ Válido por 10 minutos.\n\nSe você não solicitou, ignore esta mensagem.`;
        sent = await sendWhatsApp(phone, message);
      }

      return json({
        success: true,
        session_id: session.id,
        delivery: sent ? "whatsapp" : "pending",
        client_name: client.name,
      });
    }

    // ── VERIFY OTP ──
    if (action === "verify_otp") {
      const { session_id, code } = body;

      if (!session_id || !code) {
        return json({ error: "Dados incompletos" }, 400);
      }

      const { data: session } = await supabase
        .from("client_portal_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("is_verified", false)
        .single();

      if (!session) {
        return json({ error: "Sessão não encontrada ou expirada" }, 404);
      }

      if (session.otp_attempts >= 5) {
        return json({ error: "Muitas tentativas. Solicite um novo código." }, 429);
      }

      if (new Date(session.otp_expires_at) < new Date()) {
        return json({ error: "Código expirado. Solicite um novo." }, 410);
      }

      await supabase
        .from("client_portal_sessions")
        .update({ otp_attempts: session.otp_attempts + 1 })
        .eq("id", session_id);

      if (session.otp_code !== code.trim()) {
        return json({ error: "Código incorreto" }, 401);
      }

      const { data: verified } = await supabase
        .from("client_portal_sessions")
        .update({
          is_verified: true,
          token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", session_id)
        .select("session_token, client_id, organization_id")
        .single();

      return json({
        success: true,
        token: verified!.session_token,
        client_id: verified!.client_id,
        organization_id: verified!.organization_id,
      });
    }

    // ── IDENTIFY TOKEN (returns masked channels, does NOT grant access) ──
    if (action === "identify_token") {
      const { token } = body;

      if (!token) {
        return json({ error: "Token inválido" }, 400);
      }

      const { data: session } = await supabase
        .from("client_portal_sessions")
        .select("id, client_id, organization_id, token_expires_at, phone")
        .eq("session_token", token)
        .single();

      if (!session) {
        return json({ error: "Link inválido ou expirado" }, 404);
      }

      if (new Date(session.token_expires_at) < new Date()) {
        return json({ error: "Link expirado. Solicite um novo acesso." }, 410);
      }

      // Get client info for channels
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("id", session.client_id)
        .single();

      if (!client) {
        return json({ error: "Cliente não encontrado" }, 404);
      }

      // Build available channels (masked)
      const channels: { type: string; label: string; masked: string }[] = [];

      if (client.phone) {
        channels.push({
          type: "whatsapp",
          label: "WhatsApp",
          masked: maskPhone(client.phone),
        });
      }

      if (client.email) {
        channels.push({
          type: "email",
          label: "E-mail",
          masked: maskEmail(client.email),
        });
      }

      // Get portal config for branding
      const { data: portalConfig } = await supabase
        .from("client_portal_config")
        .select("display_name, logo_url, primary_color")
        .eq("organization_id", session.organization_id)
        .eq("is_active", true)
        .maybeSingle();

      const { data: org } = await supabase
        .from("organizations")
        .select("name, logo_url")
        .eq("id", session.organization_id)
        .single();

      return json({
        success: true,
        session_id: session.id,
        client_name: client.name,
        channels,
        branding: {
          name: portalConfig?.display_name || org?.name || null,
          logo_url: portalConfig?.logo_url || org?.logo_url || null,
          primary_color: portalConfig?.primary_color || null,
        },
      });
    }

    // ── SEND VERIFICATION CODE (after token identify, requires channel choice) ──
    if (action === "send_verification") {
      const { session_id, channel } = body;

      if (!session_id || !channel) {
        return json({ error: "Dados incompletos" }, 400);
      }

      const { data: session } = await supabase
        .from("client_portal_sessions")
        .select("id, client_id, organization_id, token_expires_at, is_verified")
        .eq("id", session_id)
        .single();

      if (!session) {
        return json({ error: "Sessão não encontrada" }, 404);
      }

      if (new Date(session.token_expires_at) < new Date()) {
        return json({ error: "Link expirado. Solicite um novo acesso." }, 410);
      }

      // If already verified, just return success
      if (session.is_verified) {
        const { data: s } = await supabase
          .from("client_portal_sessions")
          .select("session_token, client_id, organization_id")
          .eq("id", session_id)
          .single();
        return json({
          success: true,
          already_verified: true,
          token: s!.session_token,
          client_id: s!.client_id,
          organization_id: s!.organization_id,
        });
      }

      const { data: client } = await supabase
        .from("clients")
        .select("phone, email")
        .eq("id", session.client_id)
        .single();

      if (!client) {
        return json({ error: "Cliente não encontrado" }, 404);
      }

      const otp = generateOTP4();

      // Update session with new OTP
      await supabase
        .from("client_portal_sessions")
        .update({
          otp_code: otp,
          otp_expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          otp_attempts: 0,
        })
        .eq("id", session_id);

      let sent = false;

      if (channel === "whatsapp" && client.phone) {
        const instanceName = await findClientChannelInstance(supabase, session.organization_id, client.phone) || TECVO_PLATFORM_INSTANCE;
        const message = `🔐 *Código de verificação*\n\nSeu código: *${otp}*\n\n⏱ Válido por 5 minutos.`;
        sent = await sendWhatsApp(client.phone, message, instanceName);
      } else if (channel === "email" && client.email) {
        // TODO: implement email OTP sending
        // For now, fall back to WhatsApp if possible
        if (client.phone) {
          const instanceName = await findClientChannelInstance(supabase, session.organization_id, client.phone) || TECVO_PLATFORM_INSTANCE;
          const message = `🔐 *Código de verificação*\n\nSeu código: *${otp}*\n\n⏱ Válido por 5 minutos.`;
          sent = await sendWhatsApp(client.phone, message, instanceName);
        }
      }

      return json({ success: true, sent, channel });
    }

    // ── VERIFY TOKEN CODE (verify OTP sent after token identify) ──
    if (action === "verify_token_code") {
      const { session_id, code } = body;

      if (!session_id || !code) {
        return json({ error: "Dados incompletos" }, 400);
      }

      const { data: session } = await supabase
        .from("client_portal_sessions")
        .select("*")
        .eq("id", session_id)
        .eq("is_verified", false)
        .single();

      if (!session) {
        return json({ error: "Sessão não encontrada ou já verificada" }, 404);
      }

      if (session.otp_attempts >= 5) {
        return json({ error: "Muitas tentativas. Solicite um novo código." }, 429);
      }

      if (!session.otp_expires_at || new Date(session.otp_expires_at) < new Date()) {
        return json({ error: "Código expirado. Solicite um novo." }, 410);
      }

      await supabase
        .from("client_portal_sessions")
        .update({ otp_attempts: (session.otp_attempts || 0) + 1 })
        .eq("id", session_id);

      if (session.otp_code !== code.trim()) {
        return json({ error: "Código incorreto" }, 401);
      }

      const { data: verified } = await supabase
        .from("client_portal_sessions")
        .update({
          is_verified: true,
          token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq("id", session_id)
        .select("session_token, client_id, organization_id")
        .single();

      return json({
        success: true,
        token: verified!.session_token,
        client_id: verified!.client_id,
        organization_id: verified!.organization_id,
      });
    }

    // ── VALIDATE TOKEN (for already-verified sessions, e.g. page reload) ──
    if (action === "validate_token") {
      const { token } = body;

      if (!token) {
        return json({ error: "Token inválido" }, 400);
      }

      const { data: session } = await supabase
        .from("client_portal_sessions")
        .select("session_token, client_id, organization_id, token_expires_at, is_verified")
        .eq("session_token", token)
        .eq("is_verified", true)
        .single();

      if (!session) {
        return json({ error: "Sessão não verificada ou inválida" }, 404);
      }

      if (new Date(session.token_expires_at) < new Date()) {
        return json({ error: "Sessão expirada. Solicite um novo acesso." }, 410);
      }

      return json({
        success: true,
        token: session.session_token,
        client_id: session.client_id,
        organization_id: session.organization_id,
      });
    }

    // ── GET CLIENT DATA ──
    if (action === "get_data") {
      const { token } = body;

      const { data: session } = await supabase
        .from("client_portal_sessions")
        .select("client_id, organization_id, token_expires_at, is_verified")
        .eq("session_token", token)
        .eq("is_verified", true)
        .single();

      if (!session || new Date(session.token_expires_at) < new Date()) {
        return json({ error: "Sessão expirada" }, 401);
      }

      // Get client info
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, phone, maintenance_reminder_enabled")
        .eq("id", session.client_id)
        .single();

      // Get services
      const { data: services } = await supabase
        .from("services")
        .select("id, service_type, status, scheduled_date, completed_date, value, description, operational_status, assigned_to, entry_date")
        .eq("client_id", session.client_id)
        .eq("organization_id", session.organization_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(20);

      const { data: org } = await supabase
        .from("organizations")
        .select("name, phone, whatsapp_owner, logo_url")
        .eq("id", session.organization_id)
        .single();

      const { data: portalConfig } = await supabase
        .from("client_portal_config")
        .select("display_name, welcome_message, contact_phone, logo_url, primary_color, secondary_color")
        .eq("organization_id", session.organization_id)
        .eq("is_active", true)
        .maybeSingle();

      const techIds = [...new Set((services || []).map(s => s.assigned_to).filter(Boolean))];
      let techMap: Record<string, string> = {};
      if (techIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", techIds);
        if (profiles) {
          techMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name || "Técnico"]));
        }
      }

      const serviceIds = (services || []).map(s => s.id);
      let photosMap: Record<string, any[]> = {};
      if (serviceIds.length > 0) {
        const { data: photos } = await supabase
          .from("service_photos")
          .select("service_id, photo_url, photo_type, description")
          .in("service_id", serviceIds);
        if (photos) {
          for (const p of photos) {
            if (!photosMap[p.service_id]) photosMap[p.service_id] = [];
            photosMap[p.service_id].push(p);
          }
        }
      }

      let equipmentMap: Record<string, any[]> = {};
      if (serviceIds.length > 0) {
        const { data: equipment } = await supabase
          .from("service_equipment")
          .select("service_id, name, brand, model, technical_report, defects, solution")
          .in("service_id", serviceIds);
        if (equipment) {
          for (const e of equipment) {
            if (!equipmentMap[e.service_id]) equipmentMap[e.service_id] = [];
            equipmentMap[e.service_id].push(e);
          }
        }
      }

      const enrichedServices = (services || []).map(s => ({
        ...s,
        technician_name: s.assigned_to ? techMap[s.assigned_to] || null : null,
        photos: photosMap[s.id] || [],
        equipment: equipmentMap[s.id] || [],
      }));

      return json({
        client,
        organization: org,
        portal_config: portalConfig || null,
        services: enrichedServices,
      });
    }

    // ── TOGGLE REMINDER ──
    if (action === "toggle_reminder") {
      const { token, enabled } = body;

      const { data: sess } = await supabase
        .from("client_portal_sessions")
        .select("client_id, token_expires_at, is_verified")
        .eq("session_token", token)
        .eq("is_verified", true)
        .single();

      if (!sess || new Date(sess.token_expires_at) < new Date()) {
        return json({ error: "Sessão expirada" }, 401);
      }

      await supabase
        .from("clients")
        .update({ maintenance_reminder_enabled: !!enabled })
        .eq("id", sess.client_id);

      return json({ success: true, enabled: !!enabled });
    }

    return json({ error: "Ação inválida" }, 400);

  } catch (error) {
    console.error("[CLIENT-PORTAL-AUTH] Error:", error);
    return json({ error: "Erro interno" }, 500);
  }
});
