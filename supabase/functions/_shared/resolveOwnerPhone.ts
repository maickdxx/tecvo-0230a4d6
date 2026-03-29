/**
 * Resolves the personal phone number of an organization's owner.
 *
 * Priority:
 *   1. profiles.whatsapp_personal  (preferred — explicit personal WA)
 *   2. profiles.phone              (fallback)
 *   3. organizations.whatsapp_owner (legacy fallback — will be phased out)
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
  source: "whatsapp_personal" | "profile_phone" | "whatsapp_owner" | null;
  userId: string | null;
}

/**
 * Fetches the owner's personal phone for a given org.
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
      .select("whatsapp_personal, phone")
      .eq("user_id", ownerRole.user_id)
      .maybeSingle();

    if (profile) {
      const wp = normalizeToDigits(profile.whatsapp_personal);
      if (wp) return { phone: wp, source: "whatsapp_personal", userId: ownerRole.user_id };

      const ph = normalizeToDigits(profile.phone);
      if (ph) return { phone: ph, source: "profile_phone", userId: ownerRole.user_id };
    }
  }

  // 2. Legacy fallback: organizations.whatsapp_owner
  const { data: org } = await supabase
    .from("organizations")
    .select("whatsapp_owner")
    .eq("id", organizationId)
    .maybeSingle();

  const wo = normalizeToDigits(org?.whatsapp_owner);
  if (wo) return { phone: wo, source: "whatsapp_owner", userId: ownerRole?.user_id || null };

  return { phone: null, source: null, userId: ownerRole?.user_id || null };
}
