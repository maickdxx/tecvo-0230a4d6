/**
 * ── SEND FLOW: CUSTOMER_CONVERSATION ──
 * Sends recurrence/maintenance reminder messages to clients via their org's channel.
 * STRICT channel isolation: resolves the client's last channel within the org.
 * NO fallback to any other channel or the platform instance. No channel → BLOCK.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWhatsApp(phone: string, text: string, instanceName: string): Promise<boolean> {
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
      console.error("[RECURRENCE] Send failed:", res.status, await res.text());
      return false;
    }
    await res.text();
    return true;
  } catch (err) {
    console.error("[RECURRENCE] Send error:", err);
    return false;
  }
}

/**
 * Resolve which WhatsApp instance to use for sending.
 * Priority:
 *   1. Instance the client last interacted with (MUST belong to this org)
 *   2. null → block send (no fallback to other channels)
 */
async function resolveOrgInstance(
  supabase: any,
  orgId: string,
  clientId: string
): Promise<{ instanceName: string | null; channelId: string | null }> {
  try {
    // 1. Try client's last contact channel — scoped to this org
    const { data: contact } = await supabase
      .from("whatsapp_contacts")
      .select("channel_id")
      .eq("organization_id", orgId)
      .eq("client_id", clientId)
      .eq("is_group", false)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle();

    if (contact?.channel_id) {
      // Validate channel belongs to this org AND is connected
      const { data: channel } = await supabase
        .from("whatsapp_channels")
        .select("instance_name, is_connected")
        .eq("id", contact.channel_id)
        .eq("organization_id", orgId)
        .eq("is_connected", true)
        .maybeSingle();

      if (channel?.instance_name) {
        return { instanceName: channel.instance_name, channelId: contact.channel_id };
      }
    }

    // 2. STRICT: No fallback to other channels — isolamento total
    console.warn(`[RECURRENCE] Contact's channel not available (client: ${clientId}, channel_id: ${contact?.channel_id || "null"}). Blocking send — no fallback allowed.`);
  } catch (err) {
    console.warn("[RECURRENCE] Instance resolve failed:", err);
  }

  // No connected channel for this contact → block
  return { instanceName: null, channelId: null };
}

type MessageStage = "2_months" | "4_months" | "6_months" | "8_months" | "10_months" | "12_months";

interface StageConfig {
  type: MessageStage;
  monthsAfter: number;
  sentField: string;
  dbStage: string;
  nextMonths: number | null;
}

const STAGE_FLOW: StageConfig[] = [
  { type: "2_months",  monthsAfter: 2,  sentField: "msg_2m_sent_at",  dbStage: "2m_enviado",  nextMonths: 4 },
  { type: "4_months",  monthsAfter: 4,  sentField: "msg_4m_sent_at",  dbStage: "4m_enviado",  nextMonths: 6 },
  { type: "6_months",  monthsAfter: 6,  sentField: "msg_6m_sent_at",  dbStage: "6m_enviado",  nextMonths: 8 },
  { type: "8_months",  monthsAfter: 8,  sentField: "msg_8m_sent_at",  dbStage: "8m_enviado",  nextMonths: 10 },
  { type: "10_months", monthsAfter: 10, sentField: "msg_10m_sent_at", dbStage: "10m_enviado", nextMonths: 12 },
  { type: "12_months", monthsAfter: 12, sentField: "msg_12m_sent_at", dbStage: "12m_enviado", nextMonths: null },
];

function getCurrentStage(entry: any, completedDate: Date, now: Date): StageConfig | null {
  const diffMs = now.getTime() - completedDate.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);

  for (let i = STAGE_FLOW.length - 1; i >= 0; i--) {
    const stage = STAGE_FLOW[i];
    if (diffMonths >= stage.monthsAfter && !entry[stage.sentField]) {
      return stage;
    }
  }
  return null;
}

