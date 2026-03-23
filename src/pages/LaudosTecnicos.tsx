import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
import { Plus, FileText, Search, Loader2, Trash2, Edit, Eye, Download, Link2 } from "lucide-react";
import { useTechnicalReports, REPORT_STATUS_LABELS, EQUIPMENT_CONDITIONS } from "@/hooks/useTechnicalReports";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatDateInTz } from "@/lib/timezone";
import { generateReportPDF } from "@/lib/generateReportPDF";
import { toast } from "@/hooks/use-toast";
import { useDocumentGuard } from "@/hooks/useDocumentGuard";
import { CompanyDataCompletionModal } from "@/components/onboarding/CompanyDataCompletionModal";

export default function LaudosTecnicos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { reports, isLoading, remove } = useTechnicalReports();
  const { organization } = useOrganization();
  const tz = useOrgTimezone();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { guardAction, modalOpen: companyModalOpen, closeModal: closeCompanyModal, onDataSaved: onCompanyDataSaved } = useDocumentGuard();
  const osFilter = searchParams.get("os") || "";

  const filtered = reports.filter((r) => {
    const term = search.toLowerCase();
    const matchesSearch =
      r.client?.name?.toLowerCase().includes(term) ||
      r.report_number.toString().includes(term) ||
      r.equipment_type?.toLowerCase().includes(term);
    const matchesOS = !osFilter || r.service_id === osFilter;
    return matchesSearch && matchesOS;
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  const handlePDF = async (report: typeof reports[0]) => {
    try {
      await generateReportPDF({
        report,
        organizationName: organization?.name || "Minha Empresa",
        organizationCnpj: organization?.cnpj_cpf || undefined,
        organizationPhone: organization?.phone || undefined,
        organizationEmail: organization?.email || undefined,
        organizationAddress: organization?.address || undefined,
        organizationLogo: organization?.logo_url || undefined,
        organizationCity: organization?.city || undefined,
        organizationState: organization?.state || undefined,
        timezone: tz,
      });
      toast({ title: "PDF gerado!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao gerar PDF", description: (err as Error).message });
    }
  };

  const getStatusBadge = (status: string) => {
    if (status === "finalized") return "bg-green-500/10 text-green-600 border-green-200";
    return "bg-amber-500/10 text-amber-600 border-amber-200";
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

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Laudos Técnicos</h1>
          <p className="text-muted-foreground">{filtered.length} laudo{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={() => navigate("/laudos/novo")} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Laudo
        </Button>
      </div>

      <div className="mb-4 flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, número ou equipamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        {osFilter && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => {
              searchParams.delete("os");
              setSearchParams(searchParams);
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
            Filtro OS ativo
            <span className="text-destructive ml-1">✕</span>
          </Button>
        )}
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">Nenhum laudo técnico encontrado</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/laudos/novo")}>
              Criar primeiro laudo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => (
            <Card
              key={report.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/laudos/${report.id}`)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-foreground">
                        Laudo #{report.report_number.toString().padStart(4, "0")}
                      </span>
                      <Badge className={getStatusBadge(report.status)}>
                        {REPORT_STATUS_LABELS[report.status] || report.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{report.client?.name || "—"}</p>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                      <span>{formatDateInTz(report.report_date, tz)}</span>
                      {report.equipment_type && <span>• {report.equipment_type}</span>}
                      {report.equipment_condition && (
                        <span>• {EQUIPMENT_CONDITIONS[report.equipment_condition] || report.equipment_condition}</span>
                      )}
                    </div>
                    {/* Links */}
                    {(report.service || report.quote_service) && (
                      <div className="flex flex-wrap gap-2 mt-2">
                        {report.service && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <Link2 className="h-3 w-3" />
                            OS #{report.service.quote_number?.toString().padStart(4, "0")}
                          </span>
                        )}
                        {report.quote_service && (
                          <span className="inline-flex items-center gap-1 text-xs text-primary">
                            <Link2 className="h-3 w-3" />
                            Orçamento #{report.quote_service.quote_number?.toString().padStart(4, "0")}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/laudos/${report.id}`)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/laudos/editar/${report.id}`)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => guardAction(() => handlePDF(report))}>
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(report.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir laudo técnico?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
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
