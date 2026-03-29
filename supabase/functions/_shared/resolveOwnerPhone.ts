/**
 * internalRecipientShield.ts (formerly resolveOwnerPhone)
 * 
 * Centralized shielding logic for internal TecVo platform messages (WhatsApp & Email).
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

export interface OwnerContactResult {
  userId: string | null;
  role: "owner" | null;
  phone: string | null;
  email: string | null;
  fullName: string | null;
  aiEnabled: boolean;
  blockedReason?: string;
  source: "profile_contact" | null;
}

/**
 * SHIELDED CONTACT RESOLVER: Fetches the organization's owner contact info.
 * Enforces strict role validation and no fallbacks.
 */
export async function resolveOwnerContact(
  supabase: any,
  organizationId: string
): Promise<OwnerContactResult> {
  // Step 1: Find ALL roles for this org to ensure we don't pick the wrong one
  const { data: roles, error: rolesError } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .eq("organization_id", organizationId);

  if (rolesError) {
    console.error(`[SHIELD] Error fetching roles for org ${organizationId}:`, rolesError.message);
    return { userId: null, role: null, phone: null, email: null, fullName: null, aiEnabled: false, source: null, blockedReason: "roles_query_error" };
  }

  // Step 2: STRICT FILTER - Only 'owner' is allowed
  const ownerRoles = roles?.filter(r => r.role === "owner");
  
  if (!ownerRoles || ownerRoles.length === 0) {
    console.warn(`[SHIELD] Org ${organizationId} has NO valid owner role. Internal message blocked.`);
    return { userId: null, role: null, phone: null, email: null, fullName: null, aiEnabled: false, source: null, blockedReason: "no_owner_found" };
  }

  // Use the first explicit owner
  const ownerRole = ownerRoles[0];

  // Step 3: Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("phone, full_name, whatsapp_ai_enabled")
    .eq("user_id", ownerRole.user_id)
    .maybeSingle();

  if (profileError || !profile) {
    console.warn(`[SHIELD] Profile not found for owner ${ownerRole.user_id} in org ${organizationId}.`);
    return { userId: ownerRole.user_id, role: "owner", phone: null, email: null, fullName: null, aiEnabled: false, source: null, blockedReason: "owner_profile_missing" };
  }

  // Step 4: Fetch email from auth (requires admin client)
  let email: string | null = null;
  try {
    const { data: authData } = await supabase.auth.admin.getUserById(ownerRole.user_id);
    email = authData?.user?.email || null;
  } catch (err) {
    console.error(`[SHIELD] Error fetching auth email for owner ${ownerRole.user_id}:`, err);
  }

  const phone = normalizeToDigits(profile.phone);

  return { 
    userId: ownerRole.user_id,
    role: "owner",
    phone: phone || null,
    email: email || null,
    fullName: profile.full_name || null,
    aiEnabled: profile.whatsapp_ai_enabled || false,
    source: "profile_contact"
  };
}

// Keep backward compatibility for existing code
export async function resolveOwnerPhone(
  supabase: any,
  organizationId: string
): Promise<{ phone: string | null; source: string | null; userId: string | null; aiEnabled: boolean; role: string | null; blockedReason?: string }> {
  const result = await resolveOwnerContact(supabase, organizationId);
  return {
    phone: result.aiEnabled ? result.phone : null,
    source: result.aiEnabled && result.phone ? "profile_phone" : null,
    userId: result.userId,
    aiEnabled: result.aiEnabled,
    role: result.role,
    blockedReason: result.blockedReason
  };
}

/**
 * Shielded send logger: use this to record blocked attempts for internal messages.
 */
import { logSend } from "./sendGuard.ts";

export async function logShieldBlocked(
  supabase: any,
  orgId: string,
  result: Partial<OwnerContactResult>,
  source: string,
  messagePreview?: string
): Promise<void> {
  await logSend(
    supabase,
    orgId,
    null,
    source,
    "blocked",
    result.blockedReason || "shield_violation",
    messagePreview || "Internal platform message blocked by shield",
    result.userId || undefined,
    result.role || undefined
  );
}
