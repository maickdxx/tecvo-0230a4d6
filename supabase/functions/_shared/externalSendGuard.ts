/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║        EXTERNAL SEND GUARD — Central Governance Layer           ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  Every outbound message to a CLIENT, LEAD, or EXTERNAL contact  ║
 * ║  MUST pass through this guard before being sent.                ║
 * ║                                                                  ║
 * ║  INTERNAL sends (to org owner/members) are EXEMPT.              ║
 * ║                                                                  ║
 * ║  This module enforces:                                          ║
 * ║  1. Source classification (who/what triggered the send)         ║
 * ║  2. Confirmation validation for interactive flows               ║
 * ║  3. Audit logging of every decision (allow/block)               ║
 * ║  4. Single source of truth for external send policy             ║
 * ║                                                                  ║
 * ║  Allowed external send sources:                                 ║
 * ║  • "manual_agent"      — Agent typing in inbox (always allowed) ║
 * ║  • "bot_engine"        — Chatbot flow step (allowed)            ║
 * ║  • "scheduled_message" — Scheduled by agent (allowed)           ║
 * ║  • "reminder"          — Agent-triggered reminder (allowed)     ║
 * ║  • "auto_notify"       — Product notification (allowed w/ flag) ║
 * ║  • "ai_tool_self"      — Laura sending PDF to requestor (OK)   ║
 * ║  • "ai_tool_client"    — Laura sending to client (REQUIRES      ║
 * ║                          confirmed=true + persisted state)      ║
 * ║                                                                  ║
 * ║  BLOCKED sources (no external send allowed):                    ║
 * ║  • "ai_autonomous"     — AI deciding on its own                 ║
 * ║  • "unknown"           — Unclassified origin                    ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

export type ExternalSendSource =
  | "manual_agent"
  | "bot_engine"
  | "scheduled_message"
  | "reminder"
  | "auto_notify"
  | "ai_tool_self"
  | "ai_tool_client"
  | "ai_autonomous"
  | "unknown";

export interface ExternalSendRequest {
  source: ExternalSendSource;
  organizationId: string;
  contactId?: string | null;
  recipientPhone?: string | null;
  /** Is the recipient internal (org owner/member)? */
  isInternal: boolean;
  /** For ai_tool_client: was confirmation explicitly persisted? */
  confirmed?: boolean;
  /** For ai_tool_client: the pending_service_id from DB state */
  persistedServiceId?: string | null;
  /** For ai_tool_client: the service_id being sent */
  requestedServiceId?: string | null;
  /** Description for audit log */
  messagePreview?: string;
  /** Which function/module triggered this */
  functionName: string;
}

export interface ExternalSendDecision {
  allowed: boolean;
  reason: string;
  detail?: string;
}

/**
 * Central gate for all external sends.
 * Returns { allowed, reason, detail }.
 * Logs every decision to whatsapp_message_log.
 */
export async function checkExternalSendPermission(
  supabase: any,
  request: ExternalSendRequest,
): Promise<ExternalSendDecision> {
  const {
    source,
    organizationId,
    contactId,
    isInternal,
    confirmed,
    persistedServiceId,
    requestedServiceId,
    messagePreview,
    functionName,
  } = request;

  // ── RULE 1: Internal sends are always allowed ──
  if (isInternal) {
    await logDecision(supabase, organizationId, contactId, source, functionName, true, "internal_recipient", messagePreview);
    return { allowed: true, reason: "internal_recipient" };
  }

  // ── RULE 2: Block unknown/autonomous sources ──
  if (source === "ai_autonomous" || source === "unknown") {
    await logDecision(supabase, organizationId, contactId, source, functionName, false, "blocked_autonomous_or_unknown", messagePreview);
    return {
      allowed: false,
      reason: "blocked_autonomous_or_unknown",
      detail: `External sends from source "${source}" are not allowed. All external sends require explicit authorization.`,
    };
  }

  // ── RULE 3: AI tool sending to client requires real confirmation ──
  if (source === "ai_tool_client") {
    if (!confirmed) {
      await logDecision(supabase, organizationId, contactId, source, functionName, false, "missing_confirmation", messagePreview);
      return {
        allowed: false,
        reason: "missing_confirmation",
        detail: "AI tool send to client requires confirmed=true with persisted state.",
      };
    }

    // Validate that the confirmation matches the persisted state
    if (requestedServiceId && persistedServiceId && requestedServiceId !== persistedServiceId) {
      await logDecision(supabase, organizationId, contactId, source, functionName, false, "confirmation_mismatch", messagePreview);
      return {
        allowed: false,
        reason: "confirmation_mismatch",
        detail: `Persisted service_id (${persistedServiceId}) does not match requested (${requestedServiceId}).`,
      };
    }

    await logDecision(supabase, organizationId, contactId, source, functionName, true, "confirmed_by_user", messagePreview);
    return { allowed: true, reason: "confirmed_by_user" };
  }

  // ── RULE 4: AI tool sending to self (internal) — always allowed ──
  if (source === "ai_tool_self") {
    await logDecision(supabase, organizationId, contactId, source, functionName, true, "self_send", messagePreview);
    return { allowed: true, reason: "self_send" };
  }

  // ── RULE 5: Agent-initiated sources (manual, bot, scheduled, reminder) — allowed ──
  if (["manual_agent", "bot_engine", "scheduled_message", "reminder"].includes(source)) {
    await logDecision(supabase, organizationId, contactId, source, functionName, true, "agent_or_product_flow", messagePreview);
    return { allowed: true, reason: "agent_or_product_flow" };
  }

  // ── RULE 6: Product automations (auto_notify) — allowed but logged ──
  if (source === "auto_notify") {
    await logDecision(supabase, organizationId, contactId, source, functionName, true, "product_automation", messagePreview);
    return { allowed: true, reason: "product_automation" };
  }

  // ── DEFAULT: Block anything not explicitly allowed ──
  await logDecision(supabase, organizationId, contactId, source, functionName, false, "unrecognized_source", messagePreview);
  return {
    allowed: false,
    reason: "unrecognized_source",
    detail: `Source "${source}" is not in the allow list.`,
  };
}

/**
 * Log every send decision to whatsapp_message_log for full auditability.
 */
async function logDecision(
  supabase: any,
  organizationId: string,
  contactId: string | null | undefined,
  source: string,
  functionName: string,
  allowed: boolean,
  reason: string,
  messagePreview?: string,
): Promise<void> {
  try {
    await supabase.from("whatsapp_message_log").insert({
      organization_id: organizationId,
      contact_id: contactId || null,
      source: `external_guard:${source}`,
      status: allowed ? "sent" : "blocked",
      blocked_reason: allowed ? null : reason,
      message_preview: messagePreview ? messagePreview.substring(0, 200) : `[${functionName}] ${reason}`,
    });
  } catch (err: any) {
    console.error("[EXTERNAL-SEND-GUARD] Log error:", err.message);
  }
}
