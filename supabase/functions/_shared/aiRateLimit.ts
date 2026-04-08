/**
 * AI Rate Limiter — enforces per-org rate limits and daily caps.
 * Uses atomic DB counters via check_ai_rate_limit RPC.
 *
 * Limits:
 *   - Per-minute: 10 req/min per org (burst protection)
 *   - Daily cap: based on plan (Start: 50, Pro: 200, Empresa: 500)
 *
 * Usage:
 *   const result = await checkAIRateLimit(supabaseAdmin, orgId);
 *   if (!result.allowed) return result.response;
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Per-minute burst limit (all plans)
const MAX_REQUESTS_PER_MINUTE = 10;

// Daily credit consumption limits by plan
const DAILY_LIMITS: Record<string, number> = {
  start: 50,
  pro: 200,
  empresa: 500,
  enterprise: 500,
};
const DEFAULT_DAILY_LIMIT = 100;

export interface RateLimitResult {
  allowed: boolean;
  reason?: "rate_limit" | "daily_cap";
  response?: Response;
}

function getMinuteKey(): string {
  const now = new Date();
  return `min:${now.toISOString().slice(0, 16)}`; // "min:2026-04-08T12:05"
}

function getDayKey(): string {
  const now = new Date();
  return `day:${now.toISOString().slice(0, 10)}`; // "day:2026-04-08"
}

export async function checkAIRateLimit(
  supabaseAdmin: any,
  organizationId: string,
  corsHeaders: Record<string, string> = CORS_HEADERS,
): Promise<RateLimitResult> {
  try {
    // 1. Per-minute burst check
    const minuteKey = getMinuteKey();
    const { data: minuteResult, error: minuteError } = await supabaseAdmin.rpc(
      "check_ai_rate_limit",
      {
        _org_id: organizationId,
        _window_key: minuteKey,
        _max_requests: MAX_REQUESTS_PER_MINUTE,
      },
    );

    if (minuteError) {
      console.error("[AI-RATE-LIMIT] Minute check error:", minuteError.message);
      // Fail-open on DB errors to avoid blocking legitimate users
      return { allowed: true };
    }

    if (minuteResult && !minuteResult.allowed) {
      console.warn(
        `[AI-RATE-LIMIT] Burst limit hit: org=${organizationId} count=${minuteResult.current}/${minuteResult.limit}`,
      );
      return {
        allowed: false,
        reason: "rate_limit",
        response: new Response(
          JSON.stringify({
            error: "Você está enviando muitas solicitações. Aguarde alguns segundos e tente novamente.",
            code: "RATE_LIMITED",
            retry_after_seconds: 30,
          }),
          {
            status: 429,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
              "Retry-After": "30",
            },
          },
        ),
      };
    }

    // 2. Daily cap check
    const { data: dailyUsage, error: dailyError } = await supabaseAdmin.rpc(
      "get_ai_daily_usage",
      { _org_id: organizationId },
    );

    if (dailyError) {
      console.error("[AI-RATE-LIMIT] Daily usage check error:", dailyError.message);
      return { allowed: true }; // fail-open
    }

    // Get org plan to determine daily limit
    const { data: orgData } = await supabaseAdmin
      .from("organizations")
      .select("plan")
      .eq("id", organizationId)
      .single();

    const plan = (orgData?.plan || "start").toLowerCase();
    const dailyLimit = DAILY_LIMITS[plan] || DEFAULT_DAILY_LIMIT;

    if ((dailyUsage || 0) >= dailyLimit) {
      console.warn(
        `[AI-RATE-LIMIT] Daily cap hit: org=${organizationId} plan=${plan} usage=${dailyUsage}/${dailyLimit}`,
      );
      return {
        allowed: false,
        reason: "daily_cap",
        response: new Response(
          JSON.stringify({
            error: `Você atingiu o limite diário de uso de IA do seu plano (${dailyLimit} créditos/dia). O limite será renovado amanhã.`,
            code: "DAILY_CAP_REACHED",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        ),
      };
    }

    return { allowed: true };
  } catch (err: any) {
    console.error("[AI-RATE-LIMIT] Unexpected error:", err?.message || err);
    // Fail-open to avoid blocking legitimate users on unexpected errors
    return { allowed: true };
  }
}
