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
  AlertTriangle, Building2, MapPin, Hash, Calendar,
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

/* ─── Helpers ─── */

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline gap-4 py-1.5">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

function PageDivider() {
  return <div className="border-t-2 border-dashed border-primary/20 my-8" />;
}

function getOverallStatus(reportEquipment: ReportEquipment[], report: any) {
  let overallStatus = "operational";
  if (reportEquipment.length > 0) {
    const statuses = reportEquipment.map((eq) => eq.final_status || "operational");
    if (statuses.includes("non_operational")) overallStatus = "non_operational";
    else if (statuses.includes("operational_with_caveats")) overallStatus = "operational_with_caveats";
  } else {
    if (report.equipment_working === "no") overallStatus = "non_operational";
    else if (report.equipment_working === "partial") overallStatus = "operational_with_caveats";
  }
  return overallStatus;
}

const STATUS_COLORS = {
  operational: { bg: "bg-green-50 border-green-200", icon: "text-green-600", title: "text-green-900", badge: "bg-green-500/10 text-green-700 border-green-200" },
  operational_with_caveats: { bg: "bg-amber-50 border-amber-200", icon: "text-amber-600", title: "text-amber-900", badge: "bg-amber-500/10 text-amber-700 border-amber-200" },
  non_operational: { bg: "bg-red-50 border-red-200", icon: "text-red-600", title: "text-red-900", badge: "bg-red-500/10 text-red-700 border-red-200" },
};

const STATUS_LABELS: Record<string, string> = {
  operational: "Operacional",
  operational_with_caveats: "Operacional com Ressalvas",
  non_operational: "Não Operacional",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "operational") return <CheckCircle2 className="h-5 w-5 text-green-600" />;
  if (status === "operational_with_caveats") return <AlertTriangle className="h-5 w-5 text-amber-600" />;
  return <XCircle className="h-5 w-5 text-red-600" />;
}

/* ─── SECTION 1: CAPA EXECUTIVA ─── */

