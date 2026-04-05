import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { TechnicalReportForm } from "@/components/laudos/TechnicalReportForm";
import { useTechnicalReportMutations, type TechnicalReportFormData } from "@/hooks/useTechnicalReports";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useReportEquipment } from "@/hooks/useReportEquipment";
import type { LocalReportEquipment } from "@/components/laudos/ReportEquipmentEditor";
import { materializeReportPDF } from "@/lib/materializePDF";

export default function NovoLaudo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get("service_id");
  const quoteServiceId = searchParams.get("quote_service_id");
  const { create, isCreating } = useTechnicalReportMutations();
  const { clients } = useClients();
  const { organizationId } = useAuth();

  const prefillId = serviceId || quoteServiceId;
  const { data: prefillService, isLoading: prefillLoading } = useQuery({
    queryKey: ["prefill-service", prefillId],
    queryFn: async () => {
      if (!prefillId) return null;
      const { data } = await supabase
        .from("services")
        .select(`
          *,
          client:clients!client_id(name, phone, email, address, city, state, zip_code),
          assigned_profile:profiles!assigned_to(full_name)
        `)
        .eq("id", prefillId)
        .maybeSingle();
      return data;
    },
    enabled: !!prefillId,
  });

  const handleSubmit = async (data: TechnicalReportFormData, equipment: LocalReportEquipment[]) => {
    const result = await create(data);

    // Save equipment
    if (equipment.length > 0 && organizationId) {
      for (const eq of equipment) {
        await supabase.from("report_equipment").insert([{
          report_id: result.id,
          organization_id: organizationId,
          equipment_number: eq.equipment_number || 1,
          equipment_type: eq.equipment_type || null,
          equipment_brand: eq.equipment_brand || null,
          equipment_model: eq.equipment_model || null,
          capacity_btus: eq.capacity_btus || null,
          serial_number: eq.serial_number || null,
          equipment_location: eq.equipment_location || null,
          inspection_checklist: JSON.parse(JSON.stringify(eq.inspection_checklist || [])),
          condition_found: eq.condition_found || null,
          procedure_performed: eq.procedure_performed || null,
          technical_observations: eq.technical_observations || null,
          impact_level: eq.impact_level || "low",
          services_performed: eq.services_performed || null,
          equipment_condition: eq.equipment_condition || null,
          cleanliness_status: eq.cleanliness_status || "clean",
          equipment_working: eq.equipment_working || "yes",
          final_status: eq.final_status || "operational",
          measurements: eq.measurements || {},
        }]);
      }
    }
    // Materialize PDF in background
    if (organizationId) {
      materializeReportPDF(result.id, organizationId).catch(() => {});
    }

    navigate(`/laudos/${result.id}`);
  };

  if (prefillLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Novo Laudo Técnico</h1>
        </div>
      </div>

      <TechnicalReportForm
        clients={clients}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        isSubmitting={isCreating}
        defaultServiceId={serviceId}
        defaultQuoteServiceId={quoteServiceId}
        defaultClientId={prefillService?.client_id || ""}
      />
    </AppLayout>
  );
}
