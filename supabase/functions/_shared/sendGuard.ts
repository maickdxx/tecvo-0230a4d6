/**
 * Send Guard — Central protection layer for all WhatsApp message sending.
 * 
 * Every outbound message MUST call `checkSendLimit()` before sending.
 * This enforces:
 * - Kill switch (messaging_paused per org)
 * - Rate limit per org (200/hour)
 * - Rate limit per contact (10/hour)
 * - Cooldown per contact (3s minimum between messages)
 * - Auto-pause on anomalous volume (300+/hour)
 * - Unified logging of all send attempts
 * 
 * FAIL-SAFE: If the guard itself fails, a local fallback enforces
 * max 1 message per contact per 60s and blocks null-contact sends.
 */

// In-memory fallback cache: contactId -> last send timestamp
const fallbackCache = new Map<string, number>();
const FALLBACK_COOLDOWN_MS = 60_000; // 1 msg per contact per 60s when degraded

export interface SendCheckResult {
  allowed: boolean;
  reason?: string;
  detail?: string;
  count?: number;
}

/**
 * Local fail-safe check when the RPC guard is unavailable.
 * Very conservative: 1 msg/contact/60s, block mass (null contact) sends.
 */
function failSafeCheck(contactId: string | null, source: string): SendCheckResult {
  // Block sends with no contact (broadcasts, mass) entirely in degraded mode
  if (!contactId) {
    return {
      allowed: false,
      reason: "guard_degraded_no_contact",
      detail: "Guard unavailable — mass/broadcast sends blocked in fail-safe mode",
    };
  }

  const now = Date.now();
  const lastSend = fallbackCache.get(contactId);

  if (lastSend && now - lastSend < FALLBACK_COOLDOWN_MS) {
    const waitSec = Math.ceil((FALLBACK_COOLDOWN_MS - (now - lastSend)) / 1000);
    return {
      allowed: false,
      reason: "guard_degraded_cooldown",
      detail: `Guard unavailable — fail-safe cooldown active (${waitSec}s remaining)`,
    };
  }

  // Allow but record timestamp
  fallbackCache.set(contactId, now);

  // Prune old entries periodically to avoid memory leak
  if (fallbackCache.size > 500) {
    const cutoff = now - FALLBACK_COOLDOWN_MS * 2;
    for (const [key, ts] of fallbackCache) {
      if (ts < cutoff) fallbackCache.delete(key);
    }
  }

  return {
    allowed: true,
    reason: "guard_degraded_fallback",
    detail: "Guard unavailable — allowed under fail-safe (1/60s per contact)",
  };
}

/**
 * Check if sending is allowed and log the attempt.
 * 
 * @param supabase - Supabase client (service role)
 * @param orgId - Organization ID
 * @param contactId - Contact ID (null for system messages like OTP)
 * @param source - Source identifier
 * @returns SendCheckResult
 */
export async function checkSendLimit(
  supabase: any,
  orgId: string,
  contactId: string | null,
  source: string,
): Promise<SendCheckResult> {
  try {
    const { data, error } = await supabase.rpc("check_send_limit", {
      _org_id: orgId,
      _contact_id: contactId,
      _source: source,
    });

    if (error) {
      console.error("[SEND-GUARD] RPC error — entering FAIL-SAFE mode:", error.message);

      // FAIL-SAFE: apply local fallback instead of allowing freely
      const fallback = failSafeCheck(contactId, source);

      // Best-effort log the degraded state
      logSend(supabase, orgId, contactId, source,
        fallback.allowed ? "sent" : "blocked",
        fallback.allowed ? "guard_rpc_error_fallback_allowed" : "guard_rpc_error_fallback_blocked",
        `RPC error: ${error.message}`
      ).catch(() => {});

      return fallback;
    }

    const result = data as any;
    if (!result.allowed) {
      console.warn(`[SEND-GUARD] BLOCKED — org:${orgId} contact:${contactId} source:${source} reason:${result.reason} detail:${result.detail}`);
    }

    return {
      allowed: result.allowed,
      reason: result.reason,
      detail: result.detail,
      count: result.count,
    };
  } catch (err: any) {
    console.error("[SEND-GUARD] Exception — entering FAIL-SAFE mode:", err.message);

    // FAIL-SAFE: apply local fallback instead of allowing freely
    const fallback = failSafeCheck(contactId, source);

    // Best-effort log
    logSend(supabase, orgId, contactId, source,
      fallback.allowed ? "sent" : "blocked",
      fallback.allowed ? "guard_exception_fallback_allowed" : "guard_exception_fallback_blocked",
      `Exception: ${err.message}`
    ).catch(() => {});

    return fallback;
  }
}

/**
 * Log a send that bypasses the RPC (for cases where the send already happened
 * or needs special handling). Use sparingly.
 */
export async function logSend(
  supabase: any,
  orgId: string,
  contactId: string | null,
  source: string,
  status: "sent" | "blocked" | "error",
  blockedReason?: string,
  messagePreview?: string,
  recipientUserId?: string,
  recipientRole?: string
): Promise<void> {
  try {
    await supabase.from("whatsapp_message_log").insert({
      organization_id: orgId,
      contact_id: contactId,
      source,
      status,
      blocked_reason: blockedReason || null,
      message_preview: messagePreview ? messagePreview.substring(0, 200) : null,
      recipient_user_id: recipientUserId || null,
      recipient_role: recipientRole || null
    });
  } catch (err: any) {
    console.error("[SEND-GUARD] logSend error:", err.message);
  }
}
