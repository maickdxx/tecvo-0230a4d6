import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface ChecklistItemStatus {
  key: string;
  status: "ok" | "attention" | "critical";
}

export interface ReportEquipment {
  id: string;
  report_id: string;
  organization_id: string;
  equipment_number: number;
  equipment_type: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  capacity_btus: string | null;
  serial_number: string | null;
  equipment_location: string | null;
  inspection_checklist: ChecklistItemStatus[];
  condition_found: string | null;
  procedure_performed: string | null;
  technical_observations: string | null;
  impact_level: string | null;
  services_performed: string | null;
  equipment_condition: string | null;
  cleanliness_status: string | null;
  equipment_working: string | null;
  final_status: string | null;
  measurements: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface ReportEquipmentFormData {
  equipment_number?: number;
  equipment_type?: string;
  equipment_brand?: string;
  equipment_model?: string;
  capacity_btus?: string;
  serial_number?: string;
  equipment_location?: string;
  inspection_checklist?: ChecklistItemStatus[];
  condition_found?: string;
  procedure_performed?: string;
  technical_observations?: string;
  impact_level?: string;
  services_performed?: string;
  equipment_condition?: string;
  cleanliness_status?: string;
  equipment_working?: string;
  final_status?: string;
  measurements?: Record<string, string>;
}

export const EQUIPMENT_TYPES = [
  "Split Hi-Wall",
  "Split Piso Teto",
  "Split Cassete",
  "Split Duto",
  "Multi Split",
  "Self Contained",
  "Janela",
  "Portátil",
  "VRF/VRV",
  "Chiller",
  "Fan Coil",
  "Outro",
];

export const CHECKLIST_ITEMS = [
  { key: "evaporator", label: "Evaporadora" },
  { key: "drain", label: "Dreno" },
  { key: "piping", label: "Tubulação" },
  { key: "electronic_board", label: "Placa eletrônica" },
  { key: "sensor", label: "Sensor" },
  { key: "ventilation", label: "Ventilação" },
  { key: "filters", label: "Filtros" },
  { key: "coil", label: "Serpentina" },
  { key: "pressures", label: "Pressões" },
];

export const CHECKLIST_STATUS_LABELS: Record<string, string> = {
  ok: "OK",
  attention: "Atenção",
  critical: "Crítico",
};

export const IMPACT_LEVELS: Record<string, { label: string; description: string }> = {
  low: { label: "Baixo", description: "Manutenção preventiva recomendada" },
  medium: { label: "Médio", description: "Risco de perda de eficiência ou aumento de consumo" },
  high: { label: "Alto", description: "Risco de falha ou parada do equipamento" },
};

export const FINAL_STATUS_OPTIONS: Record<string, string> = {
  operational: "Operacional",
  operational_with_caveats: "Operacional com ressalvas",
  non_operational: "Não operacional",
};

export function useReportEquipment(reportId?: string) {
  const { organizationId, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();

  const queryKey = ["report-equipment", reportId, organizationId];

  const { data: equipment = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!reportId || !organizationId) return [];
      const { data, error } = await supabase
        .from("report_equipment")
        .select("*")
        .eq("report_id", reportId)
        .eq("organization_id", organizationId)
        .order("equipment_number", { ascending: true });
      if (error) throw error;
      return (data || []).map((row) => ({
        ...row,
        inspection_checklist: (row.inspection_checklist as any) || [],
        measurements: (row.measurements as any) || {},
      })) as ReportEquipment[];
    },
    enabled: !authLoading && !!organizationId && !!reportId,
  });

  const addMutation = useMutation({
    mutationFn: async (data: ReportEquipmentFormData) => {
      if (!reportId || !organizationId) throw new Error("Sem contexto");
      const { data: result, error } = await supabase
        .from("report_equipment")
        .insert({
          report_id: reportId,
          organization_id: organizationId,
          equipment_number: data.equipment_number || (equipment.length + 1),
          equipment_type: data.equipment_type || null,
          equipment_brand: data.equipment_brand || null,
          equipment_model: data.equipment_model || null,
          capacity_btus: data.capacity_btus || null,
          serial_number: data.serial_number || null,
          equipment_location: data.equipment_location || null,
          inspection_checklist: data.inspection_checklist || [],
          condition_found: data.condition_found || null,
          procedure_performed: data.procedure_performed || null,
          technical_observations: data.technical_observations || null,
          impact_level: data.impact_level || "low",
          services_performed: data.services_performed || null,
          equipment_condition: data.equipment_condition || null,
          cleanliness_status: data.cleanliness_status || "clean",
          equipment_working: data.equipment_working || "yes",
          final_status: data.final_status || "operational",
          measurements: data.measurements || {},
        })
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ReportEquipmentFormData> }) => {
      const payload: Record<string, any> = {};
      for (const [key, value] of Object.entries(data)) {
        payload[key] = value ?? null;
      }
      const { error } = await supabase
        .from("report_equipment")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("report_equipment")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    equipment,
    isLoading: authLoading || isLoading,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}
