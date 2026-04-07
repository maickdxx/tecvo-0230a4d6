/**
 * ── AUTO-SERVICE-NOTIFY ──
 * Automated operational notifications triggered by service status changes.
 * 
 * Fired by DB trigger on services table when:
 *   - operational_status changes to 'en_route' or 'in_attendance'
 *   - status changes to 'completed'
 * 
 * NOTIFICATIONS:
 *   1. OWNER always receives notification (via Tecvo platform instance)
 *   2. If owner IS the executor → self-notification with appropriate wording
 *   3. If executor is a technician → owner receives "Técnico X fez Y"
 *   4. Client portal link on completion (if enabled) → separate from owner notification
 * 
 * IDEMPOTENCY:
 *   - Checks auto_message_log for duplicate (service_id + message_type + 5min window)
 *   - Prevents re-sends on retry, reconnection, or reprocessing
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";
import { TECVO_PLATFORM_INSTANCE } from "../_shared/sendFlowTypes.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOG_PREFIX = "[AUTO-SERVICE-NOTIFY]";

const SERVICE_TYPE_LABELS: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  cleaning: "Limpeza",
  repair: "Reparo",
  inspection: "Vistoria",
  removal: "Remoção",
  relocation: "Remanejamento",
  other: "Serviço",
};

function formatBRL(value: number): string {
  return `R$ ${value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Build a compact, human-readable service label */
function buildServiceLabel(description: string | null, serviceType: string | null): string {
  const typeLabel = serviceType ? (SERVICE_TYPE_LABELS[serviceType] || serviceType) : null;
  if (description && description.length > 2 && description.toLowerCase() !== serviceType) {
    // Use description as primary — it's usually more specific
    return description.length > 40 ? description.slice(0, 37) + "…" : description;
  }
  return typeLabel || "Serviço";
}

async function sendWhatsApp(phone: string, text: string, instanceName = TECVO_PLATFORM_INSTANCE): Promise<boolean> {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");
  if (!vpsUrl || !apiKey) {
    console.warn(`${LOG_PREFIX} Missing VPS config, cannot send`);
    return false;
  }

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
      console.error(`${LOG_PREFIX} Send failed: ${res.status} ${await res.text()}`);
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error(`${LOG_PREFIX} Send error:`, err);
    return false;
  }
}

/**
 * Resolve the owner's phone for operational notifications.
 * Unlike resolveOwnerPhone, this does NOT require aiEnabled — 
 * operational notifications are always sent to the owner.
 */
async function resolveOwnerForOperational(supabase: any, organizationId: string) {
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("organization_id", organizationId)
    .eq("role", "owner");

  if (!roles || roles.length === 0) {
    return { userId: null, phone: null, fullName: null, reason: "no_owner_found" };
  }

  const ownerUserId = roles[0].user_id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("phone, full_name")
    .eq("user_id", ownerUserId)
    .maybeSingle();

  if (!profile?.phone) {
    return { userId: ownerUserId, phone: null, fullName: profile?.full_name || null, reason: "no_phone" };
  }

  let phone = profile.phone.replace(/\D/g, "");
  if (phone.length >= 10 && !phone.startsWith("55") && phone.length <= 11) {
    phone = "55" + phone;
  }

  return { userId: ownerUserId, phone, fullName: profile.full_name || null, reason: null };
}

/**
 * Check idempotency — prevent duplicate notifications for the same event
 */
async function isDuplicate(supabase: any, orgId: string, serviceId: string, messageType: string): Promise<boolean> {
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("auto_message_log")
    .select("id")
    .eq("organization_id", orgId)
    .eq("service_id", serviceId)
    .eq("message_type", messageType)
    .gte("sent_at", fiveMinAgo)
    .limit(1);

  return !!(data && data.length > 0);
}

/**
 * Find the executor of the action by checking service_execution_logs
 */
async function findExecutor(supabase: any, serviceId: string, eventType: string) {
  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("service_execution_logs")
    .select("user_id")
    .eq("service_id", serviceId)
    .eq("event_type", eventType)
    .gte("recorded_at", twoMinAgo)
    .order("recorded_at", { ascending: false })
    .limit(1);

  if (data && data.length > 0) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, user_id")
      .eq("user_id", data[0].user_id)
      .maybeSingle();
    return { userId: data[0].user_id, fullName: profile?.full_name || null };
  }
  return null;
}

/**
 * Find WhatsApp channel instance for client notifications
 */
async function findClientChannelInstance(supabase: any, organizationId: string, clientPhone: string): Promise<string | null> {
  const cleanPhone = clientPhone.replace(/\D/g, "");
  const phoneVariants = [cleanPhone];
  if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
    phoneVariants.push("55" + cleanPhone);
  }

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

  const { data: channel } = await supabase
    .from("whatsapp_channels")
    .select("instance_name, is_connected")
    .eq("id", contact.channel_id)
    .eq("is_connected", true)
    .maybeSingle();

  return channel?.instance_name || null;
}

