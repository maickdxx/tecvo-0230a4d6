import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { TechnicalReportForm } from "@/components/laudos/TechnicalReportForm";
import { ReportPhotoUploader } from "@/components/laudos/ReportPhotoUploader";
import { useTechnicalReport, useTechnicalReportMutations, type TechnicalReportFormData } from "@/hooks/useTechnicalReports";
import { useClients } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { useReportEquipment } from "@/hooks/useReportEquipment";
import { supabase } from "@/integrations/supabase/client";
import type { LocalReportEquipment } from "@/components/laudos/ReportEquipmentEditor";

export default function EditarLaudo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { report, isLoading } = useTechnicalReport(id);
  const { update, isUpdating } = useTechnicalReportMutations();
  const { clients } = useClients();
  const { organizationId } = useAuth();
  const { equipment: existingEquipment, isLoading: eqLoading } = useReportEquipment(id);

  const handleSubmit = async (data: TechnicalReportFormData, equipment: LocalReportEquipment[]) => {
    if (!id || !organizationId) return;
    await update({ id, data });

    // Delete existing equipment and re-insert
    await supabase.from("report_equipment").delete().eq("report_id", id);

    for (const eq of equipment) {
      await supabase.from("report_equipment").insert([{
        report_id: id,
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

    navigate(`/laudos/${id}`);
  };

  if (isLoading || eqLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Laudo não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/laudos")}>
            Voltar
          </Button>
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
          <h1 className="text-2xl font-bold text-foreground">
            Editar Laudo #{report.report_number.toString().padStart(4, "0")}
          </h1>
        </div>
      </div>

      <TechnicalReportForm
        report={report}
        clients={clients}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        isSubmitting={isUpdating}
        existingEquipment={existingEquipment}
      />

      {id && (
        <div className="max-w-3xl mx-auto mt-4 mb-8">
          <ReportPhotoUploader reportId={id} />
        </div>
      )}
    </AppLayout>
  );
}