function CoverPage({
  report, organization, tz, reportEquipment,
}: {
  report: any; organization: any; tz: string; reportEquipment: ReportEquipment[];
}) {
  const overallStatus = getOverallStatus(reportEquipment, report);
  const sc = STATUS_COLORS[overallStatus as keyof typeof STATUS_COLORS];

  return (
    <div className="space-y-5">
      {/* Title Block */}
      <div className="text-center py-6 bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl border border-primary/20">
        <FileText className="h-8 w-8 text-primary mx-auto mb-2" />
        <h2 className="text-xl font-bold text-foreground tracking-tight">LAUDO TÉCNICO</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Nº {report.report_number.toString().padStart(4, "0")}
        </p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDateInTz(report.report_date, tz)}</span>
          {(organization?.city || organization?.state) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[organization?.city, organization?.state].filter(Boolean).join("/")}
            </span>
          )}
        </div>
        {report.service && (
          <p className="text-xs text-muted-foreground mt-1">
            Ref. OS #{report.service.quote_number?.toString().padStart(4, "0")}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Empresa */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Empresa Responsável</h3>
            </div>
            <p className="text-sm font-bold text-foreground">{organization?.name || "—"}</p>
            <InfoRow label="CNPJ" value={organization?.cnpj_cpf} />
            <InfoRow label="Telefone" value={organization?.phone} />
            <InfoRow label="E-mail" value={organization?.email} />
            <InfoRow label="Endereço" value={[organization?.address, organization?.city, organization?.state].filter(Boolean).join(", ")} />
          </CardContent>
        </Card>

        {/* Cliente */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <User className="h-3.5 w-3.5 text-primary" />
              </div>
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Contratante</h3>
            </div>
            <p className="text-sm font-bold text-foreground">{report.client?.name || "—"}</p>
            <InfoRow label="Telefone" value={report.client?.phone} />
            <InfoRow label="E-mail" value={report.client?.email} />
            <InfoRow label="Local" value={[report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", ")} />
          </CardContent>
        </Card>
      </div>

      {/* Dados Técnicos */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Wrench className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Dados Técnicos</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
            <InfoRow label="Técnico Responsável" value={report.technician_profile?.full_name || report.responsible_technician_name} />
            <InfoRow label="Data da Visita" value={formatDateInTz(report.report_date, tz)} />
          </div>
          {report.visit_reason && (
            <div className="mt-3 pt-3 border-t border-border/50">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Motivo da Visita</p>
              <p className="text-sm text-foreground whitespace-pre-wrap">{report.visit_reason}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resumo Geral */}
      <Card className={cn("border", sc.bg)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardCheck className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Resumo Geral</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{reportEquipment.length || 1}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Equipamentos</p>
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">{report.service?.service_type || "Inspeção"}</p>
              <p className="text-[10px] text-muted-foreground uppercase">Tipo de Serviço</p>
            </div>
            <div className="flex flex-col items-center">
              <StatusIcon status={overallStatus} />
              <p className="text-[10px] text-muted-foreground uppercase mt-1">{STATUS_LABELS[overallStatus]}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── SECTION 2: PÁGINA POR EQUIPAMENTO ─── */

function EquipmentPage({ eq, index, total }: { eq: ReportEquipment; index: number; total: number }) {
  const eqChecklist = (eq.inspection_checklist as any[]) || [];
  const eqMeasurements = (eq.measurements as Record<string, string>) || {};
  const finalStatus = eq.final_status || "operational";
  const sc = STATUS_COLORS[finalStatus as keyof typeof STATUS_COLORS] || STATUS_COLORS.operational;

  return (
    <div className="space-y-4">
      {/* Equipment Page Header */}
      <div className={cn("flex items-center justify-between p-4 rounded-xl border-2", sc.bg)}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary text-primary-foreground font-bold text-base">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              EQUIPAMENTO {String(index + 1).padStart(2, "0")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {eq.equipment_type || "Não especificado"} • {index + 1} de {total}
            </p>
          </div>
        </div>
        <Badge className={cn("text-xs font-bold border px-3 py-1", sc.badge)}>
          {FINAL_STATUS_OPTIONS[finalStatus] || finalStatus}
        </Badge>
      </div>

      {/* BLOCO 1: Identificação */}
      <Card>
        <CardContent className="p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Wrench className="h-3 w-3 text-primary" /> Identificação
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 bg-muted/20 rounded-lg p-3 border border-border/40">
            <InfoRow label="Tipo" value={eq.equipment_type} />
            <InfoRow label="Marca" value={eq.equipment_brand} />
            <InfoRow label="Modelo" value={eq.equipment_model} />
            <InfoRow label="Capacidade" value={eq.capacity_btus ? `${eq.capacity_btus} BTUs` : null} />
            <InfoRow label="Nº Série" value={eq.serial_number} />
            <InfoRow label="Localização" value={eq.equipment_location} />
          </div>
        </CardContent>
      </Card>

      {/* BLOCO 2: Checklist Técnico */}
      {eqChecklist.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <ClipboardCheck className="h-3 w-3 text-primary" /> Checklist Técnico
            </p>
            <div className="rounded-lg border border-border/50 overflow-hidden">
              <div className="grid grid-cols-[1fr_auto] bg-muted/40 px-3 py-2 border-b border-border/50">
                <span className="text-[10px] font-bold uppercase text-muted-foreground">Item</span>
                <span className="text-[10px] font-bold uppercase text-muted-foreground text-right">Status</span>
              </div>
              {eqChecklist.map((item: any) => {
                const label = CHECKLIST_ITEMS.find((c) => c.key === item.key)?.label || item.key;
                const statusIcon = item.status === "ok"
                  ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  : item.status === "attention"
                  ? <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  : <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />;
                const statusBadge = item.status === "ok"
                  ? "text-green-700 bg-green-50 border-green-200"
                  : item.status === "attention"
                  ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-red-700 bg-red-50 border-red-200";
                return (
                  <div key={item.key} className="grid grid-cols-[1fr_auto] items-center px-3 py-2 border-b border-border/30 last:border-0">
                    <div className="flex items-center gap-2">
                      {statusIcon}
                      <span className="text-sm text-foreground">{label}</span>
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 h-5 border font-semibold", statusBadge)}>
                      {item.status === "ok" ? "OK" : item.status === "attention" ? "Atenção" : "Crítico"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 3: Diagnóstico Técnico */}
      {(eq.condition_found || eq.technical_observations) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Stethoscope className="h-3 w-3 text-primary" /> Diagnóstico Técnico
            </p>
            <div className="space-y-3">
              {eq.condition_found && (
                <div className="bg-muted/15 rounded-lg p-3 border border-border/30">
                  <p className="text-xs font-semibold text-primary mb-1">Condição Encontrada</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{eq.condition_found}</p>
                </div>
              )}
              {eq.technical_observations && (
                <div className="bg-muted/15 rounded-lg p-3 border border-border/30">
                  <p className="text-xs font-semibold text-primary mb-1">Observações Técnicas</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{eq.technical_observations}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 4: Procedimentos Realizados */}
      {(eq.procedure_performed || eq.services_performed) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Wrench className="h-3 w-3 text-primary" /> Procedimentos Realizados
            </p>
            {eq.procedure_performed && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">{eq.procedure_performed}</p>
            )}
            {eq.services_performed && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground mt-2">{eq.services_performed}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Measurements */}
      {Object.values(eqMeasurements).some(Boolean) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Gauge className="h-3 w-3 text-primary" /> Medições
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {eqMeasurements.pressure && (
                <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/40">
                  <p className="text-lg font-bold text-foreground">{eqMeasurements.pressure}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">PSI</p>
                </div>
              )}
              {eqMeasurements.temperature && (
                <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/40">
                  <p className="text-lg font-bold text-foreground">{eqMeasurements.temperature}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">°C</p>
                </div>
              )}
              {eqMeasurements.voltage_measured && (
                <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/40">
                  <p className="text-lg font-bold text-foreground">{eqMeasurements.voltage_measured}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Volts</p>
                </div>
              )}
              {eqMeasurements.current_measured && (
                <div className="text-center p-3 rounded-lg bg-muted/30 border border-border/40">
                  <p className="text-lg font-bold text-foreground">{eqMeasurements.current_measured}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Amperes</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 5: Resultado Final */}
      <Card className={cn("border-2", sc.bg)}>
        <CardContent className="p-4">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="h-3 w-3 text-primary" /> Resultado Final — Equipamento {String(index + 1).padStart(2, "0")}
          </p>
          <div className="flex items-center gap-3">
            <StatusIcon status={finalStatus} />
            <div>
              <p className={cn("text-sm font-bold", sc.title)}>
                {FINAL_STATUS_OPTIONS[finalStatus] || finalStatus}
              </p>
              {eq.impact_level && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Nível de impacto: {IMPACT_LEVELS[eq.impact_level]?.label || eq.impact_level}
                  {" — "}{IMPACT_LEVELS[eq.impact_level]?.description}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── SECTION 3: PÁGINA FINAL — CONSOLIDAÇÃO ─── */

function ConsolidationPage({
  report, reportEquipment, signature, organization, tz, photos,
}: {
  report: any; reportEquipment: ReportEquipment[]; signature: any; organization: any; tz: string; photos: any[];
}) {
  const overallStatus = getOverallStatus(reportEquipment, report);
  const sc = STATUS_COLORS[overallStatus as keyof typeof STATUS_COLORS];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center py-4">
        <h2 className="text-base font-bold text-foreground uppercase tracking-wider">Consolidação e Parecer Final</h2>
        <p className="text-xs text-muted-foreground">
          Laudo Nº {report.report_number.toString().padStart(4, "0")} — {formatDateInTz(report.report_date, tz)}
        </p>
      </div>

      {/* Status Geral */}
      <Card className={cn("border-2", sc.bg)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <StatusIcon status={overallStatus} />
            <div className="flex-1">
              <p className={cn("text-sm font-bold", sc.title)}>
                Status Geral do Sistema: {STATUS_LABELS[overallStatus]}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {reportEquipment.length || 1} equipamento(s) atendido(s)
              </p>
            </div>
          </div>
          {report.conclusion && (
            <p className="text-sm whitespace-pre-wrap mt-3 pt-3 border-t border-border/50 text-foreground">{report.conclusion}</p>
          )}
        </CardContent>
      </Card>

      {/* Parecer / Serviços Gerais */}
      {report.interventions_performed && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Wrench className="h-3 w-3 text-primary" /> Serviços Gerais Realizados
            </p>
            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">{report.interventions_performed}</p>
          </CardContent>
        </Card>
      )}

      {report.recommendation && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-primary" /> Parecer e Recomendações
            </p>
            <p className="text-sm whitespace-pre-wrap text-foreground">{report.recommendation}</p>
          </CardContent>
        </Card>
      )}

      {report.risks && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-3 w-3 text-primary" /> Análise de Risco
            </p>
            <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/10">
              <p className="text-sm text-destructive-foreground whitespace-pre-wrap italic">{report.risks}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {report.observations && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3 w-3 text-primary" /> Observações Finais
            </p>
            <p className="text-sm whitespace-pre-wrap text-foreground">{report.observations}</p>
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Camera className="h-3 w-3 text-primary" /> Evidências Fotográficas
            </p>
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
          </CardContent>
        </Card>
      )}

      {/* Assinaturas */}
      <Card className="border-2 border-dashed border-border">
        <CardContent className="p-6">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-5 text-center">Validação e Assinaturas</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Técnico */}
            <div className="text-center">
              {organization?.signature_url ? (
                <div className="bg-white p-2 rounded border shadow-sm inline-block mb-2">
                  <img src={organization.signature_url} alt="Assinatura Técnico" className="h-14 object-contain" />
                </div>
              ) : (
                <div className="h-14 border-b-2 border-foreground/20 mb-2" />
              )}
              <p className="text-sm font-bold text-foreground">
                {report.technician_profile?.full_name || report.responsible_technician_name || "Responsável Técnico"}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Responsável Técnico</p>
            </div>
            {/* Cliente */}
            <div className="text-center">
              {signature?.signature_url ? (
                <div className="bg-white p-2 rounded border shadow-sm inline-block mb-2">
                  <img src={signature.signature_url} alt="Assinatura Cliente" className="h-14 object-contain" />
                </div>
              ) : (
                <div className="h-14 border-b-2 border-foreground/20 mb-2" />
              )}
              <p className="text-sm font-bold text-foreground">
                {signature?.signer_name || report.client?.name || "Cliente"}
              </p>
              <p className="text-[10px] text-muted-foreground uppercase">Contratante</p>
              {signature?.signed_at && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Assinado em {formatDateInTz(signature.signed_at, tz)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── MAIN PAGE ─── */

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

  if (isLoading || eqLoading) {
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

        {/* ═══════ PÁGINA 1: CAPA EXECUTIVA ═══════ */}
        <CoverPage report={report} organization={organization} tz={tz} reportEquipment={reportEquipment} />

        {/* ═══════ PÁGINAS POR EQUIPAMENTO ═══════ */}
        {reportEquipment.length > 0 && reportEquipment.map((eq, idx) => (
          <div key={eq.id}>
            <PageDivider />
            <EquipmentPage eq={eq} index={idx} total={reportEquipment.length} />
          </div>
        ))}

        {/* Fallback legacy (sem report_equipment) */}
        {reportEquipment.length === 0 && (report.equipment_type || report.diagnosis) && (
          <>
            <PageDivider />
            <Card>
              <CardContent className="p-4 space-y-3">
                {(report.equipment_type || report.equipment_brand) && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Identificação do Ativo</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4">
                      <InfoRow label="Tipo" value={report.equipment_type} />
                      <InfoRow label="Marca" value={report.equipment_brand} />
                      <InfoRow label="Modelo" value={report.equipment_model} />
                      <InfoRow label="Capacidade" value={report.capacity_btus ? `${report.capacity_btus} BTUs` : null} />
                      <InfoRow label="Nº Série" value={report.serial_number} />
                      <InfoRow label="Local" value={report.equipment_location} />
                    </div>
                  </div>
                )}
                {report.diagnosis && (
                  <div>
                    <p className="text-xs font-bold text-muted-foreground uppercase mb-2">Diagnóstico</p>
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{report.diagnosis}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══════ PÁGINA FINAL: CONSOLIDAÇÃO ═══════ */}
        <PageDivider />
        <ConsolidationPage
          report={report}
          reportEquipment={reportEquipment}
          signature={signature}
          organization={organization}
          tz={tz}
          photos={photos}
        />
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
