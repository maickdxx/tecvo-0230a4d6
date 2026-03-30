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

        {/* Multi-Equipment Blocks */}
        {reportEquipment.length > 0 ? (
          reportEquipment.map((eq, idx) => {
            const eqChecklist = (eq.inspection_checklist as any[]) || [];
            const eqMeasurements = (eq.measurements as Record<string, string>) || {};
            const finalStatusColor = eq.final_status === "operational"
              ? "bg-green-500/10 text-green-700 border-green-200"
              : eq.final_status === "operational_with_caveats"
              ? "bg-amber-500/10 text-amber-700 border-amber-200"
              : "bg-red-500/10 text-red-700 border-red-200";

            return (
              <Card key={eq.id} className="border-primary/20">
                <CardContent className="p-4 md:p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
                        <Wrench className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <h3 className="text-sm font-semibold">Equipamento {idx + 1}</h3>
                      {eq.equipment_type && <span className="text-sm text-muted-foreground">— {eq.equipment_type}</span>}
                    </div>
                    {eq.final_status && (
                      <Badge className={cn("text-[10px] border", finalStatusColor)}>
                        {FINAL_STATUS_OPTIONS[eq.final_status] || eq.final_status}
                      </Badge>
                    )}
                  </div>

                  {/* Equipment Info */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4">
                    <InfoRow label="Tipo" value={eq.equipment_type} />
                    <InfoRow label="Marca" value={eq.equipment_brand} />
                    <InfoRow label="Modelo" value={eq.equipment_model} />
                    <InfoRow label="Capacidade" value={eq.capacity_btus ? `${eq.capacity_btus} BTUs` : null} />
                    <InfoRow label="Nº Série" value={eq.serial_number} />
                    <InfoRow label="Local" value={eq.equipment_location} />
                  </div>

                  {/* Checklist */}
                  {eqChecklist.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Checklist</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        {eqChecklist.map((item: any) => {
                          const label = CHECKLIST_ITEMS.find((c) => c.key === item.key)?.label || item.key;
                          const statusIcon = item.status === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                            : item.status === "attention" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                            : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
                          const statusBadge = item.status === "ok" ? "text-green-700 bg-green-50"
                            : item.status === "attention" ? "text-amber-700 bg-amber-50"
                            : "text-red-700 bg-red-50";
                          return (
                            <div key={item.key} className="flex items-center gap-2 text-[13px] py-0.5 border-b border-border/50">
                              {statusIcon}
                              <span className="text-muted-foreground">{label}</span>
                              <span className={cn("ml-auto font-medium text-[11px] px-1.5 rounded", statusBadge)}>
                                {item.status === "ok" ? "OK" : item.status === "attention" ? "Atenção" : "Crítico"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Diagnosis */}
                  {(eq.condition_found || eq.procedure_performed) && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Diagnóstico</p>
                      {eq.condition_found && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground">Condição encontrada</p>
                          <p className="text-sm whitespace-pre-wrap">{eq.condition_found}</p>
                        </div>
                      )}
                      {eq.procedure_performed && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground">Procedimento realizado</p>
                          <p className="text-sm whitespace-pre-wrap">{eq.procedure_performed}</p>
                        </div>
                      )}
                      {eq.technical_observations && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground">Observações técnicas</p>
                          <p className="text-sm whitespace-pre-wrap">{eq.technical_observations}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Impact */}
                  {eq.impact_level && (
                    <div className={cn("p-3 rounded-lg border",
                      eq.impact_level === "low" ? "bg-green-50 border-green-100" :
                      eq.impact_level === "medium" ? "bg-amber-50 border-amber-100" :
                      "bg-red-50 border-red-100"
                    )}>
                      <p className="text-[11px] font-bold uppercase mb-0.5">
                        Impacto: {IMPACT_LEVELS[eq.impact_level]?.label || eq.impact_level}
                      </p>
                      <p className="text-xs">{IMPACT_LEVELS[eq.impact_level]?.description}</p>
                    </div>
                  )}

                  {/* Measurements */}
                  {Object.values(eqMeasurements).some(Boolean) && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <InfoRow label="Pressão" value={eqMeasurements.pressure ? `${eqMeasurements.pressure} PSI` : null} />
                      <InfoRow label="Temperatura" value={eqMeasurements.temperature ? `${eqMeasurements.temperature} °C` : null} />
                      <InfoRow label="Tensão" value={eqMeasurements.voltage_measured ? `${eqMeasurements.voltage_measured} V` : null} />
                      <InfoRow label="Corrente" value={eqMeasurements.current_measured ? `${eqMeasurements.current_measured} A` : null} />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        ) : (
          /* Fallback: Legacy single equipment display */
          <>
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
            <SectionCard icon={Stethoscope} title="Diagnóstico Técnico">
              <p className="text-sm whitespace-pre-wrap text-foreground leading-relaxed break-words overflow-hidden">
                {report.diagnosis || "Inspeção técnica detalhada realizada."}
              </p>
            </SectionCard>
          </>
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
