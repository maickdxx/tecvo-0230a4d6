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
  AlertTriangle, Building2, MapPin, Calendar, Activity,
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

/* ════════════════════════════════════════════════════════════
   DESIGN ATOMS
   ════════════════════════════════════════════════════════════ */

function SectionTitle({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-primary/10 shrink-0">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">{children}</h3>
    </div>
  );
}

function DataField({ label, value, large }: { label: string; value?: string | null; large?: boolean }) {
  if (!value) return null;
  return (
    <div className="py-2">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
      <p className={cn("text-foreground break-words", large ? "text-base font-bold" : "text-sm")}>{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline gap-4 py-2 border-b border-border/30 last:border-0">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm font-medium text-foreground text-right">{value}</span>
    </div>
  );
}

function TextBlock({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl bg-muted/20 border border-border/40 p-4">
      <p className="text-[11px] font-bold text-primary uppercase tracking-wide mb-2">{label}</p>
      <p className="text-[13px] leading-[1.75] whitespace-pre-wrap break-words text-foreground">{text}</p>
    </div>
  );
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

const STATUS_META = {
  operational: {
    bg: "bg-green-50/80 border-green-200",
    badge: "bg-green-100 text-green-800 border-green-300",
    icon: CheckCircle2,
    iconColor: "text-green-600",
    title: "text-green-900",
    label: "Operacional",
  },
  operational_with_caveats: {
    bg: "bg-amber-50/80 border-amber-200",
    badge: "bg-amber-100 text-amber-800 border-amber-300",
    icon: AlertTriangle,
    iconColor: "text-amber-600",
    title: "text-amber-900",
    label: "Operacional com Ressalvas",
  },
  non_operational: {
    bg: "bg-red-50/80 border-red-200",
    badge: "bg-red-100 text-red-800 border-red-300",
    icon: XCircle,
    iconColor: "text-red-600",
    title: "text-red-900",
    label: "Não Operacional",
  },
};

function StatusBadge({ status, size = "sm" }: { status: string; size?: "sm" | "lg" }) {
  const meta = STATUS_META[status as keyof typeof STATUS_META] || STATUS_META.operational;
  const Icon = meta.icon;
  return (
    <Badge className={cn(
      "border font-bold gap-1.5 shrink-0",
      meta.badge,
      size === "lg" ? "text-xs px-3 py-1.5" : "text-[10px] px-2 py-1",
    )}>
      <Icon className={cn(size === "lg" ? "h-4 w-4" : "h-3 w-3", meta.iconColor)} />
      {FINAL_STATUS_OPTIONS[status] || meta.label}
    </Badge>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION 1 — CAPA EXECUTIVA
   ════════════════════════════════════════════════════════════ */

function CoverPage({
  report, organization, tz, reportEquipment,
}: {
  report: any; organization: any; tz: string; reportEquipment: ReportEquipment[];
}) {
  const overallStatus = getOverallStatus(reportEquipment, report);
  const meta = STATUS_META[overallStatus as keyof typeof STATUS_META];

  return (
    <section className="space-y-6 print:break-after-page">
      {/* Hero Title */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/5 via-primary/8 to-primary/3 py-10 px-6 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--primary)/0.06),transparent_70%)]" />
        <div className="relative">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 mb-4">
            <FileText className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight">LAUDO TÉCNICO</h2>
          <p className="text-base font-semibold text-primary mt-1">
            Nº {report.report_number.toString().padStart(4, "0")}
          </p>
          <div className="flex items-center justify-center gap-5 mt-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDateInTz(report.report_date, tz)}
            </span>
            {(organization?.city || organization?.state) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {[organization?.city, organization?.state].filter(Boolean).join(" / ")}
              </span>
            )}
          </div>
          {report.service && (
            <p className="text-xs text-muted-foreground mt-2">
              Referência: OS #{report.service.quote_number?.toString().padStart(4, "0")}
            </p>
          )}
        </div>
      </div>

      {/* Company + Client side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={Building2}>Empresa Responsável</SectionTitle>
            <DataField label="Razão Social" value={organization?.name} large />
            <div className="grid grid-cols-1 gap-0 mt-1">
              <InfoRow label="CNPJ" value={organization?.cnpj_cpf} />
              <InfoRow label="Telefone" value={organization?.phone} />
              <InfoRow label="E-mail" value={organization?.email} />
              <InfoRow label="Endereço" value={[organization?.address, organization?.city, organization?.state].filter(Boolean).join(", ")} />
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={User}>Contratante</SectionTitle>
            <DataField label="Nome / Razão Social" value={report.client?.name} large />
            <div className="grid grid-cols-1 gap-0 mt-1">
              <InfoRow label="Telefone" value={report.client?.phone} />
              <InfoRow label="E-mail" value={report.client?.email} />
              <InfoRow label="Local da Prestação" value={[report.client?.address, report.client?.city, report.client?.state].filter(Boolean).join(", ")} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Technical Data */}
      <Card className="shadow-sm">
        <CardContent className="p-5">
          <SectionTitle icon={Wrench}>Dados Técnicos</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">
            <InfoRow label="Técnico Responsável" value={report.technician_profile?.full_name || report.responsible_technician_name} />
            <InfoRow label="Data da Visita" value={formatDateInTz(report.report_date, tz)} />
          </div>
          {report.visit_reason && (
            <div className="mt-4 pt-4 border-t border-border/40">
              <TextBlock label="Motivo da Visita" text={report.visit_reason} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Dashboard */}
      <Card className={cn("shadow-sm border-2", meta.bg)}>
        <CardContent className="p-5">
          <SectionTitle icon={Activity}>Resumo Geral do Atendimento</SectionTitle>
          <div className="grid grid-cols-3 gap-6 text-center py-2">
            <div className="space-y-1">
              <p className="text-3xl font-extrabold text-foreground">{reportEquipment.length || 1}</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Equipamentos</p>
            </div>
            <div className="space-y-1 flex flex-col items-center justify-center">
              <p className="text-sm font-bold text-foreground capitalize">{report.service?.service_type || "Inspeção"}</p>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Tipo de Serviço</p>
            </div>
            <div className="space-y-1 flex flex-col items-center justify-center">
              <StatusBadge status={overallStatus} size="lg" />
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mt-1">Status Geral</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION 2 — PÁGINA POR EQUIPAMENTO
   ════════════════════════════════════════════════════════════ */

function EquipmentPage({ eq, index, total }: { eq: ReportEquipment; index: number; total: number }) {
  const eqChecklist = (eq.inspection_checklist as any[]) || [];
  const eqMeasurements = (eq.measurements as Record<string, string>) || {};
  const finalStatus = eq.final_status || "operational";
  const meta = STATUS_META[finalStatus as keyof typeof STATUS_META] || STATUS_META.operational;

  const hasIdentification = eq.equipment_type || eq.equipment_brand || eq.equipment_model || eq.capacity_btus || eq.serial_number || eq.equipment_location;
  const hasDiagnosis = eq.condition_found || eq.technical_observations;
  const hasProcedures = eq.procedure_performed || eq.services_performed;
  const hasMeasurements = Object.values(eqMeasurements).some(Boolean);

  return (
    <section className="space-y-5 print:break-after-page">
      {/* Equipment Header */}
      <div className={cn("rounded-2xl border-2 p-5", meta.bg)}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-primary text-primary-foreground font-extrabold text-lg shadow-sm">
              {String(index + 1).padStart(2, "0")}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-foreground tracking-tight">
                EQUIPAMENTO {String(index + 1).padStart(2, "0")}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {eq.equipment_type || "Tipo não especificado"}
                <span className="mx-1.5 text-border">•</span>
                {index + 1} de {total}
              </p>
            </div>
          </div>
          <StatusBadge status={finalStatus} size="lg" />
        </div>
      </div>

      {/* BLOCO 1: Identificação */}
      {hasIdentification && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={Wrench}>Identificação Técnica</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-0">
              <InfoRow label="Tipo" value={eq.equipment_type} />
              <InfoRow label="Marca" value={eq.equipment_brand} />
              <InfoRow label="Modelo" value={eq.equipment_model} />
              <InfoRow label="Capacidade" value={eq.capacity_btus ? `${eq.capacity_btus} BTUs` : null} />
              <InfoRow label="Nº de Série" value={eq.serial_number} />
              <InfoRow label="Localização" value={eq.equipment_location} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 2: Checklist Técnico */}
      {eqChecklist.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={ClipboardCheck}>Checklist de Inspeção</SectionTitle>
            <div className="rounded-xl border border-border overflow-hidden">
              {/* Table Header */}
              <div className="grid grid-cols-[1fr_120px] bg-muted/50 px-4 py-2.5 border-b border-border">
                <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide">Componente</span>
                <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wide text-center">Status</span>
              </div>
              {/* Table Rows */}
              {eqChecklist.map((item: any, i: number) => {
                const label = CHECKLIST_ITEMS.find((c) => c.key === item.key)?.label || item.key;
                const isOk = item.status === "ok";
                const isAttention = item.status === "attention";
                const Icon = isOk ? CheckCircle2 : isAttention ? AlertTriangle : XCircle;
                const iconColor = isOk ? "text-green-600" : isAttention ? "text-amber-500" : "text-red-500";
                const badgeClass = isOk
                  ? "bg-green-100 text-green-800 border-green-300"
                  : isAttention
                  ? "bg-amber-100 text-amber-800 border-amber-300"
                  : "bg-red-100 text-red-800 border-red-300";
                const statusLabel = isOk ? "OK" : isAttention ? "Atenção" : "Crítico";

                return (
                  <div
                    key={item.key}
                    className={cn(
                      "grid grid-cols-[1fr_120px] items-center px-4 py-3 border-b border-border/40 last:border-0",
                      i % 2 === 0 ? "bg-background" : "bg-muted/15",
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn("h-4 w-4 shrink-0", iconColor)} />
                      <span className="text-[13px] font-medium text-foreground">{label}</span>
                    </div>
                    <div className="flex justify-center">
                      <Badge variant="outline" className={cn("text-[11px] px-2.5 py-0.5 border font-bold", badgeClass)}>
                        {statusLabel}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 3: Diagnóstico Técnico */}
      {hasDiagnosis && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={Stethoscope}>Diagnóstico Técnico</SectionTitle>
            <div className="space-y-4">
              {eq.condition_found && <TextBlock label="Condição Encontrada" text={eq.condition_found} />}
              {eq.technical_observations && <TextBlock label="Observações Técnicas" text={eq.technical_observations} />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 4: Procedimentos Realizados */}
      {hasProcedures && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={Wrench}>Procedimentos Realizados</SectionTitle>
            <div className="space-y-4">
              {eq.procedure_performed && <TextBlock label="Procedimento" text={eq.procedure_performed} />}
              {eq.services_performed && <TextBlock label="Serviços Executados" text={eq.services_performed} />}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Medições */}
      {hasMeasurements && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={Gauge}>Medições</SectionTitle>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { key: "pressure", label: "Pressão", unit: "PSI" },
                { key: "temperature", label: "Temperatura", unit: "°C" },
                { key: "voltage_measured", label: "Tensão", unit: "V" },
                { key: "current_measured", label: "Corrente", unit: "A" },
              ].filter(m => eqMeasurements[m.key]).map(m => (
                <div key={m.key} className="text-center rounded-xl bg-muted/25 border border-border/40 p-4">
                  <p className="text-2xl font-extrabold text-foreground">{eqMeasurements[m.key]}</p>
                  <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mt-1">{m.unit}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* BLOCO 5: Resultado Final */}
      <Card className={cn("shadow-sm border-2", meta.bg)}>
        <CardContent className="p-5">
          <SectionTitle icon={CheckCircle2}>Resultado Final — Equipamento {String(index + 1).padStart(2, "0")}</SectionTitle>
          <div className="flex items-start gap-4 py-2">
            {(() => { const Icon = meta.icon; return <Icon className={cn("h-7 w-7 shrink-0 mt-0.5", meta.iconColor)} />; })()}
            <div className="space-y-1">
              <p className={cn("text-base font-extrabold", meta.title)}>
                {FINAL_STATUS_OPTIONS[finalStatus] || finalStatus}
              </p>
              {eq.impact_level && (
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold">Nível de impacto:</span>{" "}
                  {IMPACT_LEVELS[eq.impact_level]?.label || eq.impact_level}
                  {" — "}{IMPACT_LEVELS[eq.impact_level]?.description}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   SECTION 3 — CONSOLIDAÇÃO E ASSINATURAS
   ════════════════════════════════════════════════════════════ */

function ConsolidationPage({
  report, reportEquipment, signature, organization, tz, photos,
}: {
  report: any; reportEquipment: ReportEquipment[]; signature: any; organization: any; tz: string; photos: any[];
}) {
  const overallStatus = getOverallStatus(reportEquipment, report);
  const meta = STATUS_META[overallStatus as keyof typeof STATUS_META];

  return (
    <section className="space-y-6 print:break-after-page">
      {/* Section Title */}
      <div className="text-center py-5 border-b-2 border-primary/20">
        <h2 className="text-lg font-extrabold text-foreground uppercase tracking-wider">Consolidação e Parecer Final</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Laudo Nº {report.report_number.toString().padStart(4, "0")} — {formatDateInTz(report.report_date, tz)}
        </p>
      </div>

      {/* Overall Status */}
      <Card className={cn("shadow-sm border-2", meta.bg)}>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            {(() => { const Icon = meta.icon; return <Icon className={cn("h-8 w-8 shrink-0", meta.iconColor)} />; })()}
            <div className="flex-1">
              <p className={cn("text-base font-extrabold", meta.title)}>
                Status Geral do Sistema: {meta.label}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {reportEquipment.length || 1} equipamento(s) inspecionado(s) e avaliado(s)
              </p>
            </div>
          </div>
          {report.conclusion && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <TextBlock label="Conclusão Técnica" text={report.conclusion} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Serviços Gerais */}
      {report.interventions_performed && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={Wrench}>Serviços Gerais Realizados</SectionTitle>
            <TextBlock label="Descrição" text={report.interventions_performed} />
          </CardContent>
        </Card>
      )}

      {/* Parecer e Recomendações */}
      {report.recommendation && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={MessageSquare}>Parecer e Recomendações</SectionTitle>
            <TextBlock label="Recomendação" text={report.recommendation} />
          </CardContent>
        </Card>
      )}

      {/* Riscos */}
      {report.risks && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={ShieldAlert}>Análise de Risco</SectionTitle>
            <div className="rounded-xl bg-destructive/5 border border-destructive/15 p-4">
              <p className="text-[13px] leading-[1.75] text-destructive-foreground whitespace-pre-wrap break-words italic">
                {report.risks}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Observações */}
      {report.observations && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={MessageSquare}>Observações Finais</SectionTitle>
            <TextBlock label="Observações" text={report.observations} />
          </CardContent>
        </Card>
      )}

      {/* Photos */}
      {photos.length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <SectionTitle icon={Camera}>Evidências Fotográficas</SectionTitle>
            {(["before", "problem", "after"] as PhotoCategory[]).map((cat) => {
              const catPhotos = photos.filter((p) => p.category === cat);
              if (catPhotos.length === 0) return null;
              return (
                <div key={cat} className="mb-5 last:mb-0">
                  <p className="text-[11px] font-bold text-primary uppercase tracking-wider mb-3 pl-3 border-l-[3px] border-primary">
                    {PHOTO_CATEGORY_LABELS[cat]}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {catPhotos.map((photo) => (
                      <div key={photo.id} className="group relative rounded-xl overflow-hidden border border-border aspect-square bg-muted shadow-sm">
                        <img
                          src={photo.photo_url}
                          alt={photo.caption || PHOTO_CATEGORY_LABELS[cat]}
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
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
      <Card className="shadow-sm border-2 border-dashed border-border/60">
        <CardContent className="p-8">
          <p className="text-[13px] font-bold text-foreground uppercase tracking-wider mb-8 text-center">
            Validação e Assinaturas
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            {/* Técnico */}
            <div className="text-center">
              {organization?.signature_url ? (
                <div className="bg-background p-3 rounded-xl border shadow-sm inline-block mb-3">
                  <img src={organization.signature_url} alt="Assinatura Técnico" className="h-16 object-contain" />
                </div>
              ) : (
                <div className="h-16 border-b-2 border-foreground/20 mb-3 mx-8" />
              )}
              <p className="text-sm font-bold text-foreground">
                {report.technician_profile?.full_name || report.responsible_technician_name || "Responsável Técnico"}
              </p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">Responsável Técnico</p>
            </div>
            {/* Cliente */}
            <div className="text-center">
              {signature?.signature_url ? (
                <div className="bg-background p-3 rounded-xl border shadow-sm inline-block mb-3">
                  <img src={signature.signature_url} alt="Assinatura Cliente" className="h-16 object-contain" />
                </div>
              ) : (
                <div className="h-16 border-b-2 border-foreground/20 mb-3 mx-8" />
              )}
              <p className="text-sm font-bold text-foreground">
                {signature?.signer_name || report.client?.name || "Contratante"}
              </p>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide mt-0.5">Contratante</p>
              {signature?.signed_at && (
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Assinado em {formatDateInTz(signature.signed_at, tz)}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

/* ════════════════════════════════════════════════════════════
   PAGE DIVIDER
   ════════════════════════════════════════════════════════════ */

function PageDivider() {
  return (
    <div className="relative my-10 print:hidden">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t-2 border-dashed border-primary/15" />
      </div>
      <div className="relative flex justify-center">
        <div className="bg-background px-4">
          <div className="h-2 w-2 rounded-full bg-primary/20" />
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   MAIN PAGE
   ════════════════════════════════════════════════════════════ */

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
      <div className="max-w-3xl mx-auto px-4 py-6 md:py-8">
        {/* Top Bar */}
        <div className="flex items-center justify-between gap-3 mb-6">
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
          <Card className="bg-muted/30 border-dashed mb-6">
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

        {/* ═══ CAPA EXECUTIVA ═══ */}
        <CoverPage report={report} organization={organization} tz={tz} reportEquipment={reportEquipment} />

        {/* ═══ EQUIPAMENTOS ═══ */}
        {reportEquipment.length > 0 && reportEquipment.map((eq, idx) => (
          <div key={eq.id}>
            <PageDivider />
            <EquipmentPage eq={eq} index={idx} total={reportEquipment.length} />
          </div>
        ))}

        {/* Legacy fallback */}
        {reportEquipment.length === 0 && (report.equipment_type || report.diagnosis) && (
          <>
            <PageDivider />
            <Card className="shadow-sm">
              <CardContent className="p-5 space-y-4">
                {(report.equipment_type || report.equipment_brand) && (
                  <div>
                    <SectionTitle icon={Wrench}>Identificação do Ativo</SectionTitle>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-0">
                      <InfoRow label="Tipo" value={report.equipment_type} />
                      <InfoRow label="Marca" value={report.equipment_brand} />
                      <InfoRow label="Modelo" value={report.equipment_model} />
                      <InfoRow label="Capacidade" value={report.capacity_btus ? `${report.capacity_btus} BTUs` : null} />
                      <InfoRow label="Nº Série" value={report.serial_number} />
                      <InfoRow label="Local" value={report.equipment_location} />
                    </div>
                  </div>
                )}
                {report.diagnosis && <TextBlock label="Diagnóstico" text={report.diagnosis} />}
              </CardContent>
            </Card>
          </>
        )}

        {/* ═══ CONSOLIDAÇÃO ═══ */}
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
