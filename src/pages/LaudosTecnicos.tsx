import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  Plus, 
  FileText, 
  Search, 
  Loader2, 
  Trash2, 
  Edit, 
  Eye, 
  Download, 
  Link2, 
  Share2, 
  Filter, 
  X,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  LayoutDashboard,
  Calendar,
  User,
  Wrench
} from "lucide-react";
import { useTechnicalReports, REPORT_STATUS_LABELS, EQUIPMENT_CONDITIONS, CLEANLINESS_STATUS } from "@/hooks/useTechnicalReports";
import { useOrganization } from "@/hooks/useOrganization";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { formatDateInTz } from "@/lib/timezone";
import { generateReportPDF } from "@/lib/generateReportPDF";
import { toast } from "@/hooks/use-toast";
import { useDocumentGuard } from "@/hooks/useDocumentGuard";
import { CompanyDataCompletionModal } from "@/components/onboarding/CompanyDataCompletionModal";
import { cn } from "@/lib/utils";

export default function LaudosTecnicos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { reports, isLoading, remove } = useTechnicalReports();
  const { organization } = useOrganization();
  const tz = useOrgTimezone();
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { guardAction, modalOpen: companyModalOpen, closeModal: closeCompanyModal, onDataSaved: onCompanyDataSaved } = useDocumentGuard();
  
  // Filters state
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [conditionFilter, setConditionFilter] = useState<string>("all");
  const [technicianFilter, setTechnicianFilter] = useState<string>("all");
  const osFilter = searchParams.get("os") || "";

  const stats = useMemo(() => {
    return {
      total: reports.length,
      attention: reports.filter(r => r.equipment_condition === 'regular' || r.equipment_condition === 'bad' || r.cleanliness_status === 'dirty' || r.cleanliness_status === 'needs_cleaning').length,
      critical: reports.filter(r => r.equipment_condition === 'critical' || r.equipment_condition === 'inoperative').length,
      working: reports.filter(r => r.equipment_condition === 'good' && r.cleanliness_status === 'clean').length,
    };
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      const term = search.toLowerCase();
      const matchesSearch =
        r.client?.name?.toLowerCase().includes(term) ||
        r.report_number.toString().includes(term) ||
        r.equipment_type?.toLowerCase().includes(term);
      
      const matchesOS = !osFilter || r.service_id === osFilter;
      const matchesStatus = statusFilter === "all" || r.status === statusFilter;
      const matchesCondition = conditionFilter === "all" || r.equipment_condition === conditionFilter;
      const matchesTechnician = technicianFilter === "all" || r.technician_id === technicianFilter;

      return matchesSearch && matchesOS && matchesStatus && matchesCondition && matchesTechnician;
    });
  }, [reports, search, osFilter, statusFilter, conditionFilter, technicianFilter]);

  const technicians = useMemo(() => {
    const map = new Map();
    reports.forEach(r => {
      if (r.technician_id && r.technician_profile?.full_name) {
        map.set(r.technician_id, r.technician_profile.full_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [reports]);

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  const handlePDF = async (report: any) => {
    try {
      let signatureData = null;
      if (report.service_id) {
        const { data } = await supabase
          .from("service_signatures")
          .select("*")
          .eq("service_id", report.service_id)
          .maybeSingle();
        signatureData = data;
      }

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
        signature: signatureData,
      });
      toast({ title: "PDF gerado!" });
    } catch (err) {
      toast({ variant: "destructive", title: "Erro ao gerar PDF", description: (err as Error).message });
    }
  };

  const getConditionBadge = (condition: string | null) => {
    switch (condition) {
      case "good":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1.5 font-medium hover:bg-emerald-500/20 transition-colors">
            <CheckCircle2 className="h-3 w-3" /> Funcionando
          </Badge>
        );
      case "regular":
      case "bad":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1.5 font-medium hover:bg-amber-500/20 transition-colors">
            <AlertTriangle className="h-3 w-3" /> Atenção
          </Badge>
        );
      case "critical":
      case "inoperative":
        return (
          <Badge className="bg-rose-500/10 text-rose-600 border-rose-200 gap-1.5 font-medium hover:bg-rose-500/20 transition-colors">
            <AlertCircle className="h-3 w-3" /> Crítico
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="gap-1.5 text-muted-foreground">
            Indeterminado
          </Badge>
        );
    }
  };

  const getCleanlinessBadge = (status: string | null) => {
    switch (status) {
      case "clean":
        return (
          <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200 gap-1.5 font-medium hover:bg-emerald-500/20 transition-colors">
            <CheckCircle2 className="h-3 w-3" /> Limpo
          </Badge>
        );
      case "dirty":
        return (
          <Badge className="bg-rose-500/10 text-rose-600 border-rose-200 gap-1.5 font-medium hover:bg-rose-500/20 transition-colors">
            <AlertCircle className="h-3 w-3" /> Sujo
          </Badge>
        );
      case "needs_cleaning":
        return (
          <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 gap-1.5 font-medium hover:bg-amber-500/20 transition-colors">
            <AlertTriangle className="h-3 w-3" /> Necessita Limpeza
          </Badge>
        );
      default:
        return null;
    }
  };

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setConditionFilter("all");
    setTechnicianFilter("all");
    if (osFilter) {
      searchParams.delete("os");
      setSearchParams(searchParams);
    }
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <FileText className="h-8 w-8 text-primary" />
              Laudos Técnicos
            </h1>
            <p className="text-muted-foreground mt-1 text-base">
              Gerencie e monitore as condições técnicas dos equipamentos de seus clientes.
            </p>
          </div>
          <Button onClick={() => navigate("/laudos/novo")} className="gap-2 h-11 px-6 shadow-sm">
            <Plus className="h-5 w-5" /> Novo Laudo
          </Button>
        </div>

        {/* Dashboard Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-primary/50 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Total de Laudos</p>
                <p className="text-3xl font-bold text-foreground">{stats.total}</p>
              </div>
              <div className="bg-primary/10 p-3 rounded-xl group-hover:scale-110 transition-transform">
                <FileText className="h-6 w-6 text-primary" />
              </div>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-emerald-500/50 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Funcionando</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.working}</p>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-xl group-hover:scale-110 transition-transform">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-amber-500/50 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Atenção</p>
                <p className="text-3xl font-bold text-amber-600">{stats.attention}</p>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-xl group-hover:scale-110 transition-transform">
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-rose-500/50 shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1 uppercase tracking-wider">Críticos</p>
                <p className="text-3xl font-bold text-rose-600">{stats.critical}</p>
              </div>
              <div className="bg-rose-500/10 p-3 rounded-xl group-hover:scale-110 transition-transform">
                <AlertCircle className="h-6 w-6 text-rose-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters & Search */}
        <Card className="shadow-sm border-muted/60">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Pesquisar por cliente, OS ou equipamento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 border-muted"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px] h-11 border-muted">
                    <SelectValue placeholder="Status Laudo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Status</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="finalized">Finalizado</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={conditionFilter} onValueChange={setConditionFilter}>
                  <SelectTrigger className="w-[160px] h-11 border-muted">
                    <SelectValue placeholder="Estado Equip." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Condições</SelectItem>
                    <SelectItem value="good">Funcionando</SelectItem>
                    <SelectItem value="regular">Atenção (Regular)</SelectItem>
                    <SelectItem value="bad">Atenção (Ruim)</SelectItem>
                    <SelectItem value="critical">Crítico</SelectItem>
                    <SelectItem value="inoperative">Inoperante</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={technicianFilter} onValueChange={setTechnicianFilter}>
                  <SelectTrigger className="w-[160px] h-11 border-muted">
                    <SelectValue placeholder="Técnico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos Técnicos</SelectItem>
                    {technicians.map((tech) => (
                      <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {(search || statusFilter !== "all" || conditionFilter !== "all" || technicianFilter !== "all" || osFilter) && (
                  <Button variant="ghost" size="icon" onClick={clearFilters} className="h-11 w-11 text-muted-foreground hover:text-destructive">
                    <X className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Listing */}
        {filtered.length === 0 ? (
          <Card className="border-dashed py-16 bg-muted/20">
            <CardContent className="flex flex-col items-center text-center">
              <div className="bg-muted p-4 rounded-full mb-4">
                <FileText className="h-10 w-10 text-muted-foreground/40" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">Nenhum laudo encontrado</h3>
              <p className="text-muted-foreground max-w-sm mb-6">
                Não encontramos nenhum laudo com os filtros aplicados. Tente ajustar sua busca ou crie um novo.
              </p>
              <Button variant="outline" className="gap-2" onClick={clearFilters}>
                Limpar filtros
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filtered.map((report) => (
              <Card
                key={report.id}
                className="group border-muted/60 hover:border-primary/40 hover:shadow-md transition-all overflow-hidden"
              >
                <div className="p-0">
                  <div className="flex flex-col md:flex-row md:items-stretch">
                    {/* Status Strip */}
                    <div className={cn(
                      "w-full md:w-2 h-2 md:h-auto shrink-0",
                      report.equipment_condition === 'good' ? "bg-emerald-500" :
                      (report.equipment_condition === 'critical' || report.equipment_condition === 'inoperative') ? "bg-rose-500" : "bg-amber-500"
                    )} />
                    
                    <div className="p-5 flex-1 flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-lg font-bold text-foreground">
                            #{report.report_number.toString().padStart(4, "0")}
                          </span>
                          <h3 className="text-lg font-semibold text-foreground truncate">
                            {report.client?.name || "Cliente não informado"}
                          </h3>
                          {getConditionBadge(report.equipment_condition)}
                          {getCleanlinessBadge(report.cleanliness_status)}
                          <Badge variant="outline" className={cn(
                            "text-[10px] uppercase font-bold",
                            report.status === 'finalized' ? "text-primary border-primary/20 bg-primary/5" : "text-muted-foreground border-muted"
                          )}>
                            {REPORT_STATUS_LABELS[report.status] || report.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 shrink-0" />
                            <span>{formatDateInTz(report.report_date, tz)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 shrink-0" />
                            <span className="truncate">{report.equipment_type || "Equipamento não informado"}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 shrink-0" />
                            <span className="truncate">{report.technician_profile?.full_name || report.responsible_technician_name || "Sem técnico"}</span>
                          </div>
                          {(report.service || report.quote_service) && (
                            <div className="flex items-center gap-2 text-primary font-medium">
                              <Link2 className="h-4 w-4 shrink-0" />
                              <span className="truncate">
                                {report.service ? `OS #${report.service.quote_number.toString().padStart(4, "0")}` : `Orc. #${report.quote_service?.quote_number.toString().padStart(4, "0")}`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap md:flex-nowrap items-center gap-2 border-t md:border-t-0 pt-4 md:pt-0">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          className="flex-1 md:flex-none gap-2"
                          onClick={() => navigate(`/laudos/${report.id}`)}
                        >
                          <Eye className="h-4 w-4" /> Visualizar
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1 md:flex-none gap-2"
                          onClick={() => guardAction(() => handlePDF(report))}
                        >
                          <Download className="h-4 w-4" /> PDF
                        </Button>
                        
                        <div className="flex items-center gap-1 ml-auto">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-muted-foreground"
                            onClick={() => {
                              toast({ title: "Funcionalidade de compartilhamento será implementada em breve." });
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-muted-foreground hover:text-primary"
                            onClick={() => navigate(`/laudos/editar/${report.id}`)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-muted-foreground hover:text-destructive"
                            onClick={() => setDeleteId(report.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir laudo técnico?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita e o laudo será removido permanentemente.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
