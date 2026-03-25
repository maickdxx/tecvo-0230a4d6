import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface TechnicalReport {
  id: string;
  organization_id: string;
  report_number: number;
  client_id: string;
  service_id: string | null;
  quote_service_id: string | null;
  technician_id: string | null;
  report_date: string;
  status: string;
  equipment_type: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  capacity_btus: string | null;
  serial_number: string | null;
  equipment_quantity: number;
  equipment_location: string | null;
  visit_reason: string | null;
  inspection_checklist: string[];
  diagnosis: string | null;
  measurements: Record<string, string>;
  equipment_condition: string | null;
  recommendation: string | null;
  risks: string | null;
  conclusion: string | null;
  interventions_performed: string | null;
  cleanliness_status: string | null;
  observations: string | null;
  needs_quote: boolean;
  equipment_working: string;
  responsible_technician_name: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  client?: {
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip_code: string | null;
  };
  service?: {
    quote_number: number;
    document_type: string | null;
  } | null;
  quote_service?: {
    quote_number: number;
    document_type: string | null;
  } | null;
  technician_profile?: {
    full_name: string | null;
  } | null;
}

export interface TechnicalReportFormData {
  client_id: string;
  service_id?: string | null;
  quote_service_id?: string | null;
  technician_id?: string | null;
  report_date: string;
  status?: string;
  equipment_type?: string;
  equipment_brand?: string;
  equipment_model?: string;
  capacity_btus?: string;
  serial_number?: string;
  equipment_quantity?: number;
  equipment_location?: string;
  visit_reason?: string;
  inspection_checklist?: string[];
  diagnosis?: string;
  measurements?: Record<string, string>;
  equipment_condition?: string;
  recommendation?: string;
  risks?: string;
  conclusion?: string;
  observations?: string;
  needs_quote?: boolean;
  equipment_working?: string;
  responsible_technician_name?: string;
}

export const REPORT_STATUS_LABELS: Record<string, string> = {
  draft: "Rascunho",
  finalized: "Finalizado",
};

export const EQUIPMENT_CONDITIONS: Record<string, string> = {
  good: "Bom",
  regular: "Regular",
  bad: "Ruim",
  critical: "Crítico",
  inoperative: "Inoperante",
};

export const INSPECTION_ITEMS = [
  { key: "electrical_supply", label: "Alimentação elétrica verificada" },
  { key: "voltage", label: "Tensão verificada" },
  { key: "current", label: "Corrente verificada" },
  { key: "evaporator", label: "Evaporadora inspecionada" },
  { key: "condenser", label: "Condensadora inspecionada" },
  { key: "drain", label: "Dreno verificado" },
  { key: "piping", label: "Tubulação verificada" },
  { key: "insulation", label: "Isolamento verificado" },
  { key: "electronic_board", label: "Placa eletrônica verificada" },
  { key: "sensor", label: "Sensor verificado" },
  { key: "ventilation", label: "Ventilação verificada" },
  { key: "filters", label: "Filtros verificados" },
  { key: "coil", label: "Serpentina verificada" },
  { key: "pressures", label: "Pressões verificadas" },
];

type TechnicalReportInsert = Database["public"]["Tables"]["technical_reports"]["Insert"];
type TechnicalReportUpdate = Database["public"]["Tables"]["technical_reports"]["Update"];
type TechnicalReportMutationResult = Pick<Database["public"]["Tables"]["technical_reports"]["Row"], "id" | "service_id">;
type TechnicianProfile = { full_name: string | null } | null;
type TechnicalReportQueryRow = Omit<TechnicalReport, "technician_profile">;

const TECHNICAL_REPORT_SELECT = `
  *,
  client:clients!client_id(name, phone, email, address, city, state, zip_code),
  service:services!service_id(quote_number, document_type),
  quote_service:services!quote_service_id(quote_number, document_type)
`;

