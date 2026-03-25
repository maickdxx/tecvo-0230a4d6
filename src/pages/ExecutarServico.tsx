import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { Loader2 } from "lucide-react";
import { useServiceExecutionMode } from "@/hooks/useServiceExecutionMode";
import { EquipmentListView } from "@/components/services/execution/EquipmentListView";
import { EquipmentReportForm } from "@/components/services/execution/EquipmentReportForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ExecutarServico() {
  const { id: serviceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);

  const {
    equipmentList,
    isLoading,
    reportId,
    autoSave,
    saveEquipmentData,
    completeEquipment,
    allCompleted,
    completedCount,
    totalCount,
    invalidate,
  } = useServiceExecutionMode(serviceId);

  const { updateStatus } = useServices({ skipQuery: true });

  // Fetch service details (client name, etc.)
  const { data: service } = useQuery({
    queryKey: ["service-execution-detail", serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const { data } = await supabase
        .from("services")
        .select("id, description, quote_number, status, client:clients!client_id(name)")
        .eq("id", serviceId)
        .single();
      return data;
    },
    enabled: !!serviceId,
  });

  const selectedEquipment = selectedEquipmentId
    ? equipmentList.find((e) => e.id === selectedEquipmentId) || null
    : null;

  const handleFinalize = async () => {
    if (!serviceId) return;
    try {
      await updateStatus({ id: serviceId, status: "completed" });
      toast({ title: "Atendimento finalizado! ✅" });
      navigate("/meus-servicos");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
    setShowFinalizeDialog(false);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto">
        {selectedEquipment ? (
          <EquipmentReportForm
            equipment={selectedEquipment}
            reportId={reportId || null}
            onBack={() => {
              setSelectedEquipmentId(null);
              invalidate();
            }}
            onAutoSave={autoSave}
            onSave={saveEquipmentData}
            onComplete={async (eqId) => {
              await completeEquipment(eqId);
              setSelectedEquipmentId(null);
            }}
          />
        ) : (
          <EquipmentListView
            equipment={equipmentList}
            completedCount={completedCount}
            totalCount={totalCount}
            onSelectEquipment={setSelectedEquipmentId}
            onBack={() => navigate(-1)}
            onFinalize={() => setShowFinalizeDialog(true)}
            allCompleted={allCompleted}
            clientName={(service as any)?.client?.name}
          />
        )}
      </div>

      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os equipamentos foram preenchidos. Deseja concluir este atendimento?
              O laudo ficará disponível para revisão administrativa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalize}>
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