// ── Message Templates (Premium) ──

function buildOwnerMessage(params: {
  event: "en_route" | "in_attendance" | "completed";
  isSelf: boolean;
  techName: string | null; // null = executor unknown
  clientName: string;
  serviceLabel: string;
  scheduledTime: string;
  value: number | null;
}): string {
  const { event, isSelf, techName, clientName, serviceLabel, scheduledTime, value } = params;

  // Context suffix — compact, inline, max 1 element per message
  const timeCtx = scheduledTime ? ` • ${scheduledTime}` : "";
  const valueCtx = value ? ` • ${formatBRL(value)}` : "";

  if (event === "en_route") {
    if (isSelf) {
      return `🚗 A caminho de *${clientName}*${timeCtx}\n${serviceLabel}\n\n— Laura`;
    }
    if (techName) {
      return `🚗 *${techName}* a caminho de *${clientName}*${timeCtx}\n${serviceLabel}\n\n— Laura`;
    }
    // Fallback: no executor name
    return `🚗 Deslocamento iniciado — *${clientName}*${timeCtx}\n${serviceLabel}\n\n— Laura`;
  }

  if (event === "in_attendance") {
    if (isSelf) {
      return `🔧 Atendimento iniciado — *${clientName}*\n${serviceLabel}\n\n— Laura`;
    }
    if (techName) {
      return `🔧 *${techName}* iniciou — *${clientName}*\n${serviceLabel}\n\n— Laura`;
    }
    return `🔧 Atendimento iniciado — *${clientName}*\n${serviceLabel}\n\n— Laura`;
  }

  // completed
  if (isSelf) {
    return `✅ Finalizado — *${clientName}*${valueCtx}\n${serviceLabel}\n\n— Laura`;
  }
  if (techName) {
    return `✅ *${techName}* finalizou — *${clientName}*${valueCtx}\n${serviceLabel}\n\n— Laura`;
  }
  return `✅ Serviço finalizado — *${clientName}*${valueCtx}\n${serviceLabel}\n\n— Laura`;
}

