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
} from "lucide-react";
import { useTechnicalReport, useTechnicalReportMutations, REPORT_STATUS_LABELS, EQUIPMENT_CONDITIONS, CLEANLINESS_STATUS, INSPECTION_ITEMS } from "@/hooks/useTechnicalReports";
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
      <div className="max-w-3xl mx-auto px-4 py-4 md:py-6 space-y-4">
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
          <Card>
            <CardContent className="p-3 flex flex-wrap gap-3">
              {report.service && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/ordens-servico/${report.service_id}`)}>
                  <Link2 className="h-3 w-3" />
                  Vinculado à OS #{report.service.quote_number?.toString().padStart(4, "0")}
                </Button>
              )}
              {report.quote_service && (
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => navigate(`/orcamentos/editar/${report.quote_service_id}`)}>
                  <Link2 className="h-3 w-3" />
                  Vinculado ao Orçamento #{report.quote_service.quote_number?.toString().padStart(4, "0")}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Client */}
        <SectionCard icon={User} title="Cliente">
          <p className="text-base font-semibold">{report.client?.name || "—"}</p>
          <InfoRow label="Telefone" value={report.client?.phone} />
          <InfoRow label="E-mail" value={report.client?.email} />
          <InfoRow label="Endereço" value={report.client?.address} />
          <InfoRow label="Cidade" value={[report.client?.city, report.client?.state].filter(Boolean).join(" - ")} />
        </SectionCard>

        {/* Info */}
        <SectionCard icon={FileText} title="Informações do Laudo">
          <InfoRow label="Data" value={formatDateInTz(report.report_date, tz)} />
          <InfoRow label="Técnico" value={report.technician_profile?.full_name || report.responsible_technician_name} />
        </SectionCard>

        {/* Equipment */}
        {(report.equipment_type || report.equipment_brand) && (
          <SectionCard icon={Wrench} title="Equipamento">
            <InfoRow label="Tipo" value={report.equipment_type} />
            <InfoRow label="Marca" value={report.equipment_brand} />
            <InfoRow label="Modelo" value={report.equipment_model} />
            <InfoRow label="Capacidade" value={report.capacity_btus ? `${report.capacity_btus} BTUs` : null} />
            <InfoRow label="Nº Série" value={report.serial_number} />
            <InfoRow label="Quantidade" value={report.equipment_quantity > 1 ? String(report.equipment_quantity) : null} />
            <InfoRow label="Localização" value={report.equipment_location} />
          </SectionCard>
        )}

        {/* Visit Reason */}
        {report.visit_reason && (
          <SectionCard icon={Stethoscope} title="Motivo da Visita">
            <p className="text-sm text-foreground whitespace-pre-wrap">{report.visit_reason}</p>
          </SectionCard>
        )}

        {/* Checklist */}
        {checklist.length > 0 && (
          <SectionCard icon={ClipboardCheck} title="Inspeção Realizada">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
              {INSPECTION_ITEMS.map((item) => {
                const checked = checklist.includes(item.key);
                if (!checked) return null;
                return (
                  <div key={item.key} className="flex items-center gap-2 text-sm py-0.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
                    <span>{item.label}</span>
                  </div>
                );
              })}
            </div>
          </SectionCard>
        )}

        {/* Diagnosis */}
        {report.diagnosis && (
          <SectionCard icon={Stethoscope} title="Diagnóstico Técnico">
            <p className="text-sm whitespace-pre-wrap">{report.diagnosis}</p>
          </SectionCard>
        )}

        {/* Measurements */}
        {Object.keys(measurements).filter((k) => measurements[k]).length > 0 && (
          <SectionCard icon={Gauge} title="Medições / Evidências">
            <InfoRow label="Pressão" value={measurements.pressure} />
            <InfoRow label="Temperatura" value={measurements.temperature} />
            <InfoRow label="Tensão" value={measurements.voltage_measured} />
            <InfoRow label="Corrente" value={measurements.current_measured} />
            {measurements.notes && (
              <div className="mt-2">
                <span className="text-xs font-medium text-muted-foreground">Observações:</span>
                <p className="text-sm mt-1 whitespace-pre-wrap">{measurements.notes}</p>
              </div>
            )}
          </SectionCard>
        )}

        {/* Condition */}
        {(conditionLabel || report.cleanliness_status || report.equipment_working) && (
          <SectionCard icon={ShieldAlert} title="Status Estrutural e Limpeza">
            <InfoRow label="Estado Estrutural" value={conditionLabel} />
            <InfoRow label="Condição de Limpeza" value={report.cleanliness_status ? CLEANLINESS_STATUS[report.cleanliness_status] || report.cleanliness_status : null} />
            <InfoRow label="Funcionando" value={workingLabel} />
            {report.needs_quote && (
              <div className="flex items-center gap-1.5 text-sm text-amber-600 mt-1">
                <XCircle className="h-3.5 w-3.5" /> Necessita orçamento
              </div>
            )}
          </SectionCard>
        )}

        {/* Interventions */}
        {report.interventions_performed && (
          <SectionCard icon={Wrench} title="Intervenções Realizadas">
            <p className="text-sm whitespace-pre-wrap">{report.interventions_performed}</p>
          </SectionCard>
        )}

        {/* Recommendation */}
        {report.recommendation && (
          <SectionCard icon={MessageSquare} title="Recomendação Técnica">
            <p className="text-sm whitespace-pre-wrap">{report.recommendation}</p>
          </SectionCard>
        )}

        {/* Risks */}
        {report.risks && (
          <SectionCard icon={ShieldAlert} title="Riscos / Consequências">
            <p className="text-sm whitespace-pre-wrap">{report.risks}</p>
          </SectionCard>
        )}

        {/* Conclusion */}
        {report.conclusion && (
          <SectionCard icon={ClipboardCheck} title="CONCLUSÃO E STATUS PÓS-INTERVENÇÃO">
            <p className="text-sm whitespace-pre-wrap">{report.conclusion}</p>
          </SectionCard>
        )}

        {/* Observations */}
        {report.observations && (
          <SectionCard icon={MessageSquare} title="Observações Finais">
            <p className="text-sm whitespace-pre-wrap">{report.observations}</p>
          </SectionCard>
        )}

        {/* Photos */}
        {photos.length > 0 && (
          <SectionCard icon={Camera} title="Evidências Fotográficas">
            {(["before", "problem", "after"] as PhotoCategory[]).map((cat) => {
              const catPhotos = photos.filter((p) => p.category === cat);
              if (catPhotos.length === 0) return null;
              return (
                <div key={cat} className="mb-3 last:mb-0">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">
                    {PHOTO_CATEGORY_LABELS[cat]} ({catPhotos.length})
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {catPhotos.map((photo) => (
                      <div key={photo.id} className="rounded-lg overflow-hidden border border-border aspect-square">
                        <img
                          src={photo.photo_url}
                          alt={photo.caption || PHOTO_CATEGORY_LABELS[cat]}
                          className="w-full h-full object-cover"
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
