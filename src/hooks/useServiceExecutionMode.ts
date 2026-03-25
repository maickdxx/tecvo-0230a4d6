import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export interface EquipmentReportData {
  id: string;
  equipment_id: string;
  service_id: string;
  report_id: string | null;
  service_type_performed: string | null;
  problem_identified: string | null;
  work_performed: string | null;
  observations: string | null;
  checklist: string[];
  status: "pending" | "in_progress" | "completed";
}

export interface ServiceEquipmentWithReport {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  conditions: string | null;
  defects: string | null;
  solution: string | null;
  reportData: EquipmentReportData | null;
  photoCount: number;
}

export function useServiceExecutionMode(serviceId: string | undefined) {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch equipment list with report data
  const { data: equipmentList = [], isLoading: isLoadingEquipment } = useQuery({
    queryKey: ["execution-equipment", serviceId, organizationId],
    queryFn: async () => {
      if (!serviceId || !organizationId) return [];

      // Fetch equipment
      const { data: equipment, error: eqError } = await supabase
        .from("service_equipment")
        .select("id, name, brand, model, serial_number, conditions, defects, solution")
        .eq("service_id", serviceId)
        .order("created_at");
      if (eqError) throw eqError;
      if (!equipment || equipment.length === 0) return [];

      // Fetch report data
      const { data: reportData, error: rdError } = await supabase
        .from("equipment_report_data" as any)
        .select("*")
        .eq("service_id", serviceId);
      if (rdError) throw rdError;

      // Fetch photo counts per equipment
      const equipmentIds = equipment.map((e) => e.id);
      const { data: photos } = await supabase
        .from("technical_report_photos")
        .select("equipment_id")
        .in("equipment_id", equipmentIds);

      const photoCounts = new Map<string, number>();
      (photos || []).forEach((p: any) => {
        if (p.equipment_id) {
          photoCounts.set(p.equipment_id, (photoCounts.get(p.equipment_id) || 0) + 1);
        }
      });

      const reportDataMap = new Map(
        ((reportData as any[]) || []).map((rd: any) => [rd.equipment_id, rd])
      );

      return equipment.map((eq): ServiceEquipmentWithReport => ({
        id: eq.id,
        name: eq.name || "",
        brand: eq.brand || null,
        model: eq.model || null,
        serial_number: eq.serial_number || null,
        conditions: eq.conditions || null,
        defects: eq.defects || null,
        solution: eq.solution || null,
        reportData: reportDataMap.get(eq.id)
          ? {
              id: (reportDataMap.get(eq.id) as any).id,
              equipment_id: eq.id,
              service_id: serviceId!,
              report_id: (reportDataMap.get(eq.id) as any).report_id,
              service_type_performed: (reportDataMap.get(eq.id) as any).service_type_performed,
              problem_identified: (reportDataMap.get(eq.id) as any).problem_identified,
              work_performed: (reportDataMap.get(eq.id) as any).work_performed,
              observations: (reportDataMap.get(eq.id) as any).observations,
              checklist: (reportDataMap.get(eq.id) as any).checklist || [],
              status: (reportDataMap.get(eq.id) as any).status || "pending",
            }
          : null,
        photoCount: photoCounts.get(eq.id) || 0,
      }));
    },
    enabled: !!serviceId && !!organizationId,
  });

  // Fetch or auto-create the technical report for this service
  const { data: reportId } = useQuery({
    queryKey: ["execution-report-id", serviceId, organizationId],
    queryFn: async () => {
      if (!serviceId || !organizationId) return null;

      // Check if report already exists
      const { data: existing } = await supabase
        .from("technical_reports")
        .select("id")
        .eq("service_id", serviceId)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();

      if (existing) return existing.id;

      // Get service data for auto-creation
      const { data: service } = await supabase
        .from("services")
        .select("client_id, assigned_to")
        .eq("id", serviceId)
        .single();
      if (!service?.client_id) return null;

      // Get tech name
      let techName: string | null = null;
      if (service.assigned_to) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("user_id", service.assigned_to)
          .single();
        techName = profile?.full_name || null;
      }

      // Auto-create report
      const { data: newReport, error } = await supabase
        .from("technical_reports")
        .insert({
          organization_id: organizationId,
          client_id: service.client_id,
          service_id: serviceId,
          technician_id: service.assigned_to || user?.id || null,
          responsible_technician_name: techName,
          report_date: new Date().toISOString().slice(0, 10),
          status: "draft",
          equipment_quantity: 1,
          inspection_checklist: [],
          measurements: {},
          needs_quote: false,
          equipment_working: "yes",
        })
        .select("id")
        .single();
      if (error) throw error;
      return newReport?.id || null;
    },
    enabled: !!serviceId && !!organizationId,
    staleTime: Infinity,
  });

  // Initialize equipment report data entries
  const initEquipmentReports = useMutation({
    mutationFn: async () => {
      if (!serviceId || !organizationId || !reportId) return;

      const equipmentWithoutData = equipmentList.filter((e) => !e.reportData);
      if (equipmentWithoutData.length === 0) return;

      const rows = equipmentWithoutData.map((eq) => ({
        organization_id: organizationId,
        service_id: serviceId,
        equipment_id: eq.id,
        report_id: reportId,
        status: "pending",
        checklist: [],
      }));

      const { error } = await supabase
        .from("equipment_report_data" as any)
        .insert(rows as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["execution-equipment", serviceId] });
    },
  });

  // Auto-initialize when data is loaded
  useEffect(() => {
    if (
      reportId &&
      equipmentList.length > 0 &&
      equipmentList.some((e) => !e.reportData) &&
      !initEquipmentReports.isPending
    ) {
      initEquipmentReports.mutate();
    }
  }, [reportId, equipmentList]);

  // Save equipment report data (auto-save)
  const saveEquipmentData = useCallback(
    async (equipmentId: string, data: Partial<EquipmentReportData>) => {
      if (!serviceId) return;

      const updatePayload: Record<string, any> = { updated_at: new Date().toISOString() };
      if ("service_type_performed" in data) updatePayload.service_type_performed = data.service_type_performed;
      if ("problem_identified" in data) updatePayload.problem_identified = data.problem_identified;
      if ("work_performed" in data) updatePayload.work_performed = data.work_performed;
      if ("observations" in data) updatePayload.observations = data.observations;
      if ("checklist" in data) updatePayload.checklist = data.checklist;
      if ("status" in data) updatePayload.status = data.status;

      const { error } = await supabase
        .from("equipment_report_data" as any)
        .update(updatePayload)
        .eq("service_id", serviceId)
        .eq("equipment_id", equipmentId);

      if (error) throw error;
    },
    [serviceId]
  );

  // Debounced auto-save
  const autoSave = useCallback(
    (equipmentId: string, data: Partial<EquipmentReportData>) => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(async () => {
        try {
          await saveEquipmentData(equipmentId, data);
        } catch {
          // Silent fail for auto-save - will retry
        }
      }, 1500);
    },
    [saveEquipmentData]
  );

  // Mark equipment as completed
  const completeEquipment = useMutation({
    mutationFn: async (equipmentId: string) => {
      await saveEquipmentData(equipmentId, { status: "completed" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["execution-equipment", serviceId] });
      toast({ title: "Equipamento concluído ✅" });
    },
  });

  // Check if all equipment is completed
  const allCompleted = equipmentList.length > 0 && equipmentList.every(
    (e) => e.reportData?.status === "completed"
  );

  const completedCount = equipmentList.filter(
    (e) => e.reportData?.status === "completed"
  ).length;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["execution-equipment", serviceId] });
  };

  return {
    equipmentList,
    isLoading: isLoadingEquipment,
    reportId,
    autoSave,
    saveEquipmentData,
    completeEquipment: completeEquipment.mutateAsync,
    allCompleted,
    completedCount,
    totalCount: equipmentList.length,
    invalidate,
  };
}
