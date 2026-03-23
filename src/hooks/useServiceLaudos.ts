import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ServiceLaudo {
  id: string;
  report_number: number;
  report_date: string;
  status: string;
  equipment_type: string | null;
  responsible_technician_name: string | null;
  technician_profile: { full_name: string | null } | null;
  technician_id: string | null;
}

export function useServiceLaudos(serviceId: string | undefined) {
  const { organizationId } = useAuth();

  const { data: laudos = [], isLoading } = useQuery({
    queryKey: ["service-laudos", serviceId, organizationId],
    queryFn: async () => {
      if (!serviceId || !organizationId) return [];
      const { data, error } = await supabase
        .from("technical_reports")
        .select("id, report_number, report_date, status, equipment_type, responsible_technician_name, technician_id")
        .eq("service_id", serviceId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const technicianIds = [...new Set((data || []).map((laudo) => laudo.technician_id).filter((value): value is string => Boolean(value)))];
      const technicianProfiles = technicianIds.length > 0
        ? await supabase.from("profiles").select("user_id, full_name").in("user_id", technicianIds)
        : { data: [], error: null };

      if (technicianProfiles.error) throw technicianProfiles.error;

      const technicianNameByUserId = new Map((technicianProfiles.data || []).map((profile) => [profile.user_id, profile.full_name ?? null]));

      return ((data || []).map((laudo) => ({
        ...laudo,
        technician_profile: laudo.technician_id
          ? { full_name: technicianNameByUserId.get(laudo.technician_id) ?? null }
          : null,
      }))) as unknown as ServiceLaudo[];
    },
    enabled: !!serviceId && !!organizationId,
  });

  return { laudos, laudoCount: laudos.length, isLoading };
}
