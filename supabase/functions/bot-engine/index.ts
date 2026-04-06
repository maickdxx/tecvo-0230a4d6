/**
 * ── SEND FLOW: CUSTOMER_CONVERSATION ──
 * Bot-driven automated responses within customer conversations.
 * STRICT channel isolation: uses ONLY the contact's bound channel.
 * NO fallback to any other channel or instance. No channel → BLOCK.
 */
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkSendLimit } from "../_shared/sendGuard.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_EXECUTION_STEPS = 40;
const CONTACT_SEND_COOLDOWN_MS = 3200;
const MAX_SEND_GUARD_RETRIES = 4;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action } = body;

    if (action === "start") {
      const { bot_id, contact_id, organization_id } = body;

      const { data: existing } = await supabase
        .from("whatsapp_bot_executions")
        .select("id")
        .eq("bot_id", bot_id)
        .eq("contact_id", contact_id)
        .in("status", ["running", "waiting"])
        .limit(1);

      if (existing && existing.length > 0) {
        return new Response(JSON.stringify({ error: "Bot já em execução para este contato" }), {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: connections } = await supabase
        .from("whatsapp_bot_connections")
        .select("from_step_id, to_step_id")
        .eq("bot_id", bot_id);

      const triggerConn = (connections || []).find((c: any) => c.from_step_id === null);
      let firstStep: { id: string } | undefined;

      if (triggerConn) {
        firstStep = { id: (triggerConn as any).to_step_id };
      } else {
        const { data: steps } = await supabase
          .from("whatsapp_bot_steps")
          .select("id")
          .eq("bot_id", bot_id);

        const targetIds = new Set((connections || []).map((c: any) => c.to_step_id));
        firstStep = (steps || []).find((s: any) => !targetIds.has(s.id));
      }

      if (!firstStep) {
        return new Response(JSON.stringify({ error: "Bot não possui etapas" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: execution, error } = await supabase
        .from("whatsapp_bot_executions")
        .insert({
          bot_id,
          contact_id,
          organization_id,
          current_step_id: firstStep.id,
          status: "running",
        })
        .select()
        .single();

      if (error) throw error;

      const { data: botData } = await supabase
        .from("whatsapp_bots")
        .select("execution_count")
        .eq("id", bot_id)
        .single();

      await supabase
        .from("whatsapp_bots")
        .update({
          execution_count: ((botData as any)?.execution_count || 0) + 1,
          last_executed_at: new Date().toISOString(),
        })
        .eq("id", bot_id);

      await executeStep(supabase, execution.id, firstStep.id, contact_id, bot_id, organization_id, 0);

      return new Response(JSON.stringify({ success: true, execution_id: execution.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "process_waiting") {
      const now = new Date().toISOString();
      const zombieThreshold = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes

      // Clean up zombie executions stuck in "running" for too long
      const { data: zombies } = await supabase
        .from("whatsapp_bot_executions")
        .select("id")
        .eq("status", "running")
        .lt("started_at", zombieThreshold)
        .limit(50);

      for (const z of zombies || []) {
        await supabase
          .from("whatsapp_bot_executions")
          .update({
            status: "error",
            error_message: "Execução expirou (timeout de 10 minutos)",
            completed_at: new Date().toISOString(),
          })
          .eq("id", (z as any).id)
          .eq("status", "running"); // extra safety

        await logExecution(supabase, (z as any).id, null, "zombie_cleanup", { threshold: "10min" });
        console.warn(`[BOT-ENGINE] Zombie execution cleaned: ${(z as any).id}`);
      }

      // Process standard delay waits
      const { data: waitingExecs } = await supabase
        .from("whatsapp_bot_executions")
        .select("*")
        .eq("status", "waiting")
        .lte("wait_until", now)
        .limit(50);

      // Process wait_response timeouts
      const { data: waitingResponseExecs } = await supabase
        .from("whatsapp_bot_executions")
        .select("*")
        .eq("status", "waiting_response")
        .lte("wait_until", now)
        .limit(50);

      let processed = 0;

      // Handle standard delays → follow "default" branch
      for (const exec of waitingExecs || []) {
        const e = exec as any;

        const { data: nextConns } = await supabase
          .from("whatsapp_bot_connections")
          .select("to_step_id")
          .eq("from_step_id", e.current_step_id)
          .eq("bot_id", e.bot_id)
          .eq("condition_branch", "default");

        const validNextConns = (nextConns || []).filter((c: any) => c.to_step_id && c.to_step_id !== e.current_step_id);

        if (validNextConns.length > 0) {
          const nextStepId = (validNextConns[0] as any).to_step_id;
          await supabase
            .from("whatsapp_bot_executions")
            .update({ current_step_id: nextStepId, status: "running", wait_until: null })
            .eq("id", e.id);

          await executeStep(supabase, e.id, nextStepId, e.contact_id, e.bot_id, e.organization_id, 0);
        } else {
          await supabase
            .from("whatsapp_bot_executions")
            .update({ status: "completed", completed_at: new Date().toISOString(), wait_until: null })
            .eq("id", e.id);
        }

        processed++;
      }

      // Handle wait_response timeouts → follow "timeout" branch
      for (const exec of waitingResponseExecs || []) {
        const e = exec as any;

        const { data: nextConns } = await supabase
          .from("whatsapp_bot_connections")
          .select("to_step_id")
          .eq("from_step_id", e.current_step_id)
          .eq("bot_id", e.bot_id)
          .eq("condition_branch", "timeout");

        const validNextConns = (nextConns || []).filter((c: any) => c.to_step_id && c.to_step_id !== e.current_step_id);

        if (validNextConns.length > 0) {
          const nextStepId = (validNextConns[0] as any).to_step_id;
          await supabase
            .from("whatsapp_bot_executions")
            .update({ current_step_id: nextStepId, status: "running", wait_until: null })
            .eq("id", e.id);

          await executeStep(supabase, e.id, nextStepId, e.contact_id, e.bot_id, e.organization_id, 0);
        } else {
          await supabase
            .from("whatsapp_bot_executions")
            .update({ status: "completed", completed_at: new Date().toISOString(), wait_until: null })
            .eq("id", e.id);
        }

        processed++;
      }

      return new Response(JSON.stringify({ success: true, processed, zombies_cleaned: (zombies || []).length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "resume") {
      const { contact_id, message } = body;

      const { data: execution, error: execError } = await supabase
        .from("whatsapp_bot_executions")
        .select("*")
        .eq("contact_id", contact_id)
        .in("status", ["waiting_input", "waiting_response"])
        .order("started_at", { ascending: false })
        .limit(1)
        .single();

      if (execError || !execution) {
        return new Response(JSON.stringify({ success: false, message: "No execution to resume" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const e = execution as any;

      await logExecution(supabase, e.id, e.current_step_id, "resumed_by_user", { message });

      if (e.status === "waiting_input") {
        const { data: step } = await supabase
          .from("whatsapp_bot_steps")
          .select("*")
          .eq("id", e.current_step_id)
          .single();

        if (step) {
          const s = step as any;
          const config = s.config || {};
          if (config.capture_field) {
            const field = config.capture_field;
            const value = message;
            const updateData: any = {};
            
            if (["name", "email", "phone", "internal_note"].includes(field)) {
              updateData[field] = value;
            } else {
              const { data: contact } = await supabase
                .from("whatsapp_contacts")
                .select("visitor_metadata")
                .eq("id", contact_id)
                .single();
              const metadata = (contact as any)?.visitor_metadata || {};
              metadata[field] = value;
              updateData.visitor_metadata = metadata;
            }

            await supabase
              .from("whatsapp_contacts")
              .update(updateData)
              .eq("id", contact_id);
            
            await logExecution(supabase, e.id, s.id, "input_captured", { field, value });
          }
        }
      }

      const { data: nextConns } = await supabase
        .from("whatsapp_bot_connections")
        .select("to_step_id")
        .eq("from_step_id", e.current_step_id)
        .eq("bot_id", e.bot_id)
        .eq("condition_branch", "default");

      const validNextConns = (nextConns || []).filter((c: any) => c.to_step_id && c.to_step_id !== e.current_step_id);

      if (validNextConns.length > 0) {
        const nextStepId = (validNextConns[0] as any).to_step_id;
        await supabase
          .from("whatsapp_bot_executions")
          .update({ current_step_id: nextStepId, status: "running", wait_until: null })
          .eq("id", e.id);

        await executeStep(supabase, e.id, nextStepId, contact_id, e.bot_id, e.organization_id, 0);
      } else {
        await supabase
          .from("whatsapp_bot_executions")
          .update({ status: "completed", completed_at: new Date().toISOString(), wait_until: null })
          .eq("id", e.id);
      }

      return new Response(JSON.stringify({ success: true, execution_id: e.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "stop") {
      const { execution_id } = body;

      await supabase
        .from("whatsapp_bot_executions")
        .update({ status: "stopped", completed_at: new Date().toISOString() })
        .eq("id", execution_id);

      await logExecution(supabase, execution_id, null, "stopped", { reason: "manual" });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Bot engine error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFirstNonEmptyString(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === "string") {
      const normalized = value.trim();
      if (normalized) return normalized;
    }
  }
  return "";
}

function getFirstName(value: unknown): string {
  const normalized = getFirstNonEmptyString(value).replace(/\s+/g, " ");
  return normalized ? normalized.split(" ")[0] : "";
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

/** Resolve {{variable}} placeholders using contact + org data */
async function resolveMessageVariables(
  supabase: any,
  template: string,
  contactId: string,
  orgId: string,
): Promise<string> {
  if (!template || !template.includes("{{")) return template;

  const { data: contact, error: contactError } = await supabase
    .from("whatsapp_contacts")
    .select("name, phone, whatsapp_id, linked_client_id, linked_service_id, assigned_to, visitor_metadata")
    .eq("id", contactId)
    .single();

  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("name, phone, website, whatsapp_owner, owner_id")
    .eq("id", orgId)
    .single();

  if (contactError) {
    console.warn(`[BOT-ENGINE] Falha ao carregar contato ${contactId} para resolver variáveis: ${contactError.message}`);
  }

  if (orgError) {
    console.warn(`[BOT-ENGINE] Falha ao carregar organização ${orgId} para resolver variáveis: ${orgError.message}`);
  }

  const c = contact as any;
  const o = org as any;
  const visitorMetadata = asRecord(c?.visitor_metadata);

  let client: any = null;
  if (c?.linked_client_id) {
    const { data, error } = await supabase
      .from("clients")
      .select("name, email, phone, company_name, trade_name, contact_name")
      .eq("id", c.linked_client_id)
      .maybeSingle();

    if (error) {
      console.warn(`[BOT-ENGINE] Falha ao carregar cliente ${c.linked_client_id}: ${error.message}`);
    }

    client = data;
  }

  let service: any = null;
  if (c?.linked_service_id) {
    const { data, error } = await supabase
      .from("services")
      .select("assigned_to")
      .eq("id", c.linked_service_id)
      .maybeSingle();

    if (error) {
      console.warn(`[BOT-ENGINE] Falha ao carregar serviço ${c.linked_service_id}: ${error.message}`);
    }

    service = data;
  }

  const assignedUserId = c?.assigned_to || service?.assigned_to || null;
  let assignedProfile: any = null;

  if (assignedUserId) {
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("user_id", assignedUserId)
      .maybeSingle();

    if (error) {
      console.warn(`[BOT-ENGINE] Falha ao carregar atendente ${assignedUserId}: ${error.message}`);
    }

    assignedProfile = data;
  }

  const fullClientName = getFirstNonEmptyString(
    c?.name,
    client?.contact_name,
    client?.name,
    visitorMetadata.name,
    visitorMetadata.first_name,
  );
  const attendantFullName = getFirstNonEmptyString(assignedProfile?.full_name);

  const values: Record<string, string> = {
    primeiro_nome: getFirstName(fullClientName),
    nome_completo: fullClientName,
    telefone: getFirstNonEmptyString(c?.phone, client?.phone, c?.whatsapp_id),
    email: getFirstNonEmptyString(visitorMetadata.email, client?.email),
    empresa_cliente: getFirstNonEmptyString(visitorMetadata.company, client?.company_name, client?.trade_name),
    primeiro_nome_atendente: getFirstName(attendantFullName),
    atendente_nome: getFirstName(attendantFullName),
    nome_empresa: o?.name || "",
    telefone_empresa: o?.phone || "",
    whatsapp_empresa: o?.whatsapp_owner || "",
    site_empresa: o?.website || "",
  };

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key) => {
    return values[key] ?? "";
  });
}

async function executeStep(
  supabase: any,
  executionId: string,
  stepId: string,
  contactId: string,
  botId: string,
  orgId: string,
  depth = 0,
) {
  if (depth >= MAX_EXECUTION_STEPS) {
    const message = "Loop detectado no fluxo do bot (limite de etapas excedido)";

    await supabase
      .from("whatsapp_bot_executions")
      .update({
        status: "error",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", executionId);

    await logExecution(supabase, executionId, stepId, "execution_error", { message, depth });
    return;
  }

  const { data: step } = await supabase.from("whatsapp_bot_steps").select("*").eq("id", stepId).single();

  if (!step) {
    await supabase
      .from("whatsapp_bot_executions")
      .update({ status: "error", error_message: "Step not found" })
      .eq("id", executionId);
    return;
  }

  const s = step as any;
  const config = s.config || {};

  await logExecution(supabase, executionId, stepId, `executing_${s.step_type}`, config);

  try {
    switch (s.step_type) {
      case "send_message": {
        if (config.message) {
          const resolved = await resolveChannelAndPhone(supabase, orgId, contactId);
          if (!resolved) throw new Error("Canal ou contato não encontrado para envio");

          const resolvedMsg = await resolveMessageVariables(supabase, config.message, contactId, orgId);
          await sendTextMessage(resolved.instanceName, resolved.recipientJid, resolvedMsg, supabase, orgId, contactId);

          await supabase.from("whatsapp_messages").insert({
            contact_id: contactId,
            channel_id: resolved.channelId,
            organization_id: orgId,
            message_id: `out_${crypto.randomUUID()}`,
            content: resolvedMsg,
            is_from_me: true,
            status: "sent",
          });

          await supabase
            .from("whatsapp_contacts")
            .update({ last_message_at: new Date().toISOString() })
            .eq("id", contactId);
        }
        break;
      }

      case "send_image":
      case "send_video":
      case "send_document": {
        if (!config.media_url) {
          throw new Error(`Etapa ${s.step_type} sem media_url configurada`);
        }

        const resolved = await resolveChannelAndPhone(supabase, orgId, contactId);
        if (!resolved) throw new Error("Canal ou contato não encontrado para envio");

        const mediaType = s.step_type === "send_image"
          ? "image"
          : s.step_type === "send_video"
          ? "video"
          : "document";
        const resolvedCaption = config.caption
          ? await resolveMessageVariables(supabase, config.caption, contactId, orgId)
          : undefined;

        await sendMediaMessage(
          resolved.instanceName,
          resolved.recipientJid,
          mediaType,
          config.media_url,
          resolvedCaption,
          config.file_name,
          supabase,
          orgId,
          contactId,
        );

        await supabase.from("whatsapp_messages").insert({
          contact_id: contactId,
          channel_id: resolved.channelId,
          organization_id: orgId,
          message_id: `out_${crypto.randomUUID()}`,
          content: resolvedCaption || "",
          media_url: config.media_url,
          media_type: mediaType,
          is_from_me: true,
          status: "sent",
        });

        await supabase
          .from("whatsapp_contacts")
          .update({ last_message_at: new Date().toISOString() })
          .eq("id", contactId);

        break;
      }

      case "add_tag": {
        if (config.tag_name) {
          const { data: contact } = await supabase
            .from("whatsapp_contacts")
            .select("tags")
            .eq("id", contactId)
            .single();

          const tags: string[] = (contact as any)?.tags || [];
          if (!tags.includes(config.tag_name)) {
            await supabase
              .from("whatsapp_contacts")
              .update({ tags: [...tags, config.tag_name] })
              .eq("id", contactId);
          }
        }
        break;
      }

      case "remove_tag": {
        if (config.tag_name) {
          const { data: contact } = await supabase
            .from("whatsapp_contacts")
            .select("tags")
            .eq("id", contactId)
            .single();

          const tags: string[] = (contact as any)?.tags || [];
          await supabase
            .from("whatsapp_contacts")
            .update({ tags: tags.filter((t: string) => t !== config.tag_name) })
            .eq("id", contactId);
        }
        break;
      }

      case "resolve": {
        await supabase.from("whatsapp_contacts").update({ conversation_status: "resolvido" }).eq("id", contactId);
        break;
      }

      case "reopen": {
        await supabase.from("whatsapp_contacts").update({ conversation_status: "novo" }).eq("id", contactId);
        break;
      }

      case "assign": {
        if (config.assign_to) {
          await supabase.from("whatsapp_contacts").update({ assigned_to: config.assign_to }).eq("id", contactId);
        }
        break;
      }

      case "unassign": {
        await supabase.from("whatsapp_contacts").update({ assigned_to: null }).eq("id", contactId);
        break;
      }

      case "delay": {
        const waitUntil = calculateWaitUntil(config);
        await supabase
          .from("whatsapp_bot_executions")
          .update({ status: "waiting", wait_until: waitUntil.toISOString() })
          .eq("id", executionId);
        return;
      }

      case "condition": {
        const result = await evaluateCondition(supabase, config, contactId);
        const branch = result ? "true" : "false";

        const { data: nextConns } = await supabase
          .from("whatsapp_bot_connections")
          .select("to_step_id")
          .eq("from_step_id", stepId)
          .eq("bot_id", botId)
          .eq("condition_branch", branch);

        const validNextConns = (nextConns || []).filter((c: any) => c.to_step_id && c.to_step_id !== stepId);

        if (validNextConns.length > 0) {
          const nextStepId = (validNextConns[0] as any).to_step_id;
          await supabase.from("whatsapp_bot_executions").update({ current_step_id: nextStepId }).eq("id", executionId);
          await executeStep(supabase, executionId, nextStepId, contactId, botId, orgId, depth + 1);
        } else {
          if ((nextConns || []).some((c: any) => c.to_step_id === stepId)) {
            await logExecution(supabase, executionId, stepId, "self_loop_ignored", { branch });
          }

          await supabase
            .from("whatsapp_bot_executions")
            .update({ status: "completed", completed_at: new Date().toISOString() })
            .eq("id", executionId);
        }

        return;
      }

      case "internal_note": {
        await logExecution(supabase, executionId, stepId, "internal_note", { note: config.note });
        break;
      }

      case "send_buttons": {
        if (config.question && config.buttons?.length > 0) {
          const resolved = await resolveChannelAndPhone(supabase, orgId, contactId);
          if (!resolved) throw new Error("Canal ou contato não encontrado para envio");
          const resolvedQuestion = await resolveMessageVariables(supabase, config.question, contactId, orgId);
          const resolvedFooter = config.footer
            ? await resolveMessageVariables(supabase, config.footer, contactId, orgId)
            : "";
          const { sentContent } = await sendButtonsMessage(
            resolved.instanceName,
            resolved.recipientJid,
            resolvedQuestion,
            config.buttons as string[],
            resolvedFooter,
            supabase,
            orgId,
            contactId,
          );

          await supabase.from("whatsapp_messages").insert({
            contact_id: contactId,
            channel_id: resolved.channelId,
            organization_id: orgId,
            message_id: `out_${crypto.randomUUID()}`,
            content: sentContent,
            is_from_me: true,
            status: "sent",
          });
        }
        break;
      }

      case "capture_input": {
        // Send prompt message to client
        if (config.prompt_message) {
          const resolved = await resolveChannelAndPhone(supabase, orgId, contactId);
          if (!resolved) throw new Error("Canal ou contato não encontrado para envio");

          const resolvedPrompt = await resolveMessageVariables(supabase, config.prompt_message, contactId, orgId);
          await sendTextMessage(resolved.instanceName, resolved.recipientJid, resolvedPrompt, supabase, orgId, contactId);

          await supabase.from("whatsapp_messages").insert({
            contact_id: contactId,
            channel_id: resolved.channelId,
            organization_id: orgId,
            message_id: `out_${crypto.randomUUID()}`,
            content: resolvedPrompt,
            is_from_me: true,
            status: "sent",
          });
        }

        // Set execution to waiting for client response
        await supabase
          .from("whatsapp_bot_executions")
          .update({
            status: "waiting_input",
            wait_until: null,
            current_step_id: stepId,
          })
          .eq("id", executionId);

        await logExecution(supabase, executionId, stepId, "waiting_input", {
          field: config.capture_field,
          field_label: config.field_label,
        });
        return; // Stop execution — will resume when client responds
      }

      case "transfer_human": {
        // Send transfer message to client
        if (config.message) {
          const resolved = await resolveChannelAndPhone(supabase, orgId, contactId);
          if (!resolved) throw new Error("Canal ou contato não encontrado para envio");

          const resolvedTransferMsg = await resolveMessageVariables(supabase, config.message, contactId, orgId);
          await sendTextMessage(resolved.instanceName, resolved.recipientJid, resolvedTransferMsg, supabase, orgId, contactId);

          await supabase.from("whatsapp_messages").insert({
            contact_id: contactId,
            channel_id: resolved.channelId,
            organization_id: orgId,
            message_id: `out_${crypto.randomUUID()}`,
            content: resolvedTransferMsg,
            is_from_me: true,
            status: "sent",
          });
        }

        // Assign to specific agent or mark as needing human attention
        const updateData: Record<string, any> = {
          conversation_status: "novo",
          is_unread: true,
        };
        if (config.assign_to) {
          updateData.assigned_to = config.assign_to;
        }

        await supabase.from("whatsapp_contacts").update(updateData).eq("id", contactId);

        // Complete the bot execution — hand off to human
        await supabase
          .from("whatsapp_bot_executions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", executionId);

        await logExecution(supabase, executionId, stepId, "transferred_to_human", {
          assign_to: config.assign_to || "queue",
        });
        return;
      }

      case "end_flow": {
        // Send closing message if configured
        if (config.message) {
          const resolved = await resolveChannelAndPhone(supabase, orgId, contactId);
          if (resolved) {
            const resolvedEndMsg = await resolveMessageVariables(supabase, config.message, contactId, orgId);
            await sendTextMessage(resolved.instanceName, resolved.recipientJid, resolvedEndMsg, supabase, orgId, contactId);

            await supabase.from("whatsapp_messages").insert({
              contact_id: contactId,
              channel_id: resolved.channelId,
              organization_id: orgId,
              message_id: `out_${crypto.randomUUID()}`,
              content: resolvedEndMsg,
              is_from_me: true,
              status: "sent",
            });
          }
        }

        // Mark conversation as resolved if configured
        if (config.mark_resolved !== false) {
          await supabase.from("whatsapp_contacts").update({ conversation_status: "resolvido" }).eq("id", contactId);
        }

        // Complete execution
        await supabase
          .from("whatsapp_bot_executions")
          .update({ status: "completed", completed_at: new Date().toISOString() })
          .eq("id", executionId);

        await logExecution(supabase, executionId, stepId, "flow_ended", {
          mark_resolved: config.mark_resolved !== false,
        });
        return;
      }

      case "wait_response": {
        const timeoutMinutes = config.timeout_minutes || 30;
        const waitUntil = new Date(Date.now() + timeoutMinutes * 60 * 1000);

        // Send reminder if configured
        if (config.reminder_message && config.reminder_after_minutes) {
          const reminderAt = new Date(Date.now() + config.reminder_after_minutes * 60 * 1000);
          await logExecution(supabase, executionId, stepId, "reminder_scheduled", {
            reminder_at: reminderAt.toISOString(),
            message: config.reminder_message,
          });
        }

        await supabase
          .from("whatsapp_bot_executions")
          .update({
            status: "waiting_response",
            wait_until: waitUntil.toISOString(),
            current_step_id: stepId,
          })
          .eq("id", executionId);

        await logExecution(supabase, executionId, stepId, "waiting_response", {
          timeout_minutes: timeoutMinutes,
          wait_until: waitUntil.toISOString(),
        });
        return; // Will be resolved by webhook (client responds) or process_waiting (timeout)
      }
    }

    const { data: nextConns } = await supabase
      .from("whatsapp_bot_connections")
      .select("to_step_id")
      .eq("from_step_id", stepId)
      .eq("bot_id", botId)
      .eq("condition_branch", "default");

    const validNextConns = (nextConns || []).filter((c: any) => c.to_step_id && c.to_step_id !== stepId);

    if (validNextConns.length > 0) {
      const nextStepId = (validNextConns[0] as any).to_step_id;
      await supabase.from("whatsapp_bot_executions").update({ current_step_id: nextStepId }).eq("id", executionId);
      await executeStep(supabase, executionId, nextStepId, contactId, botId, orgId, depth + 1);
    } else {
      if ((nextConns || []).some((c: any) => c.to_step_id === stepId)) {
        await logExecution(supabase, executionId, stepId, "self_loop_ignored", { branch: "default" });
      }

      await supabase
        .from("whatsapp_bot_executions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", executionId);
    }
  } catch (err: any) {
    console.error(`[BOT-ENGINE] Step ${stepId} error:`, err.message);
    await logExecution(supabase, executionId, stepId, "step_error", { message: err.message, step_type: s.step_type });

    // Non-critical errors: log and try to continue to next step
    // Critical errors (channel not found, bridge not configured): abort
    const isCritical = err.message?.includes("Canal ou contato não encontrado") ||
                       err.message?.includes("bridge não configurado") ||
                       err.message?.includes("Envio bloqueado");

    if (isCritical) {
      console.error(`[BOT-ENGINE] Critical error — aborting execution ${executionId}`);
      await supabase
        .from("whatsapp_bot_executions")
        .update({ status: "error", error_message: err.message })
        .eq("id", executionId);
      return;
    }

    // Non-critical: try to continue to next step
    console.warn(`[BOT-ENGINE] Non-critical error on step ${stepId}, attempting to continue flow...`);
    const { data: recoveryConns } = await supabase
      .from("whatsapp_bot_connections")
      .select("to_step_id")
      .eq("from_step_id", stepId)
      .eq("bot_id", botId)
      .eq("condition_branch", "default");

    const validRecovery = (recoveryConns || []).filter((c: any) => c.to_step_id && c.to_step_id !== stepId);

    if (validRecovery.length > 0) {
      const nextStepId = (validRecovery[0] as any).to_step_id;
      await supabase.from("whatsapp_bot_executions").update({ current_step_id: nextStepId }).eq("id", executionId);
      await executeStep(supabase, executionId, nextStepId, contactId, botId, orgId, depth + 1);
    } else {
      await supabase
        .from("whatsapp_bot_executions")
        .update({ status: "completed", completed_at: new Date().toISOString(), error_message: `Concluído com erro na etapa: ${err.message}` })
        .eq("id", executionId);
    }
  }
}

function normalizePhone(input: string): string {
  return (input || "").split("@")[0].replace(/\D/g, "");
}

async function resolveChannelAndPhone(
  supabase: any,
  orgId: string,
  contactId: string,
): Promise<{ channelId: string; instanceName: string; recipientJid: string } | null> {
  // Get the contact first to find their channel_id
  const { data: contact } = await supabase
    .from("whatsapp_contacts")
    .select("phone, whatsapp_id, normalized_phone, channel_id")
    .eq("id", contactId)
    .single();

  if (!contact) return null;

  const c = contact as any;
  let channel: any = null;

  // 1. Try to use the contact's own channel (the channel they're chatting on)
  if (c.channel_id) {
    const { data: contactChannel } = await supabase
      .from("whatsapp_channels")
      .select("id, instance_name")
      .eq("id", c.channel_id)
      .eq("is_connected", true)
      .single();
    channel = contactChannel;
  }

  // 2. STRICT: No fallback to other channels — isolamento total
  if (!channel) {
    console.warn(`[BOT-ENGINE] Channel not available for contact ${contactId} (channel_id: ${c.channel_id || "null"}). Blocking send — no fallback allowed.`);
    return null;
  }

  const digits = c.normalized_phone || normalizePhone(c.phone || c.whatsapp_id || "");
  if (!digits) return null;

  return {
    channelId: (channel as any).id,
    instanceName: (channel as any).instance_name,
    recipientJid: `${digits}@s.whatsapp.net`,
  };
}

async function ensureSendAllowedWithRetry(
  supabase: any,
  orgId: string,
  contactId: string | null,
  source: string,
) {
  if (!supabase || !orgId) return;

  let lastDetail = "limite de segurança";

  for (let attempt = 0; attempt < MAX_SEND_GUARD_RETRIES; attempt++) {
    const guard = await checkSendLimit(supabase, orgId, contactId, source);

    if (guard.allowed) return;

    lastDetail = guard.detail || lastDetail;

    if (guard.reason === "cooldown" && contactId && attempt < MAX_SEND_GUARD_RETRIES - 1) {
      console.info(`[BOT-ENGINE] Cooldown do contato ${contactId}; aguardando ${CONTACT_SEND_COOLDOWN_MS}ms para reenviar (${attempt + 1}/${MAX_SEND_GUARD_RETRIES})`);
      await sleep(CONTACT_SEND_COOLDOWN_MS);
      continue;
    }

    console.warn(`[BOT-ENGINE] Send blocked by guard: ${guard.reason} — ${guard.detail}`);
    throw new Error(`Envio bloqueado: ${lastDetail}`);
  }

  throw new Error(`Envio bloqueado: ${lastDetail}`);
}

function getWhatsAppBridgeConfig() {
  const vpsUrl = Deno.env.get("WHATSAPP_VPS_URL");
  const apiKey = Deno.env.get("WHATSAPP_BRIDGE_API_KEY");

  if (!vpsUrl || !apiKey) {
    throw new Error("WhatsApp bridge não configurado");
  }

  return { vpsUrl, apiKey };
}

async function postTextMessage(instanceName: string, recipientJid: string, message: string) {
  const { vpsUrl, apiKey } = getWhatsAppBridgeConfig();

  const res = await fetch(`${vpsUrl}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({ number: recipientJid, text: message }),
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Falha ao enviar texto: ${details || res.status}`);
  }

  await res.text();
}

async function postMediaMessage(
  instanceName: string,
  recipientJid: string,
  mediaType: "image" | "video" | "document",
  mediaUrl: string,
  caption?: string,
  fileName?: string,
) {
  const { vpsUrl, apiKey } = getWhatsAppBridgeConfig();

  const res = await fetch(`${vpsUrl}/message/sendMedia/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      number: recipientJid,
      mediatype: mediaType,
      media: mediaUrl,
      caption: caption || undefined,
      fileName: mediaType === "document" ? fileName || "documento" : undefined,
    }),
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Falha ao enviar mídia: ${details || res.status}`);
  }

  await res.text();
}

async function sendButtonsMessage(
  instanceName: string,
  recipientJid: string,
  question: string,
  buttons: string[],
  footer = "",
  supabase?: any,
  orgId?: string,
  contactId?: string,
): Promise<{ sentContent: string }> {
  if (supabase && orgId) {
    await ensureSendAllowedWithRetry(supabase, orgId, contactId || null, "bot");
  }

  const { vpsUrl, apiKey } = getWhatsAppBridgeConfig();
  const buttonsPayload = buttons.map((text, i) => ({
    buttonId: `btn_${i}`,
    buttonText: { displayText: text },
  }));

  const res = await fetch(`${vpsUrl}/message/sendButtons/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
    body: JSON.stringify({
      number: recipientJid,
      title: "",
      description: question,
      footer,
      buttons: buttonsPayload,
    }),
  });

  if (res.ok) {
    await res.text();
    return { sentContent: question };
  }

  console.warn("Buttons API failed, falling back to text:", await res.text());
  const numberedOptions = buttons.map((button, index) => `${index + 1}. ${button}`).join("\n");
  const fallbackText = `${question}\n\n${numberedOptions}${footer ? `\n\n_${footer}_` : ""}`;
  await postTextMessage(instanceName, recipientJid, fallbackText);

  return { sentContent: fallbackText };
}

async function sendTextMessage(instanceName: string, recipientJid: string, message: string, supabase?: any, orgId?: string, contactId?: string) {
  if (supabase && orgId) {
    await ensureSendAllowedWithRetry(supabase, orgId, contactId || null, "bot");
  }

  await postTextMessage(instanceName, recipientJid, message);
}

async function sendMediaMessage(
  instanceName: string,
  recipientJid: string,
  mediaType: "image" | "video" | "document",
  mediaUrl: string,
  caption?: string,
  fileName?: string,
  supabase?: any,
  orgId?: string,
  contactId?: string,
) {
  if (supabase && orgId) {
    await ensureSendAllowedWithRetry(supabase, orgId, contactId || null, "bot");
  }

  await postMediaMessage(instanceName, recipientJid, mediaType, mediaUrl, caption, fileName);
}

function calculateWaitUntil(config: any): Date {
  const now = new Date();
  switch (config.delay_type) {
    case "minutes": return new Date(now.getTime() + (config.delay_value || 1) * 60 * 1000);
    case "hours": return new Date(now.getTime() + (config.delay_value || 1) * 60 * 60 * 1000);
    case "days": return new Date(now.getTime() + (config.delay_value || 1) * 24 * 60 * 60 * 1000);
    case "until_time": {
      const [h, m] = (config.delay_time || "08:00").split(":").map(Number);
      const target = new Date(now);
      target.setHours(h, m, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      return target;
    }
    case "until_business_hours": {
      const target = new Date(now);
      target.setHours(8, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);
      while (target.getDay() === 0 || target.getDay() === 6) {
        target.setDate(target.getDate() + 1);
      }
      return target;
    }
    default:
      return new Date(now.getTime() + 60 * 1000);
  }
}

async function evaluateCondition(supabase: any, config: any, contactId: string): Promise<boolean> {
  const { data: contact } = await supabase.from("whatsapp_contacts").select("*").eq("id", contactId).single();
  if (!contact) return false;

  const c = contact as any;

  switch (config.condition_type) {
    case "client_replied": {
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("is_from_me")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return !!lastMsg && !(lastMsg as any).is_from_me;
    }

    case "client_not_replied": {
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("is_from_me")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return !lastMsg || (lastMsg as any).is_from_me;
    }

    case "has_tag": return (c.tags || []).includes(config.condition_tag);
    case "not_has_tag": return !(c.tags || []).includes(config.condition_tag);
    case "is_assigned": return !!c.assigned_to;
    case "not_assigned": return !c.assigned_to;

    case "within_business_hours":
    case "outside_business_hours": {
      let startH = 8, startM = 0, endH = 18, endM = 0;
      let worksSaturday = false;

      if (config.use_custom_hours) {
        const [sh, sm] = (config.custom_start_time || "08:00").split(":").map(Number);
        const [eh, em] = (config.custom_end_time || "18:00").split(":").map(Number);
        startH = sh; startM = sm; endH = eh; endM = em;
        worksSaturday = config.custom_works_saturday ?? false;
      } else {
        // Try to load org's operational capacity config
        const { data: capConfig } = await supabase
          .from("operational_capacity_config")
          .select("start_time, end_time, works_saturday")
          .eq("organization_id", (await supabase.from("whatsapp_contacts").select("organization_id").eq("id", contactId).single()).data?.organization_id || "")
          .maybeSingle();

        if (capConfig) {
          const cap = capConfig as any;
          if (cap.start_time) {
            const [sh, sm] = cap.start_time.split(":").map(Number);
            startH = sh; startM = sm;
          }
          if (cap.end_time) {
            const [eh, em] = cap.end_time.split(":").map(Number);
            endH = eh; endM = em;
          }
          worksSaturday = cap.works_saturday ?? false;
        }
      }

      const now = new Date();
      const day = now.getDay(); // 0=Sun, 6=Sat
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const isSunday = day === 0;
      const isSaturday = day === 6;
      const isWorkday = !isSunday && (!isSaturday || worksSaturday);
      const isWithinHours = isWorkday && currentMinutes >= startMinutes && currentMinutes < endMinutes;

      return config.condition_type === "within_business_hours" ? isWithinHours : !isWithinHours;
    }

    case "last_message_from_client": {
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("is_from_me")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return !!lastMsg && !(lastMsg as any).is_from_me;
    }

    case "last_message_from_team": {
      const { data: lastMsg } = await supabase
        .from("whatsapp_messages")
        .select("is_from_me")
        .eq("contact_id", contactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      return !!lastMsg && (lastMsg as any).is_from_me;
    }

    default:
      return false;
  }
}

async function logExecution(supabase: any, executionId: string, stepId: string | null, action: string, details: any) {
  await supabase.from("whatsapp_bot_execution_logs").insert({
    execution_id: executionId,
    step_id: stepId,
    action,
    details,
  });
}