const DEFAULT_MESSAGES: Record<MessageStage, string> = {
  "2_months": "Olá {nome}! Já faz 2 meses desde a última limpeza do seu ar-condicionado 😊\nRecomendamos a limpeza do filtro para manter o bom funcionamento.\nDaqui a alguns meses será o momento ideal para a limpeza completa. Se precisar, estamos à disposição!",
  "4_months": "Olá {nome}! Já faz 4 meses desde a última limpeza do seu ar-condicionado 😊\nManter o filtro limpo ajuda muito no desempenho do equipamento.\nEm breve será o momento ideal para uma nova limpeza completa. Se quiser já se programar, estamos à disposição!",
  "6_months": "Olá {nome}! Já faz cerca de 6 meses desde a última limpeza do seu ar-condicionado 😊\nEsse é o momento ideal para realizar uma nova higienização e evitar problemas.\nQuer agendar?",
  "8_months": "Olá {nome}! Já faz cerca de 8 meses desde a última limpeza do seu ar-condicionado.\nA limpeza já passou do prazo ideal e isso pode afetar o desempenho do equipamento.\nQuer agendar com a gente?",
  "10_months": "Olá {nome}! Já faz cerca de 10 meses desde a última limpeza do seu ar-condicionado.\nManter a higienização em dia ajuda a evitar perda de eficiência, mau cheiro e outros problemas.\nSe quiser, podemos te ajudar a agendar.",
  "12_months": "Olá {nome}! Já faz cerca de 12 meses desde a última limpeza do seu ar-condicionado.\nEsse tempo já está bem acima do ideal para manutenção preventiva.\nCaso queira agendar sua limpeza, estamos à disposição.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: only allow calls with service_role key or anon key (cron jobs)
  const authHeader = req.headers.get("authorization") || "";
  const apiKeyHeader = req.headers.get("apikey") || "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

  const token = authHeader.replace("Bearer ", "");
  if (token !== anonKey && token !== serviceKey && apiKeyHeader !== anonKey && apiKeyHeader !== serviceKey) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const now = new Date();
    const currentHour = now.getUTCHours() - 3; // BRT approximation

    // Get all orgs with automation enabled
    const { data: configs, error: cfgErr } = await supabase
      .from("recurrence_config")
      .select("*")
      .eq("automation_enabled", true);

    if (cfgErr) throw cfgErr;
    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ message: "No orgs with automation enabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { org_id: string; sent: number; blocked: number; errors: number; no_whatsapp: boolean }[] = [];

    for (const config of configs) {
      const orgId = config.organization_id;
      const startHour = parseInt(config.business_hours_start?.split(":")[0] || "8");
      const endHour = parseInt(config.business_hours_end?.split(":")[0] || "18");

      if (currentHour < startHour || currentHour >= endHour) {
        console.log(`[RECURRENCE] ${orgId}: Outside business hours (${currentHour}h, allowed ${startHour}-${endHour})`);
        continue;
      }

      // Check WhatsApp connectivity — org must not have messaging paused
      const { data: org } = await supabase
        .from("organizations")
        .select("messaging_paused")
        .eq("id", orgId)
        .single();

      if (org?.messaging_paused) {
        console.log(`[RECURRENCE] ${orgId}: Messaging paused`);
        results.push({ org_id: orgId, sent: 0, blocked: 0, errors: 0, no_whatsapp: true });
        continue;
      }

      // Verify org has at least one connected CUSTOMER_INBOX channel
      const { count: connectedChannels } = await supabase
        .from("whatsapp_channels")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("is_connected", true)
        .eq("channel_type", "CUSTOMER_INBOX");

      if (!connectedChannels || connectedChannels === 0) {
        console.log(`[RECURRENCE] ${orgId}: No connected CUSTOMER_INBOX channel — blocking all sends`);
        results.push({ org_id: orgId, sent: 0, blocked: 0, errors: 0, no_whatsapp: true });
        continue;
      }

      // Get active entries due for action
      const { data: entries, error: entErr } = await supabase
        .from("recurrence_entries")
        .select(`
          id, client_id, source_completed_date, source_value, stage,
          msg_2m_sent_at, msg_4m_sent_at, msg_6m_sent_at,
          msg_8m_sent_at, msg_10m_sent_at, msg_12m_sent_at,
          client:clients(id, name, phone, whatsapp)
        `)
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .lte("next_action_date", now.toISOString().split("T")[0]);

      if (entErr) {
        console.error(`[RECURRENCE] ${orgId}: Query error:`, entErr.message);
        continue;
      }

      if (!entries || entries.length === 0) continue;

      // Check daily limit
      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);
      const { count: sentToday } = await supabase
        .from("recurrence_message_log")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "sent")
        .gte("sent_at", todayStart.toISOString());

      const remainingToday = config.daily_limit - (sentToday || 0);
      if (remainingToday <= 0) {
        console.log(`[RECURRENCE] ${orgId}: Daily limit reached (${config.daily_limit})`);
        continue;
      }

      let orgSent = 0;
      let orgBlocked = 0;
      let orgErrors = 0;

      for (const entry of entries.slice(0, remainingToday)) {
        const client = entry.client as any;
        if (!client) continue;

        const phone = client.whatsapp || client.phone;
        if (!phone) { orgBlocked++; continue; }

        const completedDate = new Date(entry.source_completed_date);
        const stageConfig = getCurrentStage(entry, completedDate, now);
        if (!stageConfig) {
          const diffMonths = (now.getTime() - completedDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
          if (diffMonths >= 13 && entry.msg_12m_sent_at) {
            await supabase
              .from("recurrence_entries")
              .update({
                stage: "ignorado",
                is_active: false,
                closed_reason: "sem_conversao_12m",
                closed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", entry.id);
          }
          continue;
        }

        // Check if client already has a scheduled service (block)
        const { count: activeServices } = await supabase
          .from("services")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("client_id", entry.client_id)
          .in("status", ["scheduled", "in_progress"])
          .is("deleted_at", null);

        if ((activeServices || 0) > 0) {
          await supabase
            .from("recurrence_entries")
            .update({
              stage: "agendado",
              is_active: false,
              closed_reason: "agendado_detectado",
              closed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", entry.id);
          orgBlocked++;
          continue;
        }

        // Resolve org-scoped WhatsApp instance — NO cross-org fallback
        const { instanceName, channelId } = await resolveOrgInstance(supabase, orgId, entry.client_id);

        if (!instanceName) {
          // No connected WhatsApp for this org → block send, log reason
          await supabase.from("recurrence_message_log").insert({
            organization_id: orgId,
            recurrence_entry_id: entry.id,
            client_id: entry.client_id,
            message_type: stageConfig.type,
            status: "blocked",
            error_message: "no_connected_whatsapp_instance_for_org",
          });
          orgBlocked++;
          continue;
        }

        // Send guard
        const guard = await checkSendLimit(supabase, orgId, entry.client_id, "recurrence");
        if (!guard.allowed) {
          await supabase.from("recurrence_message_log").insert({
            organization_id: orgId,
            recurrence_entry_id: entry.id,
            client_id: entry.client_id,
            message_type: stageConfig.type,
            status: "blocked",
            error_message: guard.reason,
          });
          orgBlocked++;
          continue;
        }

        // Build message from config or defaults
        const configMessageKey = `message_${stageConfig.monthsAfter}_months`;
        const template = (config as any)[configMessageKey] || DEFAULT_MESSAGES[stageConfig.type];
        const firstName = client.name?.split(" ")[0] || "";
        const message = template.replace(/\{nome\}/g, firstName);

        // Send via org's own WhatsApp instance
        const sent = await sendWhatsApp(phone, message, instanceName);

        // Log with instance info for auditability
        await supabase.from("recurrence_message_log").insert({
          organization_id: orgId,
          recurrence_entry_id: entry.id,
          client_id: entry.client_id,
          message_type: stageConfig.type,
          content: message.substring(0, 500),
          status: sent ? "sent" : "failed",
          sent_at: sent ? new Date().toISOString() : null,
        });

        if (sent) {
          const updates: Record<string, any> = {
            updated_at: new Date().toISOString(),
            [stageConfig.sentField]: new Date().toISOString(),
            stage: stageConfig.dbStage,
          };

          if (stageConfig.nextMonths !== null) {
            updates.next_action_date = new Date(
              completedDate.getTime() + stageConfig.nextMonths * 30.44 * 24 * 60 * 60 * 1000
            ).toISOString().split("T")[0];
          } else {
            updates.next_action_date = new Date(
              now.getTime() + 30 * 24 * 60 * 60 * 1000
            ).toISOString().split("T")[0];
          }

          await supabase.from("recurrence_entries").update(updates).eq("id", entry.id);
          orgSent++;
          console.log(`[RECURRENCE] ${orgId}: Sent to ${entry.client_id} via instance=${instanceName}`);
        } else {
          orgErrors++;
        }

        // Delay between messages
        await new Promise(r => setTimeout(r, 3000));
      }

      results.push({ org_id: orgId, sent: orgSent, blocked: orgBlocked, errors: orgErrors, no_whatsapp: false });
      console.log(`[RECURRENCE] ${orgId}: sent=${orgSent} blocked=${orgBlocked} errors=${orgErrors}`);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[RECURRENCE] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
