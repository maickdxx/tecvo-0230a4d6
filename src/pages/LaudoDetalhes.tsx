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
        equipment: reportEquipment,
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

        {/* Visit Reason */}
        {report.visit_reason && (
          <SectionCard icon={ClipboardCheck} title="Motivo da Visita">
            <p className="text-sm whitespace-pre-wrap">{report.visit_reason}</p>
          </SectionCard>
        )}

        {/* Multi-Equipment Blocks */}
        {reportEquipment.length > 0 ? (
          <div className="space-y-5">
            {reportEquipment.length > 1 && (
              <div className="flex items-center gap-2 px-1">
                <Wrench className="h-4 w-4 text-primary" />
                <h2 className="text-base font-bold text-foreground">Equipamentos Inspecionados</h2>
                <Badge variant="secondary" className="ml-auto text-xs">{reportEquipment.length} {reportEquipment.length === 1 ? "equipamento" : "equipamentos"}</Badge>
              </div>
            )}
            {reportEquipment.map((eq, idx) => {
              const eqChecklist = (eq.inspection_checklist as any[]) || [];
              const eqMeasurements = (eq.measurements as Record<string, string>) || {};
              const finalStatusColor = eq.final_status === "operational"
                ? "bg-green-500/10 text-green-700 border-green-200"
                : eq.final_status === "operational_with_caveats"
                ? "bg-amber-500/10 text-amber-700 border-amber-200"
                : "bg-red-500/10 text-red-700 border-red-200";

              return (
                <Card key={eq.id} className="border-l-4 border-l-primary/60 shadow-sm">
                  <CardContent className="p-0">
                    {/* Equipment Header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-muted/40 border-b border-border/60">
                      <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-foreground">
                            {eq.equipment_type || `Equipamento ${idx + 1}`}
                          </h3>
                          {(eq.equipment_brand || eq.equipment_model) && (
                            <p className="text-xs text-muted-foreground">
                              {[eq.equipment_brand, eq.equipment_model].filter(Boolean).join(" • ")}
                            </p>
                          )}
                        </div>
                      </div>
                      {eq.final_status && (
                        <Badge className={cn("text-xs font-semibold border", finalStatusColor)}>
                          {FINAL_STATUS_OPTIONS[eq.final_status] || eq.final_status}
                        </Badge>
                      )}
                    </div>

                    <div className="p-5 space-y-5">
                      {/* Equipment Identification */}
                      <div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                          <Wrench className="h-3 w-3" /> Identificação Técnica
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 bg-muted/20 rounded-lg p-3 border border-border/40">
                          <InfoRow label="Tipo" value={eq.equipment_type} />
                          <InfoRow label="Marca" value={eq.equipment_brand} />
                          <InfoRow label="Modelo" value={eq.equipment_model} />
                          <InfoRow label="Capacidade" value={eq.capacity_btus ? `${eq.capacity_btus} BTUs` : null} />
                          <InfoRow label="Nº Série" value={eq.serial_number} />
                          <InfoRow label="Localização" value={eq.equipment_location} />
                        </div>
                      </div>

                      {/* Checklist */}
                      {eqChecklist.length > 0 && (
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <ClipboardCheck className="h-3 w-3" /> Checklist de Inspeção
                          </p>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 bg-muted/10 rounded-lg p-3 border border-border/30">
                            {eqChecklist.map((item: any) => {
                              const label = CHECKLIST_ITEMS.find((c) => c.key === item.key)?.label || item.key;
                              const statusIcon = item.status === "ok" ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                : item.status === "attention" ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                                : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
                              const statusBadge = item.status === "ok" ? "text-green-700 bg-green-50 border-green-200"
                                : item.status === "attention" ? "text-amber-700 bg-amber-50 border-amber-200"
                                : "text-red-700 bg-red-50 border-red-200";
                              return (
                                <div key={item.key} className="flex items-center gap-2 text-sm py-1 border-b border-border/30 last:border-0">
                                  {statusIcon}
                                  <span className="text-foreground/80">{label}</span>
                                  <Badge variant="outline" className={cn("ml-auto text-[10px] px-1.5 py-0 h-5 border", statusBadge)}>
                                    {item.status === "ok" ? "OK" : item.status === "attention" ? "Atenção" : "Crítico"}
                                  </Badge>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Diagnosis */}
                      {(eq.condition_found || eq.procedure_performed || eq.technical_observations) && (
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
                            <Stethoscope className="h-3 w-3" /> Diagnóstico Técnico
                          </p>
                          <div className="space-y-4 rounded-lg border border-border/40 p-4 bg-muted/10">
                            {eq.condition_found && (
                              <div>
                                <p className="text-xs font-semibold text-primary mb-1">Condição encontrada</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{eq.condition_found}</p>
                              </div>
                            )}
                            {eq.procedure_performed && (
                              <div>
                                <p className="text-xs font-semibold text-primary mb-1">Procedimento realizado</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{eq.procedure_performed}</p>
                              </div>
                            )}
                            {eq.technical_observations && (
                              <div>
                                <p className="text-xs font-semibold text-primary mb-1">Observações técnicas</p>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{eq.technical_observations}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Impact */}
                      {eq.impact_level && (
                        <div className={cn("p-3 rounded-lg border",
                          eq.impact_level === "low" ? "bg-green-50 border-green-200" :
                          eq.impact_level === "medium" ? "bg-amber-50 border-amber-200" :
                          "bg-red-50 border-red-200"
                        )}>
                          <p className="text-xs font-bold uppercase mb-0.5 flex items-center gap-1.5">
                            <ShieldAlert className="h-3 w-3" />
                            Impacto: {IMPACT_LEVELS[eq.impact_level]?.label || eq.impact_level}
                          </p>
                          <p className="text-xs text-foreground/80">{IMPACT_LEVELS[eq.impact_level]?.description}</p>
                        </div>
                      )}

                      {/* Measurements */}
                      {Object.values(eqMeasurements).some(Boolean) && (
                        <div>
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Gauge className="h-3 w-3" /> Medições
                          </p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {eqMeasurements.pressure && (
                              <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/40">
                                <p className="text-lg font-bold text-foreground">{eqMeasurements.pressure}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">PSI</p>
                              </div>
                            )}
                            {eqMeasurements.temperature && (
                              <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/40">
                                <p className="text-lg font-bold text-foreground">{eqMeasurements.temperature}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">°C</p>
                              </div>
                            )}
                            {eqMeasurements.voltage_measured && (
                              <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/40">
                                <p className="text-lg font-bold text-foreground">{eqMeasurements.voltage_measured}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Volts</p>
                              </div>
                            )}
                            {eqMeasurements.current_measured && (
                              <div className="text-center p-2 rounded-lg bg-muted/30 border border-border/40">
                                <p className="text-lg font-bold text-foreground">{eqMeasurements.current_measured}</p>
                                <p className="text-[10px] text-muted-foreground uppercase">Amperes</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
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
        {report.interventions_performed && (
          <SectionCard icon={Wrench} title={reportEquipment.length > 0 ? "Serviços Gerais da OS" : "Serviços Executados"}>
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {report.interventions_performed}
            </p>
          </SectionCard>
        )}

        {/* Recommendation & Strategy */}
        {report.recommendation && (
          <SectionCard icon={MessageSquare} title="Parecer e Recomendação">
            <p className="text-sm whitespace-pre-wrap">{report.recommendation}</p>
          </SectionCard>
        )}

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

        {/* Observations */}
        {report.observations && (
          <SectionCard icon={MessageSquare} title="Observações Finais">
            <p className="text-sm whitespace-pre-wrap">{report.observations}</p>
          </SectionCard>
        )}

        {/* Conclusion / Final Status */}
        {(() => {
          // Derive overall status from equipment or legacy field
          let overallStatus = "operational";
          if (reportEquipment.length > 0) {
            const statuses = reportEquipment.map((eq) => eq.final_status || "operational");
            if (statuses.includes("non_operational")) overallStatus = "non_operational";
            else if (statuses.includes("operational_with_caveats")) overallStatus = "operational_with_caveats";
          } else {
            if (report.equipment_working === "no") overallStatus = "non_operational";
            else if (report.equipment_working === "partial") overallStatus = "operational_with_caveats";
          }
          const statusColors = {
            operational: { bg: "bg-green-50 border-green-100", icon: "text-green-600", title: "text-green-900", text: "text-green-800" },
            operational_with_caveats: { bg: "bg-amber-50 border-amber-100", icon: "text-amber-600", title: "text-amber-900", text: "text-amber-800" },
            non_operational: { bg: "bg-red-50 border-red-100", icon: "text-red-600", title: "text-red-900", text: "text-red-800" },
          };
          const statusLabel = overallStatus === "operational" ? "Operacional" : overallStatus === "operational_with_caveats" ? "Operacional com Ressalvas" : "Não Operacional";
          const c = statusColors[overallStatus as keyof typeof statusColors];
          const StatusIcon = overallStatus === "operational" ? CheckCircle2 : overallStatus === "operational_with_caveats" ? AlertTriangle : XCircle;

          return (
            <SectionCard icon={ClipboardCheck} title="Status Final do Atendimento">
              <div className={cn("flex items-start gap-3 p-3 rounded-lg border", c.bg)}>
                <StatusIcon className={cn("h-5 w-5 shrink-0 mt-0.5", c.icon)} />
                <div>
                  <p className={cn("text-sm font-bold", c.title)}>{statusLabel}</p>
                  {report.conclusion && (
                    <p className={cn("text-sm whitespace-pre-wrap mt-1", c.text)}>{report.conclusion}</p>
                  )}
                </div>
              </div>
            </SectionCard>
          );
        })()}

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
