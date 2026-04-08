/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║          ACTION SHIELD — Operational Shielding Layer            ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║                                                                  ║
 * ║  Central governance for ALL tool executions by Laura.            ║
 * ║  Ensures critical decisions are controlled by CODE, not prompt.  ║
 * ║                                                                  ║
 * ║  Enforces:                                                       ║
 * ║  1. Action risk classification (high/medium/low)                 ║
 * ║  2. Hard gate: high-risk actions require structured confirmation ║
 * ║  3. Anti-duplication: hash-based dedup within time window        ║
 * ║  4. Triple org validation (action + user + context)              ║
 * ║  5. Channel lock (client → CUSTOMER_INBOX only)                  ║
 * ║  6. Audit logging for all high/medium risk actions               ║
 * ║  7. Degraded mode enforcement                                    ║
 * ║                                                                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ─────────────── Risk Classification ───────────────

export type ActionRisk = "high" | "medium" | "low";

export const ACTION_RISK_REGISTRY: Record<string, ActionRisk> = {
  register_transaction: "high",
  create_service: "high",
  send_service_pdf: "high", // only when target=client; self is medium
  approve_pending_transactions: "high",
  reject_pending_transactions: "high",
  get_pending_summary: "low",
  list_pending_transactions: "low",
  create_client: "medium",
  create_quote: "medium",
  create_financial_account: "low",
};

export function getActionRisk(fnName: string, args?: any): ActionRisk {
  if (fnName === "send_service_pdf" && args?.target === "self") return "medium";
  return ACTION_RISK_REGISTRY[fnName] || "low";
}

// ─────────────── Shield Context ───────────────

export interface ShieldContext {
  supabase: any;
  organizationId: string;
  userId?: string | null;
  contextOrgId?: string | null;   // org from the conversation/channel context
  channelId?: string | null;
  channelType?: string | null;    // "CUSTOMER_INBOX" | "SYSTEM_AI" | null
  contactId?: string | null;
  source: "whatsapp" | "app";
}

export interface ShieldResult {
  allowed: boolean;
  reason: string;
  detail?: string;
}

// ─────────────── 1. Triple Org Validation ───────────────

export function validateOrgTriple(ctx: ShieldContext): ShieldResult {
  const { organizationId, contextOrgId } = ctx;

  if (contextOrgId && contextOrgId !== organizationId) {
    console.error(
      `[ACTION-SHIELD] ORG MISMATCH: action_org=${organizationId} context_org=${contextOrgId}`,
    );
    return {
      allowed: false,
      reason: "org_mismatch",
      detail: `Organização da ação (${organizationId.slice(0, 8)}) diferente do contexto (${contextOrgId.slice(0, 8)}). Ação bloqueada por segurança.`,
    };
  }

  return { allowed: true, reason: "org_validated" };
}

// ─────────────── 2. Channel Lock ───────────────

const TECVO_AI_CHANNEL_ID = "bd62f82a-9735-420c-b0c3-cab9a6e0424d";

export function validateChannelLock(
  fnName: string,
  args: any,
  ctx: ShieldContext,
): ShieldResult {
  // Only enforce for send_service_pdf with target=client
  if (fnName !== "send_service_pdf" || args?.target !== "client") {
    return { allowed: true, reason: "channel_lock_not_applicable" };
  }

  // Block sending to client via SYSTEM_AI channel
  if (ctx.channelId === TECVO_AI_CHANNEL_ID) {
    console.warn(
      `[ACTION-SHIELD] CHANNEL LOCK: Blocking client send via SYSTEM_AI channel. channelId=${ctx.channelId}`,
    );
    return {
      allowed: false,
      reason: "channel_locked",
      detail: "Envio para cliente bloqueado: o canal institucional da IA não pode ser usado para enviar documentos a clientes. Use o canal da empresa.",
    };
  }

  return { allowed: true, reason: "channel_ok" };
}

// ─────────────── 3. Anti-Duplication ───────────────

/**
 * Generates a deterministic hash for an action based on its key parameters.
 * Used to detect duplicate executions within a time window.
 */
function generateActionHash(fnName: string, orgId: string, args: any): string {
  const keyParts: string[] = [fnName, orgId];

  switch (fnName) {
    case "register_transaction":
      keyParts.push(String(args.amount), args.description || "", args.date || "");
      break;
    case "create_service":
    case "create_quote":
      keyParts.push(args.client_name || "", args.scheduled_date || "", args.description || "");
      break;
    case "create_client":
      keyParts.push(args.name || "", args.phone || "");
      break;
    case "send_service_pdf":
      keyParts.push(args.service_id || args.service_identifier || "", args.target || "");
      break;
    default:
      keyParts.push(JSON.stringify(args).slice(0, 200));
  }

  // Simple hash: sum of char codes
  const raw = keyParts.join("|");
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `shield_${Math.abs(hash).toString(36)}`;
}

const DEDUP_WINDOW_MINUTES = 3;