const normalizeOptionalText = (value?: string | null) => {
  if (typeof value !== "string") return value ?? null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

async function attachTechnicianProfiles<T extends { technician_id: string | null }>(
  reports: T[],
): Promise<Array<T & { technician_profile: TechnicianProfile }>> {
  const technicianIds = [...new Set(
    reports
      .map((report) => report.technician_id)
      .filter((technicianId): technicianId is string => Boolean(technicianId)),
  )];

  if (technicianIds.length === 0) {
    return reports.map((report) => ({ ...report, technician_profile: null }));
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .in("user_id", technicianIds);

  if (error) {
    console.error("Error fetching technician profiles for technical reports:", error);
    throw error;
  }

  const technicianNameByUserId = new Map(
    (data || []).map((profile) => [profile.user_id, profile.full_name ?? null]),
  );

  return reports.map((report) => ({
    ...report,
    technician_profile: report.technician_id
      ? { full_name: technicianNameByUserId.get(report.technician_id) ?? null }
      : null,
  }));
}

function buildTechnicalReportUpdatePayload(formData: Partial<TechnicalReportFormData>): TechnicalReportUpdate {
  const payload: TechnicalReportUpdate = {};

  if ("client_id" in formData && formData.client_id) payload.client_id = formData.client_id;
  if ("service_id" in formData) payload.service_id = formData.service_id || null;
  if ("quote_service_id" in formData) payload.quote_service_id = formData.quote_service_id || null;
  if ("technician_id" in formData) payload.technician_id = formData.technician_id || null;
  if ("report_date" in formData && formData.report_date) payload.report_date = formData.report_date;
  if ("status" in formData) payload.status = formData.status || "draft";
  if ("equipment_type" in formData) payload.equipment_type = normalizeOptionalText(formData.equipment_type);
  if ("equipment_brand" in formData) payload.equipment_brand = normalizeOptionalText(formData.equipment_brand);
  if ("equipment_model" in formData) payload.equipment_model = normalizeOptionalText(formData.equipment_model);
  if ("capacity_btus" in formData) payload.capacity_btus = normalizeOptionalText(formData.capacity_btus);
  if ("serial_number" in formData) payload.serial_number = normalizeOptionalText(formData.serial_number);
  if ("equipment_quantity" in formData) {
    payload.equipment_quantity = Number.isFinite(formData.equipment_quantity)
      ? Math.max(1, formData.equipment_quantity as number)
      : 1;
  }
  if ("equipment_location" in formData) payload.equipment_location = normalizeOptionalText(formData.equipment_location);
  if ("visit_reason" in formData) payload.visit_reason = normalizeOptionalText(formData.visit_reason);
  if ("inspection_checklist" in formData) payload.inspection_checklist = formData.inspection_checklist || [];
  if ("diagnosis" in formData) payload.diagnosis = normalizeOptionalText(formData.diagnosis);
  if ("measurements" in formData) payload.measurements = formData.measurements || {};
  if ("equipment_condition" in formData) payload.equipment_condition = normalizeOptionalText(formData.equipment_condition);
  if ("recommendation" in formData) payload.recommendation = normalizeOptionalText(formData.recommendation);
  if ("risks" in formData) payload.risks = normalizeOptionalText(formData.risks);
  if ("conclusion" in formData) payload.conclusion = normalizeOptionalText(formData.conclusion);
  if ("observations" in formData) payload.observations = normalizeOptionalText(formData.observations);
  if ("needs_quote" in formData) payload.needs_quote = Boolean(formData.needs_quote);
  if ("equipment_working" in formData) payload.equipment_working = formData.equipment_working || "yes";
  if ("responsible_technician_name" in formData) {
    payload.responsible_technician_name = normalizeOptionalText(formData.responsible_technician_name);
  }

  return payload;
}

function buildTechnicalReportInsertPayload(
  organizationId: string,
  formData: TechnicalReportFormData,
): TechnicalReportInsert {
  return {
    organization_id: organizationId,
    client_id: formData.client_id,
    report_date: formData.report_date,
    ...buildTechnicalReportUpdatePayload(formData),
  };
}

export function useTechnicalReportMutations() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const invalidateTechnicalReportQueries = async (reportId?: string | null, serviceId?: string | null) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["technical-reports", organizationId] }),
      reportId
        ? queryClient.invalidateQueries({ queryKey: ["technical-report", reportId, organizationId] })
        : Promise.resolve(),
      serviceId
        ? queryClient.invalidateQueries({ queryKey: ["service-laudos", serviceId, organizationId] })
        : Promise.resolve(),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async (formData: TechnicalReportFormData) => {
      if (!organizationId) throw new Error("Sem organização");

      const { data, error } = await supabase
        .from("technical_reports")
        .insert(buildTechnicalReportInsertPayload(organizationId, {
          ...formData,
          status: formData.status ?? "draft",
          equipment_quantity: formData.equipment_quantity ?? 1,
          inspection_checklist: formData.inspection_checklist ?? [],
          measurements: formData.measurements ?? {},
          needs_quote: formData.needs_quote ?? false,
          equipment_working: formData.equipment_working ?? "yes",
        }))
        .select("id, service_id")
        .single<TechnicalReportMutationResult>();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateTechnicalReportQueries(data.id, data.service_id);
      toast({ title: "Laudo criado com sucesso" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao criar laudo", description: err.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: formData }: { id: string; data: Partial<TechnicalReportFormData> }) => {
      const { data, error } = await supabase
        .from("technical_reports")
        .update(buildTechnicalReportUpdatePayload(formData))
        .eq("id", id)
        .select("id, service_id")
        .single<TechnicalReportMutationResult>();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateTechnicalReportQueries(data.id, data.service_id);
      toast({ title: "Laudo atualizado" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar", description: err.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("technical_reports")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .select("id, service_id")
        .single<TechnicalReportMutationResult>();
      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      await invalidateTechnicalReportQueries(data.id, data.service_id);
      toast({ title: "Laudo excluído" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao excluir", description: err.message });
    },
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isRemoving: removeMutation.isPending,
  };
}

export function useTechnicalReport(id?: string) {
  const { organizationId, isLoading: authLoading } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["technical-report", id, organizationId],
    queryFn: async () => {
      if (!id || !organizationId) return null;
      const { data, error } = await supabase
        .from("technical_reports")
        .select(TECHNICAL_REPORT_SELECT)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const [reportWithTechnician] = await attachTechnicianProfiles([
        data as unknown as TechnicalReportQueryRow,
      ]);
      return (reportWithTechnician as TechnicalReport) ?? null;
    },
    enabled: !authLoading && !!organizationId && !!id,
  });

  return {
    report: data ?? null,
    isLoading: authLoading || isLoading,
  };
}

export function useTechnicalReports() {
  const { organizationId, isLoading: authLoading } = useAuth();
  const { create, update, remove, isCreating, isUpdating } = useTechnicalReportMutations();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["technical-reports", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("technical_reports")
        .select(TECHNICAL_REPORT_SELECT)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return await attachTechnicianProfiles((data || []) as unknown as TechnicalReportQueryRow[]);
    },
    enabled: !authLoading && !!organizationId,
  });

  return {
    reports,
    isLoading: authLoading || isLoading,
    create,
    update,
    remove,
    isCreating,
    isUpdating,
  };
}
