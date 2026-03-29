/**
 * ── SEND FLOW: ORG_AUTOMATION ──
 * Automated notifications triggered by service status changes.
 *
 * OWNER notification → uses TECVO_PLATFORM_INSTANCE ("tecvo").
 *   This is intentional: the owner receives updates from the platform, not from their own channel.
 *
 * CLIENT notification (portal link) → uses the client's org channel if found,
 *   falls back to TECVO_PLATFORM_INSTANCE if no channel exists.
 *   This is acceptable because portal link messages are one-shot notifications,
 *   NOT replies within a customer conversation thread.
 *   They do NOT create or participate in conversation history.
 *
 * ⚠️  This function must NEVER be used to send messages that appear as
 *     conversation replies in the WhatsApp inbox.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";
import { resolveOwnerPhone, logShieldBlocked } from "../_shared/resolveOwnerPhone.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

async function sendWhatsApp(phone: string, text: string, instanceName = TECVO_PLATFORM_INSTANCE) {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) return false;

  let cleanNumber = phone.replace(/\D/g, "");
  if (!cleanNumber.startsWith("55") && cleanNumber.length <= 11) {
    cleanNumber = "55" + cleanNumber;
  }
  const jid = cleanNumber.includes("@") ? cleanNumber : `${cleanNumber}@s.whatsapp.net`;

  try {
    const res = await fetch(`${vpsUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: jid, text }),
    });
    if (!res.ok) {
      console.error("[AUTO-SERVICE] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[AUTO-SERVICE] Send error:", err);
    return false;
  }
}

// Find the WhatsApp channel instance the client is already talking on
async function findClientChannelInstance(supabase: any, organizationId: string, clientPhone: string): Promise<string | null> {
  const cleanPhone = clientPhone.replace(/\D/g, "");
  const phoneVariants = [cleanPhone];
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
    phoneVariants.push("55" + cleanPhone);
  }

  // Find whatsapp_contact matching this phone in the org
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("id, channel_id")
    .eq("organization_id", organizationId)
    .eq("is_group", false)
    .in("normalized_phone", phoneVariants)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (!contact?.channel_id) return null;

  // Get channel instance_name
  const { data: channel } = await supabase
    .from("whatsapp_channels")
    .select("instance_name, is_connected")
    .eq("id", contact.channel_id)
    .eq("is_connected", true)
    .maybeSingle();

  return channel?.instance_name || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { service_id, organization_id, new_operational_status, new_status, old_status } = body;

    if (!service_id || !organization_id) {
      return new Response(JSON.stringify({ error: "Missing params" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // TEMP: Only send to Space Ar Condicionado
    const ALLOWED_ORG_ID = "f46f0514-fecf-4939-b1fa-6a0247f96540";
    if (organization_id !== ALLOWED_ORG_ID) {
      console.log("[AUTO-SERVICE] Skipping non-allowed org:", organization_id);
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get org settings
    const { data: org } = await supabase
      .from("organizations")
      .select("name, timezone, auto_notify_client_completion")
      .eq("id", organization_id)
      .single();

    // Resolve owner's personal phone via user_roles
    const ownerPhone = await resolveOwnerPhone(supabase, organization_id);
    if (!ownerPhone.phone) {
      console.log(`[AUTO-SERVICE] No phone for org ${organization_id} owner (userId=${ownerPhone.userId})`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_owner_phone" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[AUTO-SERVICE] Targeting: org_id=${organization_id} user_id=${ownerPhone.userId} role=owner function=auto-service-notify`);

    // Get service details with client
    const { data: service } = await supabase
      .from("services")
      .select("id, description, service_type, value, scheduled_date, entry_date, status, operational_status, client_id, assigned_to")
      .eq("id", service_id)
      .single();

    if (!service) {
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get client info (name + phone/whatsapp)
    const { data: client } = await supabase
      .from("clients")
      .select("name, phone, whatsapp")
      .eq("id", service.client_id)
      .single();

    const clientName = client?.name || "Cliente";
    const serviceDesc = service.description || service.service_type || "Serviço";
    const orgTimezone = org?.timezone || "America/Sao_Paulo";

    // Use entry_date (actual service time) first, fallback to scheduled_date
    const timeSource = service.entry_date || service.scheduled_date;
    let scheduledTime = "";
    if (timeSource) {
      const raw = timeSource as string;
      if (raw.includes("T") && !raw.endsWith("T00:00:00+00:00") && !raw.endsWith("T00:00:00.000Z") && !/T00:00:00[+-]/.test(raw)) {
        scheduledTime = new Date(raw).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: orgTimezone });
      }
    }

    // Get technician name
    let techName = "";
    if (service.assigned_to) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", service.assigned_to)
        .single();
      techName = profile?.full_name || "";
    }

    let message = "";
    const isCompletion = new_status === "completed" && old_status !== "completed";

    // Determine message based on status change
    if (new_operational_status === "en_route") {
      message = `🚗 Técnico${techName ? ` ${techName}` : ""} a caminho!\n\nCliente: ${clientName}\nServiço: ${serviceDesc}${scheduledTime ? `\nHorário: ${scheduledTime}` : ""}\n\n— Tecvo`;
    } else if (new_operational_status === "in_attendance") {
      message = `🔧 Atendimento iniciado!\n\nCliente: ${clientName}\nServiço: ${serviceDesc}${techName ? `\nTécnico: ${techName}` : ""}\n\n— Tecvo`;
    } else if (isCompletion) {
      message = `✅ Serviço finalizado!\n\nCliente: ${clientName}\nServiço: ${serviceDesc}${service.value ? `\nValor: ${formatBRL(service.value)}` : ""}${techName ? `\nTécnico: ${techName}` : ""}\n\n— Tecvo`;
    }

    if (!message) {
      console.log("[AUTO-SERVICE] No message to send for this status change");
      return new Response(JSON.stringify({ ok: true, skipped: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send guard check for owner notification
    const ownerGuard = await checkSendLimit(supabase, organization_id, null, "auto_notify");
    let ok = false;
    if (!ownerGuard.allowed) {
      console.log(`[AUTO-SERVICE] Owner notification blocked by send guard: ${ownerGuard.reason}`);
    } else {
      // Send notification to org owner via Tecvo instance using their personal phone
      ok = await sendWhatsApp(ownerPhone.phone, message, TECVO_PLATFORM_INSTANCE);
    }

    // Resolve the client's channel instance for client-facing messages
    const clientPhone = client ? (client.whatsapp || client.phone) : null;
    let clientInstanceName: string | null = null;
    if (clientPhone) {
      clientInstanceName = await findClientChannelInstance(supabase, organization_id, clientPhone);
      console.log(`[AUTO-SERVICE] Client channel instance: ${clientInstanceName || "not found, will use tecvo"}`);
    }
    if (ok) {
      await supabase.from("auto_message_log").insert({
        organization_id,
        message_type: "service_event",
        content: message,
      });
    }

    // On completion: also send portal link to the CLIENT (if enabled)
    let clientNotified = false;
    const autoNotifyEnabled = org?.auto_notify_client_completion !== false;
    if (isCompletion && client && autoNotifyEnabled) {
      const clientPhone = client.whatsapp || client.phone;
      if (clientPhone) {
        const normalizedPhone = clientPhone.replace(/\D/g, "");
        if (normalizedPhone.length >= 10) {
          // Check if we already sent a portal link for this service (prevent duplicates)
          const { data: existingLog } = await supabase
            .from("auto_message_log")
            .select("id")
            .eq("organization_id", organization_id)
            .eq("message_type", "client_portal_link")
            .ilike("content", `%${service_id}%`)
            .limit(1);

          if (!existingLog || existingLog.length === 0) {
            // Create a portal session with a 24h token for direct access
            const { data: portalSession } = await supabase
              .from("client_portal_sessions")
              .insert({
                phone: normalizedPhone,
                client_id: service.client_id,
                organization_id,
                is_verified: true,
                token_expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
              })
              .select("session_token")
              .single();

            const { data: portalConfig } = await supabase
              .from("client_portal_config")
              .select("slug")
              .eq("organization_id", organization_id)
              .maybeSingle();

            if (portalSession?.session_token) {
              const portalSlug = portalConfig?.slug || "";
              const portalUrl = portalSlug
                ? `https://tecvo.com.br/portal/${portalSlug}/login?token=${portalSession.session_token}`
                : `https://tecvo.com.br/portal/login?token=${portalSession.session_token}`;
              const orgNameDisplay = org.name || "nossa empresa";

              const clientMessage = `Seu serviço foi concluído com sucesso! ✅\n\nVocê pode ver todos os detalhes, fotos e informações aqui:\n${portalUrl}\n\nSe precisar de algo, estamos à disposição.\n\n— ${orgNameDisplay}`;

              // Send guard check for client notification
              const clientGuard = await checkSendLimit(supabase, organization_id, null, "auto_notify");
              if (!clientGuard.allowed) {
                console.log(`[AUTO-SERVICE] Client notification blocked by send guard: ${clientGuard.reason}`);
              } else {
                // Use client's org channel if available; otherwise fall back to platform instance.
                // This is a ONE-SHOT notification (portal link), NOT a conversation reply.
                // Using the platform instance here is acceptable and does NOT violate channel isolation.
                const instanceToUse = clientInstanceName || TECVO_PLATFORM_INSTANCE;
                const clientOk = await sendWhatsApp(normalizedPhone, clientMessage, instanceToUse);
                if (clientOk) {
                  clientNotified = true;
                  await supabase.from("auto_message_log").insert({
                    organization_id,
                    message_type: "client_portal_link",
                    content: `[service:${service_id}] Portal link sent to client ${clientName}`,
                  });
                }
              }
            }
          } else {
            console.log("[AUTO-SERVICE] Portal link already sent for service:", service_id);
          }
        }
      }
    }

    console.log(`[AUTO-SERVICE] Owner: ${ok ? "sent" : "failed"}, Client: ${clientNotified ? "sent" : "skipped"} for service ${service_id}`);
    return new Response(JSON.stringify({ ok, sent: ok, clientNotified }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[AUTO-SERVICE] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
