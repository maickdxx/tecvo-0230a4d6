/**
 * Credit Guard — validates and debits AI credits before any AI call.
 * Uses the atomic `consume_ai_credits` RPC (FOR UPDATE + balance check).
 *
 * Usage:
 *   const guard = await checkAndDebitCredits(supabaseAdmin, orgId, userId, "tecvo_chat");
 *   if (!guard.allowed) return guard.response;  // 402 with message
 *   // ... proceed with AI call ...
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export interface CreditGuardResult {
  allowed: boolean;
  /** Pre-built 402 response — only present when allowed=false */
  response?: Response;
}

export async function checkAndDebitCredits(
  supabaseAdmin: any,
  organizationId: string,
  userId: string,
  actionSlug: string,
  corsHeaders: Record<string, string> = CORS_HEADERS,
): Promise<CreditGuardResult> {
  try {
    const rpcParams: Record<string, any> = {
      _org_id: organizationId,
      _action_slug: actionSlug,
    };
    // Only pass userId if it's a valid non-empty string
    if (userId && userId.trim().length > 0) {
      rpcParams._user_id = userId;
    }

    const { data: hasCredits, error: creditError } = await supabaseAdmin.rpc(
      "consume_ai_credits",
      rpcParams,
    );

    if (creditError) {
      console.error("[CREDIT-GUARD] RPC error:", creditError.message);

      // If action_slug not found, allow (fail-open for unconfigured actions)
      if (creditError.message?.includes("Unknown action")) {
        console.warn(`[CREDIT-GUARD] Action "${actionSlug}" not configured, allowing request`);
        return { allowed: true };
      }

      // For other DB errors, block to be safe
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({ error: "Erro ao verificar créditos de IA. Tente novamente." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        ),
      };
    }

    if (hasCredits === false) {
      console.log(`[CREDIT-GUARD] Insufficient credits for org=${organizationId} action=${actionSlug}`);
      return {
        allowed: false,
        response: new Response(
          JSON.stringify({
            error: "Seus créditos de IA acabaram. Recarregue para continuar usando a Laura.",
            code: "INSUFFICIENT_CREDITS",
          }),
          {
            status: 402,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        ),
      };
    }

    return { allowed: true };
  } catch (err: any) {
    console.error("[CREDIT-GUARD] Unexpected error:", err?.message || err);
    // Fail-closed: block on unexpected errors to avoid financial loss
    return {
      allowed: false,
      response: new Response(
        JSON.stringify({ error: "Erro interno ao processar créditos. Tente novamente." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      ),
    };
  }
}
