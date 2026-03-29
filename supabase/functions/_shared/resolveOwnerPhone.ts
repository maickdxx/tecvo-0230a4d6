/**
 * Resolves the phone number of an organization's owner for AI/Automation messages.
 *
 * Rules (updated):
 *   1. Uses ONLY profiles.phone
 *   2. Checks if whatsapp_ai_enabled is TRUE
 *   3. NO legacy fallbacks to organizations.whatsapp_owner
 *
 * All values are normalized to digits-only with country code 55.
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
}

/**
 * Fetches the owner's phone for a given org.
 * Uses service-role supabase client.
 */
export async function resolveOwnerPhone(
  supabase: any,
  organizationId: string
): Promise<OwnerPhoneResult> {
  // 1. Find owner profile
  const { data: ownerRole } = await supabase
    .from("user_roles")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle();

  if (ownerRole?.user_id) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("phone, whatsapp_ai_enabled")
      .eq("user_id", ownerRole.user_id)
      .maybeSingle();

    if (profile) {
      const ph = normalizeToDigits(profile.phone);
      return { 
        phone: profile.whatsapp_ai_enabled ? ph : null, 
        source: profile.whatsapp_ai_enabled && ph ? "profile_phone" : null, 
        userId: ownerRole.user_id,
        aiEnabled: profile.whatsapp_ai_enabled
      };
    }
  }

  return { phone: null, source: null, userId: ownerRole?.user_id || null, aiEnabled: false };
}
