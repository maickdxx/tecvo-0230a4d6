/**
 * Credit Guard v2 — Atomic credit debit + usage logging.
 *
 * Two modes:
 *   1. PRE-EXECUTION (checkAndDebitCredits): Debits credits BEFORE the AI call.
 *      Returns a requestId for correlation. Usage is logged with status 'pending'.
 *
 *   2. POST-EXECUTION (finalizeAIUsage): Updates the usage log with actual token
 *      counts, duration, and final status AFTER the AI call completes.
 *
 * For FREE flows (0-cost): use logFreeAIUsage to track without debiting.
 *
 * All operations use request_id for correlation between ai_usage_logs
 * and ai_credit_transactions, enabling full audit trail.
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface CreditGuardResult {
  allowed: boolean;
  /** Pre-built error response — only present when allowed=false */
  response?: Response;
  /** Unique ID correlating this debit with usage logs */
  requestId: string;
  /** Remaining balance after debit (if available) */
  remainingBalance?: number;
  /** Where credits were consumed from: franchise, credits, fallback, free */
  source?: string;
}

/** Generate a unique request ID for this AI execution */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Phase 1: Check credits and debit BEFORE AI execution.
 * Uses the atomic `consume_ai_credits_with_log` RPC.
 */
export async function checkAndDebitCredits(
  supabaseAdmin: any,
  organizationId: string,
  userId: string,
  actionSlug: string,
  corsHeaders: Record<string, string> = CORS_HEADERS,
  requestId?: string,
): Promise<CreditGuardResult> {
  const reqId = requestId || generateRequestId();

  try {
    const rpcParams: Record<string, any> = {
      _request_id: reqId,
      _org_id: organizationId,
      _action_slug: actionSlug,
      _status: "pending", // Will be updated after AI completes
    };
    if (userId && userId.trim().length > 0) {
      rpcParams._user_id = userId;
    }

    const { data, error: rpcError } = await supabaseAdmin.rpc(
      "consume_ai_credits_with_log",
      rpcParams,
    );

    if (rpcError) {
      console.error("[CREDIT-GUARD] RPC error:", rpcError.message);

      if (rpcError.message?.includes("Unknown action")) {
        console.warn(`[CREDIT-GUARD] Action "${actionSlug}" not configured, allowing request`);
        return { allowed: true, requestId: reqId };
      }

      return {
        allowed: false,
        requestId: reqId,
        response: new Response(
          JSON.stringify({ error: "Erro ao verificar créditos de IA. Tente novamente." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        ),
      };
    }

    const result = typeof data === "object" ? data : {};

    if (result.allowed === false) {
      console.log(`[CREDIT-GUARD] Insufficient credits for org=${organizationId} action=${actionSlug} reqId=${reqId}`);
      return {
        allowed: false,
        requestId: reqId,
        remainingBalance: result.remaining_balance ?? 0,
        response: new Response(
          JSON.stringify({
            error: "A Laura está temporariamente pausada. Amplie a capacidade para continuar usando todos os recursos inteligentes.",
            code: "INSUFFICIENT_CREDITS",
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        ),
      };
    }

    if (result.deduplicated) {
      console.log(`[CREDIT-GUARD] Deduplicated request ${reqId} for org=${organizationId}`);
    }

    return {
      allowed: true,
      requestId: reqId,
      remainingBalance: result.remaining_balance,
    };
  } catch (err: any) {
    console.error("[CREDIT-GUARD] Unexpected error:", err?.message || err);
    return {
      allowed: false,
      requestId: reqId,
      response: new Response(
        JSON.stringify({ error: "Erro interno ao processar créditos. Tente novamente." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      ),
    };
  }
}

/**
 * Phase 2: Update the usage log AFTER AI execution completes.
 * Updates the 'pending' log entry with actual token counts and status.
 */
export async function finalizeAIUsage(
  supabaseAdmin: any,
  requestId: string,
  data: {
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
    durationMs?: number;
    status: "success" | "error" | "rate_limited";
    estimatedCostUsd?: number;
  },
): Promise<void> {
  try {
    const updateFields: Record<string, any> = {
      status: data.status,
    };
    if (data.model) updateFields.model = data.model;
    if (data.promptTokens !== undefined) updateFields.prompt_tokens = data.promptTokens;
    if (data.completionTokens !== undefined) updateFields.completion_tokens = data.completionTokens;
    if (data.totalTokens !== undefined) updateFields.total_tokens = data.totalTokens;
    if (data.durationMs !== undefined) updateFields.duration_ms = data.durationMs;
    if (data.estimatedCostUsd !== undefined) updateFields.estimated_cost_usd = data.estimatedCostUsd;

    const { error } = await supabaseAdmin
      .from("ai_usage_logs")
      .update(updateFields)
      .eq("request_id", requestId);

    if (error) {
      console.error("[CREDIT-GUARD] Failed to finalize usage log:", error.message, "reqId:", requestId);
    }
  } catch (err: any) {
    console.error("[CREDIT-GUARD] finalizeAIUsage exception:", err?.message);
  }
}

/**
 * For free/subsidized flows: log usage atomically with request_id, no debit.
 * Uses the same RPC (cost=0 actions skip debit automatically).
 */
export async function logFreeAIUsage(
  supabaseAdmin: any,
  organizationId: string | null,
  userId: string | null,
  actionSlug: string,
  data: {
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    durationMs: number;
    status: "success" | "error" | "rate_limited";
  },
  requestId?: string,
): Promise<string> {
  const reqId = requestId || generateRequestId();
  try {
    if (organizationId) {
      // Use atomic RPC (will skip debit since cost=0)
      const rpcParams: Record<string, any> = {
        _request_id: reqId,
        _org_id: organizationId,
        _action_slug: actionSlug,
        _model: data.model,
        _prompt_tokens: data.promptTokens,
        _completion_tokens: data.completionTokens,
        _total_tokens: data.totalTokens,
        _duration_ms: data.durationMs,
        _status: data.status,
      };
      if (userId && userId.trim().length > 0) {
        rpcParams._user_id = userId;
      }
      await supabaseAdmin.rpc("consume_ai_credits_with_log", rpcParams);
    } else {
      // No org (e.g. onboarding) — direct insert with request_id
      const { calculateCostUSD } = await import("./aiUsageLogger.ts");
      const estimatedCostUsd = calculateCostUSD(data.model, data.promptTokens, data.completionTokens);
      await supabaseAdmin.from("ai_usage_logs").insert({
        organization_id: null,
        user_id: userId,
        action_slug: actionSlug,
        model: data.model,
        prompt_tokens: data.promptTokens,
        completion_tokens: data.completionTokens,
        total_tokens: data.totalTokens,
        estimated_cost_usd: estimatedCostUsd,
        duration_ms: data.durationMs,
        status: data.status,
        request_id: reqId,
      });
    }
  } catch (err: any) {
    console.error("[CREDIT-GUARD] logFreeAIUsage error:", err?.message);
  }
  return reqId;
}
