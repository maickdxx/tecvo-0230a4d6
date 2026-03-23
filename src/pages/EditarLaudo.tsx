import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { TechnicalReportForm } from "@/components/laudos/TechnicalReportForm";
import { useTechnicalReport, useTechnicalReportMutations, type TechnicalReportFormData } from "@/hooks/useTechnicalReports";
import { useClients } from "@/hooks/useClients";

export default function EditarLaudo() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { report, isLoading } = useTechnicalReport(id);
  const { update, isUpdating } = useTechnicalReportMutations();
  const { clients } = useClients();

  const handleSubmit = async (data: TechnicalReportFormData) => {
    if (!id) return;
    await update({ id, data });
    navigate(`/laudos/${id}`);
  };

  if (isLoading) {
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
      />
    </AppLayout>
  );
}
