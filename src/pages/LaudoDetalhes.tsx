import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { useReportPhotos, PHOTO_CATEGORY_LABELS, type PhotoCategory } from "@/hooks/useReportPhotos";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Edit, Trash2, Download, Loader2, User, Wrench, ClipboardCheck,
  Stethoscope, Gauge, ShieldAlert, MessageSquare, FileText, Link2, CheckCircle2, XCircle,
  AlertTriangle,
} from "lucide-react";
import { useTechnicalReport, useTechnicalReportMutations, REPORT_STATUS_LABELS, EQUIPMENT_CONDITIONS, CLEANLINESS_STATUS, INSPECTION_ITEMS } from "@/hooks/useTechnicalReports";
import { useReportEquipment, CHECKLIST_ITEMS, IMPACT_LEVELS, FINAL_STATUS_OPTIONS, type ReportEquipment } from "@/hooks/useReportEquipment";
import { useServiceSignatures } from "@/hooks/useServiceSignatures";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatDateInTz } from "@/lib/timezone";
import { generateReportPDF } from "@/lib/generateReportPDF";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useDocumentGuard } from "@/hooks/useDocumentGuard";
import { CompanyDataCompletionModal } from "@/components/onboarding/CompanyDataCompletionModal";

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline gap-4 py-1.5">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