// ── Main Handler ──

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

    // Determine event type
    let event: "en_route" | "in_attendance" | "completed" | null = null;
    let eventLogType = "";
    let messageType = "";

    if (new_operational_status === "en_route") {
      event = "en_route";
      eventLogType = "travel_start";
      messageType = "service_en_route";
    } else if (new_operational_status === "in_attendance") {
      event = "in_attendance";
      eventLogType = "attendance_start";
      messageType = "service_in_attendance";
    } else if (new_status === "completed" && old_status !== "completed") {
      event = "completed";
      eventLogType = "completion";
      messageType = "service_completed";
    }

    if (!event) {
      console.log(`${LOG_PREFIX} No relevant event for this status change`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "no_relevant_event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Idempotency check ──
    const duplicate = await isDuplicate(supabase, organization_id, service_id, messageType);
    if (duplicate) {
      console.log(`${LOG_PREFIX} DUPLICATE blocked: ${messageType} for service ${service_id}`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "duplicate" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Org check (paid plan, not paused) ──
    const { data: org } = await supabase
      .from("organizations")
      .select("name, plan, messaging_paused, timezone, auto_notify_client_completion")
      .eq("id", organization_id)
      .single();

    if (!org || org.plan === "free" || org.messaging_paused) {
      console.log(`${LOG_PREFIX} Skipping: org=${organization_id} plan=${org?.plan} paused=${org?.messaging_paused}`);
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "org_ineligible" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Resolve owner ──
    const owner = await resolveOwnerForOperational(supabase, organization_id);
    if (!owner.phone) {
      console.log(`${LOG_PREFIX} No owner phone: org=${organization_id} userId=${owner.userId} reason=${owner.reason}`);
      // Log but don't fail - continue to client notification if applicable
    }

    // ── Get service details ──
    const { data: service } = await supabase
      .from("services")
      .select("id, description, service_type, value, scheduled_date, entry_date, status, operational_status, client_id, assigned_to")
      .eq("id", service_id)
      .single();

    if (!service) {
      console.log(`${LOG_PREFIX} Service not found: ${service_id}`);
      return new Response(JSON.stringify({ error: "Service not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get client name ──
    const { data: client } = await supabase
      .from("clients")
      .select("name, phone, whatsapp")
      .eq("id", service.client_id)
      .single();

    const clientName = client?.name || "Cliente";
    const serviceDesc = service.description || service.service_type || "Serviço";
    const orgTimezone = org.timezone || "America/Sao_Paulo";

    // ── Scheduled time ──
    const timeSource = service.entry_date || service.scheduled_date;
    let scheduledTime = "";
    if (timeSource) {
      const raw = timeSource as string;
      if (raw.includes("T") && !raw.endsWith("T00:00:00+00:00") && !raw.endsWith("T00:00:00.000Z") && !/T00:00:00[+-]/.test(raw)) {
        scheduledTime = new Date(raw).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: orgTimezone });
      }
    }

    // ── Find executor (who triggered the action) ──
    const executor = await findExecutor(supabase, service_id, eventLogType);
    
    // Fallback: if no execution log, use assigned_to
    let executorName = "";
    let executorUserId: string | null = null;
    if (executor) {
      executorName = executor.fullName || "";
      executorUserId = executor.userId;
    } else if (service.assigned_to) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, user_id")
        .eq("user_id", service.assigned_to)
        .maybeSingle();
      executorName = profile?.full_name || "";
      executorUserId = service.assigned_to;
    }

    // ── Determine if owner is the executor (self-notification) ──
    const isSelf = !!(owner.userId && executorUserId && owner.userId === executorUserId);

    console.log(`${LOG_PREFIX} Event: ${event} | Service: ${service_id} | Executor: ${executorUserId} (${executorName}) | Owner: ${owner.userId} (${owner.fullName}) | isSelf: ${isSelf}`);

    // ── Build and send owner message ──
    let ownerSent = false;
    if (owner.phone) {
      const message = buildOwnerMessage({
        event,
        isSelf,
        techName: executorName || "Técnico",
        clientName,
        serviceDesc,
        scheduledTime,
        value: service.value,
      });

      // Send guard
      const guard = await checkSendLimit(supabase, organization_id, null, "auto_notify");
      if (!guard.allowed) {
        console.log(`${LOG_PREFIX} Owner notification blocked by send guard: ${guard.reason}`);
      } else {
        ownerSent = await sendWhatsApp(owner.phone, message, TECVO_PLATFORM_INSTANCE);
      }

      // Log regardless of send success
      await supabase.from("auto_message_log").insert({
        organization_id,
        service_id,
        message_type: messageType,
        content: message,
        send_status: ownerSent ? "sent" : "failed",
      });

      console.log(`${LOG_PREFIX} Owner notification: ${ownerSent ? "SENT" : "FAILED"} | phone: ${owner.phone.slice(0, 6)}*** | msg_type: ${messageType}`);
    } else {
      // Log blocked notification
      await supabase.from("auto_message_log").insert({
        organization_id,
        service_id,
        message_type: messageType,
        content: `[BLOCKED] No owner phone for event ${event}`,
        send_status: "blocked",
      });
    }

    // ── Client portal link on completion (if enabled) ──
    let clientNotified = false;
    const autoNotifyClientEnabled = org.auto_notify_client_completion !== false;
    if (event === "completed" && client && autoNotifyClientEnabled) {
      const clientPhone = client.whatsapp || client.phone;
      if (clientPhone) {
        const normalizedPhone = clientPhone.replace(/\D/g, "");
        if (normalizedPhone.length >= 10) {
          // Check duplicate for client portal link
          const clientDuplicate = await isDuplicate(supabase, organization_id, service_id, "client_portal_link");
          if (clientDuplicate) {
            console.log(`${LOG_PREFIX} Client portal link already sent for service: ${service_id}`);
          } else {
            // Create portal session
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

              const clientMessage = `Seu serviço foi concluído! ✅\n\nVeja os detalhes aqui:\n${portalUrl}\n\n— ${orgNameDisplay}`;

              // Send guard
              const clientGuard = await checkSendLimit(supabase, organization_id, null, "auto_notify");
              if (!clientGuard.allowed) {
                console.log(`${LOG_PREFIX} Client notification blocked by send guard: ${clientGuard.reason}`);
              } else {
                const { checkExternalSendPermission } = await import("../_shared/externalSendGuard.ts");
                const extGuard = await checkExternalSendPermission(supabase, {
                  source: "auto_notify",
                  organizationId: organization_id,
                  contactId: null,
                  recipientPhone: normalizedPhone,
                  isInternal: false,
                  messagePreview: `auto_service_notify:client_portal_link service=${service_id}`,
                  functionName: "auto-service-notify",
                });

                if (!extGuard.allowed) {
                  console.log(`${LOG_PREFIX} Client blocked by external guard: ${extGuard.reason}`);
                } else {
                  const clientInstance = await findClientChannelInstance(supabase, organization_id, clientPhone) || TECVO_PLATFORM_INSTANCE;
                  clientNotified = await sendWhatsApp(normalizedPhone, clientMessage, clientInstance);
                }
              }

              await supabase.from("auto_message_log").insert({
                organization_id,
                service_id,
                message_type: "client_portal_link",
                content: `Portal link → ${clientName}`,
                send_status: clientNotified ? "sent" : "failed",
              });
            }
          }
        }
      }
    }

    console.log(`${LOG_PREFIX} DONE | event=${event} | owner=${ownerSent ? "sent" : "no"} | client=${clientNotified ? "sent" : "no"} | service=${service_id}`);

    return new Response(JSON.stringify({ ok: true, ownerSent, clientNotified, event }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(`${LOG_PREFIX} ERROR:`, err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
