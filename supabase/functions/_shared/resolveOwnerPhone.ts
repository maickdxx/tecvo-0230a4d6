/**
 * internalRecipientShield.ts (formerly resolveOwnerPhone)
 * 
 * Centralized shielding logic for internal TecVo platform messages.
 * 
 * REGRAS OBRIGATÓRIAS:
 * 1. Somente 'owner' recebe mensagens da plataforma.
 * 2. NUNCA enviar para: admin, atendimento, employee, técnico.
 * 3. Validação explícita de papel antes de cada envio.
 * 4. NENHUM fallback ("pega o primeiro", "qualquer um") permitido.
 * 5. Se não houver owner válido ou contato, não envia e registra log.
 */

export function normalizeToDigits(raw: string | null | undefined): string {
  if (!raw) return "";
  let digits = raw.replace(/\D/g, "");
  if (digits.length >= 10 && !digits.startsWith("55") && digits.length <= 11) {
    digits = "55" + digits;
  }
  return digits;
}

export interface OwnerPhoneResult {
  phone: string | null;
  source: "profile_phone" | null;
  userId: string | null;
  aiEnabled: boolean;
  role: "owner" | null;
  blockedReason?: string;
}

/**
 * SHIELDED RESOLVER: Fetches the organization's owner phone number.
 * Enforces strict role validation and no fallbacks.
 */
export async function resolveOwnerPhone(
  supabase: any,
  organizationId: string
): Promise<OwnerPhoneResult> {
  // Step 1: Find ALL roles for this org to ensure we don't pick the wrong one
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("organization_id", organizationId);

  if (rolesError) {
    console.error(`[SHIELD] Error fetching roles for org ${organizationId}:`, rolesError.message);
    return { phone: null, source: null, userId: null, aiEnabled: false, role: null, blockedReason: "roles_query_error" };
  }

  // Step 2: STRICT FILTER - Only 'owner' is allowed
  const ownerRoles = roles?.filter(r => r.role === "owner");
  
  if (!ownerRoles || ownerRoles.length === 0) {
    console.warn(`[SHIELD] Org ${organizationId} has NO valid owner role. Internal message blocked.`);
    return { phone: null, source: null, userId: null, aiEnabled: false, role: null, blockedReason: "no_owner_found" };
  }

  // If there are multiple owners (rare but possible), we still only take the first explicit owner
  // but we NEVER fallback to other roles.
  const ownerRole = ownerRoles[0];

  // Step 3: Fetch profile with strict contact validation
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("phone, whatsapp_ai_enabled")
    .eq("user_id", ownerRole.user_id)
    .maybeSingle();

  if (profileError || !profile) {
    console.warn(`[SHIELD] Profile not found for owner ${ownerRole.user_id} in org ${organizationId}.`);
    return { phone: null, source: null, userId: ownerRole.user_id, aiEnabled: false, role: "owner", blockedReason: "owner_profile_missing" };
  }

  const ph = normalizeToDigits(profile.phone);
  
  // Rule: If no phone, block send.
  if (!ph) {
    console.warn(`[SHIELD] Owner ${ownerRole.user_id} has no phone number. Blocking internal send.`);
    return { phone: null, source: null, userId: ownerRole.user_id, aiEnabled: profile.whatsapp_ai_enabled, role: "owner", blockedReason: "no_phone_number" };
  }

  return { 
    phone: profile.whatsapp_ai_enabled ? ph : null, 
    source: profile.whatsapp_ai_enabled && ph ? "profile_phone" : null, 
    userId: ownerRole.user_id,
    aiEnabled: profile.whatsapp_ai_enabled,
    role: "owner"
  };
}

/**
 * Shielded send logger: use this to record blocked attempts for internal messages.
 */
import { logSend } from "./sendGuard.ts";

export async function logShieldBlocked(
  supabase: any,
  orgId: string,
  result: OwnerPhoneResult,
  source: string,
  messagePreview?: string
): Promise<void> {
  await logSend(
    supabase,
    orgId,
    null, // No contact ID because it never reached a contact
    source,
    "blocked",
    result.blockedReason || "shield_violation",
    messagePreview || "Internal platform message blocked by shield",
    result.userId || undefined,
    result.role || undefined
  );
}