export default function LaudoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { report, isLoading } = useTechnicalReport(id);
  const { photos } = useReportPhotos(id);
  const { equipment: reportEquipment, isLoading: eqLoading } = useReportEquipment(id);
  const { remove } = useTechnicalReportMutations();
  const { organization } = useOrganization();
  const tz = useOrgTimezone();
  const { signature } = useServiceSignatures(report?.service_id || undefined);
  const [showDelete, setShowDelete] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { guardAction, modalOpen: companyModalOpen, closeModal: closeCompanyModal, onDataSaved: onCompanyDataSaved } = useDocumentGuard();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!report) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Laudo não encontrado</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/laudos")}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  const checklist = (report.inspection_checklist as string[]) || [];
  const measurements = (report.measurements as Record<string, string>) || {};
  const conditionLabel = report.equipment_condition ? EQUIPMENT_CONDITIONS[report.equipment_condition] || report.equipment_condition : null;
  const workingLabel = report.equipment_working === "yes" ? "Sim" : report.equipment_working === "no" ? "Não" : "Parcial";

  const handlePDF = async () => {
    setIsDownloading(true);
    try {
      await generateReportPDF({
        report,
        photos,
        organizationName: organization?.name || "Minha Empresa",
        organizationCnpj: organization?.cnpj_cpf || undefined,
        organizationPhone: organization?.phone || undefined,
        organizationEmail: organization?.email || undefined,
        organizationAddress: organization?.address || undefined,
        organizationLogo: organization?.logo_url || undefined,
        organizationCity: organization?.city || undefined,
        organizationState: organization?.state || undefined,
        timezone: tz,
        signature,
      });
      toast({ title: "PDF gerado!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro", description: (err as Error).message });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    await remove(report.id);
    setShowDelete(false);
    navigate("/laudos");
  };

  const statusClass = report.status === "finalized"
    ? "bg-green-500/10 text-green-700 border-green-200"
    : "bg-amber-500/10 text-amber-700 border-amber-200";

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 py-4 md:py-6 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="shrink-0 h-9 w-9" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-bold text-foreground">
                  Laudo #{report.report_number.toString().padStart(4, "0")}
                </h1>
                <Badge className={cn("text-xs font-medium border", statusClass)}>
                  {REPORT_STATUS_LABELS[report.status] || report.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">{report.client?.name}</p>
            </div>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navigate(`/laudos/editar/${report.id}`)}>
              <Edit className="h-3.5 w-3.5" /> Editar
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => guardAction(handlePDF)} disabled={isDownloading}>
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              PDF
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={() => setShowDelete(true)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Links */}
        {(report.service || report.quote_service) && (
          <Card className="bg-muted/30 border-dashed">
            <CardContent className="p-3 flex flex-wrap gap-2">
              {report.service && (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px] uppercase font-bold tracking-wider" onClick={() => navigate(`/ordens-servico/${report.service_id}`)}>
                  <Link2 className="h-3 w-3" />
                  Ordem de Serviço #{report.service.quote_number?.toString().padStart(4, "0")}
                </Button>
              )}
              {report.quote_service && (
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px] uppercase font-bold tracking-wider" onClick={() => navigate(`/orcamentos/editar/${report.quote_service_id}`)}>
                  <Link2 className="h-3 w-3" />
                  Orçamento #{report.quote_service.quote_number?.toString().padStart(4, "0")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Executing Company */}
          <SectionCard icon={FileText} title="Empresa Responsável">
            <p className="text-sm font-bold">{organization?.name || "—"}</p>
            <InfoRow label="CNPJ" value={organization?.cnpj_cpf} />
            <InfoRow label="Telefone" value={organization?.phone} />
            <InfoRow label="E-mail" value={organization?.email} />
            <InfoRow label="Endereço" value={[organization?.address, organization?.city, organization?.state].filter(Boolean).join(", ")} />
          </SectionCard>

          {/* Client */}
          <SectionCard icon={User} title="Contratante (Cliente)">
            <p className="text-sm font-bold">{report.client?.name || "—"}</p>
            <InfoRow label="Telefone" value={report.client?.phone} />
            <InfoRow label="E-mail" value={report.client?.email} />
            <InfoRow label="Endereço" value={[report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", ")} />
          </SectionCard>
        </div>

        {/* Issuance Info */}
        <SectionCard icon={ClipboardCheck} title="Dados de Emissão">
          <div className="grid grid-cols-2 gap-4">
            <InfoRow label="Data" value={formatDateInTz(report.report_date, tz)} />
            <InfoRow label="Técnico" value={report.technician_profile?.full_name || report.responsible_technician_name} />
          </div>
        </SectionCard>

        {/* Equipment */}
        {(report.equipment_type || report.equipment_brand) && (
          <SectionCard icon={Wrench} title="Identificação do Ativo">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4">
              <InfoRow label="Tipo" value={report.equipment_type} />
              <InfoRow label="Marca" value={report.equipment_brand} />
              <InfoRow label="Modelo" value={report.equipment_model} />
              <InfoRow label="Capacidade" value={report.capacity_btus ? `${report.capacity_btus} BTUs` : null} />
              <InfoRow label="Nº Série" value={report.serial_number} />
              <InfoRow label="Local" value={report.equipment_location} />
            </div>
          </SectionCard>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <SectionCard icon={ClipboardCheck} title="Inspeção e Conformidade">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
              {INSPECTION_ITEMS.filter(i => checklist.includes(i.key)).map((item) => (
                <div key={item.key} className="flex items-center gap-2 text-[13px] py-0.5 border-b border-border/50 last:border-0">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="ml-auto font-medium text-[11px] text-green-700 bg-green-50 px-1.5 rounded">OK</span>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Diagnosis */}
        <SectionCard icon={Stethoscope} title="Diagnóstico Técnico">
          <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed break-words overflow-hidden">
            {report.diagnosis || "Inspeção técnica detalhada realizada para avaliação das condições operacionais."}
          </p>
          <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/10">
            <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-1.5">Impacto Identificado</p>
            <p className="text-sm break-words">
              {report.equipment_working === "no" 
                ? "Impacto Crítico: Parada total do sistema, comprometendo o ambiente/processo."
                : report.equipment_working === "partial"
                ? "Impacto Moderado: Operação ineficiente e risco de parada definitiva."
                : "Impacto Baixo: Requer manutenção para garantir a longevidade do ativo."}
            </p>
          </div>
        </SectionCard>

        {/* Measurements */}
        {Object.keys(measurements).filter((k) => measurements[k]).length > 0 && (
          <SectionCard icon={Gauge} title="Dados Operacionais Aferidos">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <InfoRow label="Pressão" value={measurements.pressure ? `${measurements.pressure} PSI` : null} />
              <InfoRow label="Temperatura" value={measurements.temperature ? `${measurements.temperature} °C` : null} />
              <InfoRow label="Tensão" value={measurements.voltage_measured ? `${measurements.voltage_measured} V` : null} />
              <InfoRow label="Corrente" value={measurements.current_measured ? `${measurements.current_measured} A` : null} />
            </div>
            {measurements.notes && (
              <div className="mt-2 pt-2 border-t border-border">
                <span className="text-[10px] font-bold text-muted-foreground uppercase">Observações de Medição</span>
                <p className="text-sm mt-1 text-foreground">{measurements.notes}</p>
              </div>
            )}
          </SectionCard>
        )}

        {/* Services Executed */}
        <SectionCard icon={Wrench} title="Serviços Executados">
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {report.interventions_performed || (report.status === "finalized" ? "Limpeza técnica, higienização, reaperto de conexões e testes funcionais realizados." : "Aguardando detalhamento das intervenções.")}
          </p>
        </SectionCard>

        {/* Recommendation & Strategy */}
        <SectionCard icon={MessageSquare} title="Parecer e Recomendação">
          <div className="space-y-4">
            {report.recommendation && (
              <div>
                <p className="text-[11px] font-bold text-blue-600 uppercase mb-1">Diretriz Técnica</p>
                <p className="text-sm whitespace-pre-wrap">{report.recommendation}</p>
              </div>
            )}
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
              <p className="text-[11px] font-bold text-blue-700 uppercase mb-1">Sugestão Estratégica</p>
              <p className="text-sm text-blue-900">
                Implementar Plano de Manutenção Preventiva (PMOC) para garantir eficiência energética e conformidade legal.
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Risks */}
        {report.risks && (
          <SectionCard icon={ShieldAlert} title="Análise de Risco">
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <p className="text-sm text-destructive-foreground whitespace-pre-wrap italic">
                {report.risks}
              </p>
            </div>
          </SectionCard>
        )}

        {/* Conclusion / Final Status */}
        <SectionCard icon={ClipboardCheck} title="Status Após Intervenção">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 border border-green-100">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-green-900">Condição Final de Entrega</p>
              <p className="text-sm text-green-800 whitespace-pre-wrap mt-1">
                {report.conclusion || (report.equipment_working === "yes" ? "Equipamento normalizado e em operação regular." : "Equipamento em aguardo de peças/orçamento.")}
              </p>
            </div>
          </div>
        </SectionCard>

        {/* Signature Integration */}
        {signature && (
          <SectionCard icon={User} title="Validação Digital">
            <div className="flex flex-col md:flex-row items-center gap-6 p-4 bg-muted/20 rounded-xl border border-dashed">
              {signature.signature_url && (
                <div className="bg-white p-2 rounded border shadow-sm">
                  <img src={signature.signature_url} alt="Assinatura" className="h-16 object-contain" />
                </div>
              )}
              <div className="text-center md:text-left">
                <p className="text-sm font-bold">{signature.signer_name || report.client?.name}</p>
                <p className="text-xs text-muted-foreground">
                  Assinado em {signature.signed_at ? formatDateInTz(signature.signed_at, tz) : "---"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  IP: {signature.ip_address || "---"} | Ref. OS: #{report.service?.quote_number?.toString().padStart(4, "0")}
                </p>
              </div>
            </div>
          </SectionCard>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <SectionCard icon={Camera} title="Evidências Fotográficas">
            {(["before", "problem", "after"] as PhotoCategory[]).map((cat) => {
              const catPhotos = photos.filter((p) => p.category === cat);
              if (catPhotos.length === 0) return null;
              return (
                <div key={cat} className="mb-4 last:mb-0">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2 border-l-2 border-primary pl-2">
                    {PHOTO_CATEGORY_LABELS[cat]}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {catPhotos.map((photo) => (
                      <div key={photo.id} className="group relative rounded-lg overflow-hidden border border-border aspect-square bg-muted">
                        <img
                          src={photo.photo_url}
                          alt={photo.caption || PHOTO_CATEGORY_LABELS[cat]}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </SectionCard>
        )}
      </div>

      <AlertDialog open={showDelete} onOpenChange={setShowDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir laudo técnico?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompanyDataCompletionModal
        open={companyModalOpen}
        onClose={closeCompanyModal}
        onSaved={onCompanyDataSaved}
      />
    </AppLayout>
  );
}