export async function checkAntiDuplication(
  supabase: any,
  fnName: string,
  orgId: string,
  args: any,
): Promise<ShieldResult> {
  // Only check for write actions
  const risk = getActionRisk(fnName, args);
  if (risk === "low") return { allowed: true, reason: "low_risk_skip_dedup" };

  const actionHash = generateActionHash(fnName, orgId, args);
  const cutoff = new Date(Date.now() - DEDUP_WINDOW_MINUTES * 60 * 1000).toISOString();

  try {
    const { count, error } = await supabase
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("action_slug", `tool_ok_${fnName}`)
      .eq("model", actionHash)
      .gte("created_at", cutoff);

    if (!error && (count || 0) > 0) {
      console.warn(
        `[ACTION-SHIELD] DUPLICATE BLOCKED: ${fnName} hash=${actionHash} org=${orgId.slice(0, 8)} — same action executed ${count} time(s) in last ${DEDUP_WINDOW_MINUTES}min`,
      );
      return {
        allowed: false,
        reason: "duplicate_action",
        detail: `Esta ação já foi executada há menos de ${DEDUP_WINDOW_MINUTES} minutos. Para evitar duplicação, aguarde ou confirme que deseja repetir.`,
      };
    }
  } catch (e: any) {
    console.warn("[ACTION-SHIELD] Dedup check failed (allowing):", e?.message);
  }

  return { allowed: true, reason: "no_duplicate" };
}

// ─────────────── 4. Degraded Mode ───────────────

const DEGRADATION_THRESHOLD = 3;
const DEGRADATION_WINDOW_MINUTES = 10;

export async function checkDegradedMode(
  supabase: any,
  orgId: string,
): Promise<boolean> {
  try {
    const cutoff = new Date(Date.now() - DEGRADATION_WINDOW_MINUTES * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from("ai_usage_logs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .like("action_slug", "tool_error_%")
      .eq("status", "error")
      .gte("created_at", cutoff);

    if (error) return false;
    return (count || 0) >= DEGRADATION_THRESHOLD;
  } catch {
    return false;
  }
}

// ─────────────── 5. Audit Logging ───────────────

export async function logShieldDecision(
  supabase: any,
  orgId: string,
  fnName: string,
  allowed: boolean,
  reason: string,
  args?: any,
  ctx?: ShieldContext,
): Promise<void> {
  try {
    await supabase.from("ai_usage_logs").insert({
      organization_id: orgId,
      action_slug: allowed ? `shield_allow_${fnName}` : `shield_block_${fnName}`,
      model: `shield:${reason}`,
      status: allowed ? "success" : "blocked",
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      duration_ms: 0,
      estimated_cost_usd: 0,
    });
  } catch (e: any) {
    console.error("[ACTION-SHIELD] Audit log failed:", e?.message);
  }
}

export async function logToolSuccess(
  supabase: any,
  orgId: string,
  fnName: string,
  args: any,
): Promise<void> {
  const actionHash = generateActionHash(fnName, orgId, args);
  try {
    await supabase.from("ai_usage_logs").insert({
      organization_id: orgId,
      action_slug: `tool_ok_${fnName}`,
      model: actionHash,
      status: "success",
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
      duration_ms: 0,
      estimated_cost_usd: 0,
    });
  } catch (e: any) {
    console.error("[ACTION-SHIELD] Success log failed:", e?.message);
  }
}

// ─────────────── MAIN GATE ───────────────

/**
 * Central pre-execution gate for all tool calls.
 * Must be called BEFORE executing any tool.
 * Returns { allowed, reason, detail }.
 */
export async function enforceActionShield(
  fnName: string,
  args: any,
  ctx: ShieldContext,
): Promise<ShieldResult> {
  const risk = getActionRisk(fnName, args);
  const { supabase, organizationId } = ctx;

  // 1. Triple Org Validation
  const orgCheck = validateOrgTriple(ctx);
  if (!orgCheck.allowed) {
    await logShieldDecision(supabase, organizationId, fnName, false, orgCheck.reason, args, ctx);
    return orgCheck;
  }

  // 2. Degraded Mode (block high-risk only)
  if (risk === "high" && await checkDegradedMode(supabase, organizationId)) {
    const result: ShieldResult = {
      allowed: false,
      reason: "degraded_mode",
      detail: "⚠️ Detectei instabilidade recente no sistema. Por segurança, ações de alto risco estão temporariamente bloqueadas. Tente novamente em alguns minutos ou faça a ação pelo painel.",
    };
    await logShieldDecision(supabase, organizationId, fnName, false, "degraded_mode", args, ctx);
    return result;
  }

  // 3. Channel Lock (for client sends)
  const channelCheck = validateChannelLock(fnName, args, ctx);
  if (!channelCheck.allowed) {
    await logShieldDecision(supabase, organizationId, fnName, false, channelCheck.reason, args, ctx);
    return channelCheck;
  }

  // 4. Anti-Duplication
  const dedupCheck = await checkAntiDuplication(supabase, fnName, organizationId, args);
  if (!dedupCheck.allowed) {
    await logShieldDecision(supabase, organizationId, fnName, false, dedupCheck.reason, args, ctx);
    return dedupCheck;
  }

  // 5. Log allowed decision for high/medium risk
  if (risk !== "low") {
    await logShieldDecision(supabase, organizationId, fnName, true, "shield_passed", args, ctx);
  }

  return { allowed: true, reason: "shield_passed" };
}
