import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { supabase } from "@/integrations/supabase/client";

export interface SensitiveProfileData {
  cpf: string | null;
  rg: string | null;
  hourly_rate: number | null;
  birth_date: string | null;
  hire_date: string | null;
  address_cep: string | null;
  address_street: string | null;
  address_number: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  whatsapp_ai_enabled: boolean;
  avatar_url: string | null;
  notes: string | null;
  position: string | null;
  employee_type: string;
  whatsapp_signature_enabled: boolean;
  ai_assistant_name: string | null;
  ai_assistant_voice: string | null;
  whatsapp_signature: string | null;
}

/**
 * Fetches sensitive profile fields for a given user.
 *
 * Access rules:
 * - Owner/Admin can access any profile in the same organization
 * - Any user can access their own data
 * - Other roles are denied
 *
 * @param targetUserId – the user whose sensitive data is needed.
 *                        Defaults to the authenticated user's own id.
 */
export function useProfileSensitiveData(targetUserId?: string) {
  const { user, profile } = useAuth();
  const { isAdmin, isOwner } = useUserRole();

  const userId = targetUserId ?? user?.id;
  const isSelf = userId === user?.id;
  const canAccess = isSelf || isAdmin || isOwner;

  const { data, isLoading, error } = useQuery({
    queryKey: ["profile-sensitive", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "cpf, rg, hourly_rate, birth_date, hire_date, " +
          "address_cep, address_street, address_number, address_neighborhood, " +
          "address_city, address_state, whatsapp_ai_enabled, avatar_url, notes, " +
          "position, employee_type, whatsapp_signature_enabled, whatsapp_signature, " +
          "ai_assistant_name, ai_assistant_voice"
        )
        .eq("user_id", userId!)
        .eq("organization_id", profile!.organization_id)
        .maybeSingle();

      if (error) throw error;
      return (data as unknown as SensitiveProfileData) ?? null;
    },
    enabled: !!userId && !!profile?.organization_id && canAccess,
    staleTime: 1000 * 60 * 5,
  });

  return {
    sensitiveData: canAccess ? data ?? null : null,
    isLoading,
    canAccess,
    error,
  };
}
