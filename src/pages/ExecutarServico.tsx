import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { Loader2, CheckCircle, PenLine, User, Briefcase, FileText, DollarSign } from "lucide-react";
import { useServiceExecutionMode } from "@/hooks/useServiceExecutionMode";
import { EquipmentListView } from "@/components/services/execution/EquipmentListView";
import { EquipmentReportForm } from "@/components/services/execution/EquipmentReportForm";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServices } from "@/hooks/useServices";
import { toast } from "@/hooks/use-toast";
import { SignatureCanvas } from "@/components/services/SignatureCanvas";
import { useServiceSignatures } from "@/hooks/useServiceSignatures";
import { ServiceCompleteDialog } from "@/components/services/ServiceCompleteDialog";
import { SendReceiptDialog } from "@/components/services/SendReceiptDialog";
import type { ServicePaymentInput } from "@/hooks/useServicePayments";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
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
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ExecutarServico() {
  const { id: serviceId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selectedEquipmentId, setSelectedEquipmentId] = useState<string | null>(null);
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false);
  const [showSignatureView, setShowSignatureView] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);

  const {
    equipmentList,
    isLoading,
    reportId,
    autoSave,
    forceSave,
    savingStatus,
    saveEquipmentData,
    completeEquipment,
    allCompleted,
    completedCount,
    totalCount,
    invalidate,
    standardChecklist,
  } = useServiceExecutionMode(serviceId);

  const { updateStatus } = useServices({ skipQuery: true });
  const { createSignature, isCreating: isSavingSignature } = useServiceSignatures(serviceId);

  // Fetch service details including value for payment flow
  const { data: service } = useQuery({
    queryKey: ["service-execution-detail", serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const { data } = await supabase
        .from("services")
        .select("id, description, quote_number, status, value, payment_method, client:clients!client_id(name)")
        .eq("id", serviceId)
        .single();
      return data;
    },
    enabled: !!serviceId,
  });

  const serviceValue = service?.value ?? 0;

  const selectedEquipment = selectedEquipmentId
    ? equipmentList.find((e) => e.id === selectedEquipmentId) || null
    : null;

  // Finalize without payment (value = 0)
  const handleFinalizeService = async (payments?: ServicePaymentInput[], signatureBlob?: Blob | null, signerName?: string) => {
    if (!serviceId) return;
    try {
      // Finalize the technical report (draft → finalized)
      if (reportId) {
        await supabase
          .from("technical_reports")
          .update({ status: "finalized", updated_at: new Date().toISOString() })
          .eq("id", reportId);
      }

      const mainMethod = payments?.[0]?.payment_method;
      await updateStatus({
        id: serviceId,
        status: "completed",
        ...(mainMethod ? { paymentMethod: mainMethod } : {}),
        ...(payments && payments.length > 0 ? { payments } : {}),
      });
      if (signatureBlob) {
        await createSignature({ serviceId, blob: signatureBlob, signerName });
      }
      toast({ title: "Serviço finalizado com sucesso! 🚀" });
      navigate("/meus-servicos");
    } catch (e: any) {
      toast({ variant: "destructive", title: "Erro", description: e.message });
    }
  };

  // Called from ServiceCompleteDialog (has value)
  const handleCompleteWithPayments = async (payments: ServicePaymentInput[], signatureBlob?: Blob | null, signerName?: string) => {
    await handleFinalizeService(payments, signatureBlob, signerName);
    setShowCompleteDialog(false);
  };

  // Called from signature-only view (no value)
  const handleSaveSignature = async (blob: Blob, signerName: string) => {
    if (!serviceId) return;
    try {
      await createSignature({ serviceId, blob, signerName });
      await handleFinalizeService();
    } catch (e: any) {
      // Error handled by hook toast
    }
  };

  // User clicks "Assinar e Concluir" from finalize dialog
  const handleProceedToFinalization = () => {
    setShowFinalizeDialog(false);
    if (serviceValue > 0) {
      // Has value → open payment + signature dialog
      setShowCompleteDialog(true);
    } else {
      // No value → signature only
      setShowSignatureView(true);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center py-32 space-y-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-medium">Carregando fluxo de execução...</p>
        </div>
      </AppLayout>
    );
  }

  if (showSignatureView) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto space-y-6 pb-24">
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Finalização</h1>
            <p className="text-sm text-muted-foreground">Para concluir, capture as assinaturas necessárias.</p>
          </div>

          <Card className="overflow-hidden border-2 border-primary/10">
            <CardContent className="p-0">
              <div className="bg-primary/5 p-4 border-b">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <span className="font-bold text-sm">Assinatura do Cliente</span>
                </div>
              </div>
              <div className="p-4 bg-white">
                <SignatureCanvas
                  onSave={handleSaveSignature}
                  height={220}
                  showControls={true}
                  showSignerName={true}
                  signerNameRequired={true}
                  signerNameLabel="Nome do Cliente/Responsável"
                  showConfirmButton={true}
                  confirmLabel={isSavingSignature ? "Salvando..." : "Finalizar e Assinar"}
                  disabled={isSavingSignature}
                />
              </div>
            </CardContent>
          </Card>

          <Button 
            variant="ghost" 
            className="w-full text-muted-foreground"
            onClick={() => setShowSignatureView(false)}
            disabled={isSavingSignature}
          >
            Voltar para lista
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-lg mx-auto h-full">
        {selectedEquipment ? (
          <EquipmentReportForm
            equipment={selectedEquipment}
            reportId={reportId || null}
            onBack={() => {
              setSelectedEquipmentId(null);
              invalidate();
            }}
            onAutoSave={autoSave}
            forceSave={forceSave}
            savingStatus={savingStatus}
            onSave={saveEquipmentData}
            onComplete={async (eqId) => {
              await completeEquipment(eqId);
              setSelectedEquipmentId(null);
            }}
            standardChecklist={standardChecklist}
          />
        ) : (
          <div className="space-y-6">
            <EquipmentListView
              equipment={equipmentList}
              completedCount={completedCount}
              totalCount={totalCount}
              onSelectEquipment={setSelectedEquipmentId}
              onBack={() => navigate(-1)}
              onFinalize={() => setShowFinalizeDialog(true)}
              allCompleted={allCompleted}
              clientName={service?.client?.name}
            />
          </div>
        )}
      </div>

      {/* Confirmation dialog before finalization */}
      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent className="rounded-3xl max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-emerald-500" /> Tudo pronto!
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              Você preencheu o laudo de todos os equipamentos ({totalCount}/{totalCount}). 
              Deseja finalizar o atendimento agora?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-1 gap-3 py-2">
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <FileText className="h-5 w-5 text-primary" />
              <div className="text-xs">
                <p className="font-bold">Laudo Técnico Gerado</p>
                <p className="text-muted-foreground">O PDF será gerado automaticamente.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
              <Briefcase className="h-5 w-5 text-primary" />
              <div className="text-xs">
                <p className="font-bold">OS Atualizada</p>
                <p className="text-muted-foreground">Status passará para "Concluída".</p>
              </div>
            </div>
            {serviceValue > 0 && (
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-xl">
                <DollarSign className="h-5 w-5 text-primary" />
                <div className="text-xs">
                  <p className="font-bold">Pagamento</p>
                  <p className="text-muted-foreground">
                    Você informará o pagamento de{" "}
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(serviceValue)}.
                  </p>
                </div>
              </div>
            )}
          </div>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="w-full sm:w-auto rounded-xl h-12">Revisar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleProceedToFinalization}
              className="w-full sm:w-auto rounded-xl h-12 bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20"
            >
              {serviceValue > 0 ? "Pagamento e Assinatura" : "Assinar e Concluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Payment + Signature dialog (reuses the same component as OS details) */}
      <ServiceCompleteDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        serviceValue={serviceValue}
        onConfirm={handleCompleteWithPayments}
      />
    </AppLayout>
  );
}