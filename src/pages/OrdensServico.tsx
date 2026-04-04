import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ClipboardList, Loader2, Search, Plus, Edit, Download, Trash2, MapPin, StickyNote, ArrowUpDown, MoreVertical, Play, CheckCircle2, Send, Eye, ChevronLeft, ChevronRight, FileText } from "lucide-react";
import { formatDateInTz, formatTimeInTz, formatDateTimeInTz, getDatePartInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useServices, type ServiceStatus, SERVICE_STATUS_LABELS } from "@/hooks/useServices";
import { usePaginatedServices } from "@/hooks/usePaginatedServices";
import { useClients } from "@/hooks/useClients";
import { useSubscription } from "@/hooks/useSubscription";
import { ServiceOrderDialog } from "@/components/services/ServiceOrderDialog";
import { UpgradeModal } from "@/components/subscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { generateServiceOrderPDF } from "@/lib/generateServiceOrderPDF";
import { toast } from "@/hooks/use-toast";
import { useServicePDFSend } from "@/hooks/useServicePDFSend";
import { useDocumentGuard } from "@/hooks/useDocumentGuard";
import { CompanyDataCompletionModal } from "@/components/onboarding/CompanyDataCompletionModal";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Agendado",
  in_progress: "Em Andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-info text-info-foreground",
  in_progress: "bg-warning text-warning-foreground",
  completed: "bg-success text-success-foreground",
  cancelled: "bg-muted text-muted-foreground",
};

const STATUS_BORDER_COLORS: Record<string, string> = {
  scheduled: "border-l-info",
  in_progress: "border-l-warning",
  completed: "border-l-success",
  cancelled: "border-l-muted-foreground",
  overdue: "border-l-destructive",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: "PIX",
  dinheiro: "Dinheiro",
  cartao_credito: "Cartão de Crédito",
  cartao_debito: "Cartão de Débito",
  boleto: "Boleto",
  transferencia: "Transferência",
};

const STATUS_ORDER: Record<string, number> = {
  scheduled: 0,
  in_progress: 1,
  completed: 2,
  cancelled: 3,
};

type SortOption = "date-asc" | "date-desc" | "created" | "client" | "status";

function getLocalToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function addDays(ymd: string, days: number): string {
  const d = new Date(ymd + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getEndOfWeek(ymd: string): string {
  const d = new Date(ymd + "T12:00:00");
  const dayOfWeek = d.getDay();
  const daysToSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  d.setDate(d.getDate() + daysToSunday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface DateGroup {
  key: string;
  label: string;
  isOverdue?: boolean;
  services: typeof import("@/hooks/useServices").useServices extends () => { services: infer S } ? S : any[];
}

export default function OrdensServico() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Paginated data loading
  const {
    services,
    totalCount,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedServices({
    documentType: "service_order",
    statusFilter: statusFilter !== "all" ? statusFilter : undefined,
  });

  // Mutations only
  const { updateStatus, remove, isDeleting } = useServices({ documentType: "service_order", skipQuery: true });
  const { clients } = useClients();
  const { canCreateService, servicesUsed, isFreePlan } = useSubscription();
  const { profile } = useAuth();
  const tz = useOrgTimezone();
  const { sendOSViaWhatsApp } = useServicePDFSend();
  const { guardAction, modalOpen: companyModalOpen, closeModal: closeCompanyModal, onDataSaved: onCompanyDataSaved } = useDocumentGuard();
  const [search, setSearch] = useState("");
  const [whatsappConfirmService, setWhatsappConfirmService] = useState<{ id: string; phone?: string } | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>("date-asc");
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [osDialogOpen, setOsDialogOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<typeof services[0] | null>(null);

  // Handle query params from QuickActions
  useEffect(() => {
    if (searchParams.get("create") === "true") {
      if (!canCreateService) {
        setShowUpgradeModal(true);
      } else {
        navigate("/ordens-servico/nova", { replace: true });
      }
      const newParams = new URLSearchParams();
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams, canCreateService, navigate]);

  const filteredServices = useMemo(() => {
    return services.filter(service => {
      const client = clients.find(c => c.id === service.client_id);
      const searchLower = search.toLowerCase();
      return (
        service.description?.toLowerCase().includes(searchLower) ||
        client?.name.toLowerCase().includes(searchLower) ||
        service.quote_number?.toString().includes(search)
      );
    });
  }, [services, clients, search]);


  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || "Cliente não encontrado";
  };

  const sortedServices = useMemo(() => {
    const sorted = [...filteredServices];
    switch (sortBy) {
      case "date-asc":
        sorted.sort((a, b) => {
          if (!a.scheduled_date) return 1;
          if (!b.scheduled_date) return -1;
          return a.scheduled_date.localeCompare(b.scheduled_date);
        });
        break;
      case "date-desc":
        sorted.sort((a, b) => {
          if (!a.scheduled_date) return 1;
          if (!b.scheduled_date) return -1;
          return b.scheduled_date.localeCompare(a.scheduled_date);
        });
        break;
      case "created":
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case "client":
        sorted.sort((a, b) => {
          const nameA = getClientName(a.client_id);
          const nameB = getClientName(b.client_id);
          return nameA.localeCompare(nameB, "pt-BR");
        });
        break;
      case "status":
        sorted.sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9));
        break;
    }
    return sorted;
  }, [filteredServices, sortBy, clients]);

  const groupedServices = useMemo(() => {
    if (sortBy !== "date-asc" && sortBy !== "date-desc") return null;

    const today = getLocalToday();
    const tomorrow = addDays(today, 1);
    const endOfWeek = getEndOfWeek(today);
    const nextMonday = addDays(endOfWeek, 1);
    const endOfNextWeek = getEndOfWeek(nextMonday);

    const groups: Record<string, { label: string; isOverdue?: boolean; emoji?: string; items: typeof sortedServices }> = {
      overdue: { label: "Atrasado", isOverdue: true, emoji: "🔴", items: [] },
      today: { label: "Hoje", emoji: "📌", items: [] },
      tomorrow: { label: "Amanhã", emoji: "📅", items: [] },
      thisWeek: { label: "Esta Semana", emoji: "📆", items: [] },
      nextWeek: { label: "Próxima Semana", emoji: "🗓️", items: [] },
      future: { label: "Futuro", emoji: "🔮", items: [] },
      past: { label: "Passado", emoji: "✅", items: [] },
      noDate: { label: "Sem Data", emoji: "❓", items: [] },
    };

    for (const s of sortedServices) {
      if (!s.scheduled_date) {
        groups.noDate.items.push(s);
        continue;
      }
      const dateYmd = getDatePartInTz(s.scheduled_date, tz);
      const isTerminal = s.status === "completed" || s.status === "cancelled";

      if (dateYmd < today && !isTerminal) {
        groups.overdue.items.push(s);
      } else if (dateYmd < today && isTerminal) {
        groups.past.items.push(s);
      } else if (dateYmd === today) {
        groups.today.items.push(s);
      } else if (dateYmd === tomorrow) {
        groups.tomorrow.items.push(s);
      } else if (dateYmd <= endOfWeek) {
        groups.thisWeek.items.push(s);
      } else if (dateYmd <= endOfNextWeek) {
        groups.nextWeek.items.push(s);
      } else {
        groups.future.items.push(s);
      }
    }

    return Object.entries(groups)
      .filter(([, g]) => g.items.length > 0)
      .map(([key, g]) => ({ key, label: g.label, isOverdue: g.isOverdue, emoji: g.emoji, items: g.items }));
  }, [sortedServices, sortBy]);


  const isServiceOverdue = (service: typeof services[0]) => {
    if (!service.scheduled_date) return false;
    if (service.status === "completed" || service.status === "cancelled") return false;
    return getDatePartInTz(service.scheduled_date, tz) < getLocalToday();
  };

  const isServiceToday = (service: typeof services[0]) => {
    if (!service.scheduled_date) return false;
    return getDatePartInTz(service.scheduled_date, tz) === getLocalToday();
  };

  const formatAddress = (service: typeof services[0]) => {
    if (service.service_zip_code || service.service_street) {
      const streetLine = [service.service_street, service.service_number].filter(Boolean).join(", ");
      const cityState = [service.service_city, service.service_state].filter(Boolean).join(" - ");
      return {
        cep: service.service_zip_code || "",
        street: streetLine,
        neighborhood: service.service_neighborhood || "",
        cityState,
      };
    }
    
    const client = clients.find(c => c.id === service.client_id);
    if (client && (client.zip_code || client.street)) {
      const streetLine = [client.street, client.number].filter(Boolean).join(", ");
      const cityState = [client.city, client.state].filter(Boolean).join(" - ");
      return {
        cep: client.zip_code || "",
        street: streetLine,
        neighborhood: client.neighborhood || "",
        cityState,
      };
    }
    
    return null;
  };

  const handleViewOS = (serviceId: string) => {
    navigate(`/ordens-servico/${serviceId}`);
  };

  const handleDelete = (service: typeof services[0]) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (serviceToDelete) {
      await remove(serviceToDelete.id);
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
      toast({
        title: "OS excluída",
        description: "A ordem de serviço foi removida com sucesso.",
      });
    }
  };

  const handleCreate = () => {
    if (!canCreateService) {
      setShowUpgradeModal(true);
      return;
    }
    navigate("/ordens-servico/nova");
  };

  const handleEdit = (service: typeof services[0]) => {
    navigate(`/ordens-servico/editar/${service.id}`);
  };

  const handleStatusChange = async (serviceId: string, newStatus: ServiceStatus) => {
    await updateStatus({ id: serviceId, status: newStatus });
  };

  const handleDirectDownload = async (service: typeof services[0]) => {
    try {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, cnpj_cpf, phone, email, address, city, state, logo_url, website, zip_code, signature_url, auto_signature_os")
        .eq("id", profile?.organization_id)
        .single();

      const { data: itemsRaw } = await supabase
        .from("service_items")
        .select("*")
        .eq("service_id", service.id);

      const { data: equipmentRaw } = await supabase
        .from("service_equipment")
        .select("id, name, brand, model, serial_number, conditions, defects, solution, technical_report, warranty_terms")
        .eq("service_id", service.id)
        .order("created_at");

      const items = (itemsRaw || []).map(item => ({
        ...item,
        discount: item.discount || 0,
        discount_type: (item.discount_type as "percentage" | "fixed") || "percentage",
      }));

      const orderData = {
        entryDate: service.entry_date 
          ? formatDateInTz(service.entry_date, tz) 
          : "",
        entryTime: service.entry_date 
          ? formatTimeInTz(service.entry_date, tz) 
          : "",
        exitDate: service.exit_date 
          ? formatDateInTz(service.exit_date, tz) 
          : "",
        exitTime: service.exit_date 
          ? formatTimeInTz(service.exit_date, tz) 
          : "",
        equipmentType: service.equipment_type || "",
        equipmentBrand: service.equipment_brand || "",
        equipmentModel: service.equipment_model || "",
        solution: service.solution || service.description || "",
        paymentMethod: service.payment_method 
          ? PAYMENT_METHOD_LABELS[service.payment_method] || service.payment_method 
          : "",
        paymentDueDate: service.payment_due_date 
          ? formatDateInTz(service.payment_due_date, tz) 
          : "",
        paymentNotes: service.payment_notes || "",
      };

      const itemsTotal = (items || []).reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

      // Fetch client signature
      const { data: sigData } = await supabase
        .from("service_signatures")
        .select("signature_url")
        .eq("service_id", service.id)
        .maybeSingle();

      await generateServiceOrderPDF({
        service: {
          ...service,
          value: itemsTotal > 0 ? itemsTotal : service.value,
        },
        items: items || [],
        equipmentList: equipmentRaw || [],
        organizationName: org?.name || "Minha Empresa",
        organizationCnpj: org?.cnpj_cpf || undefined,
        organizationPhone: org?.phone || undefined,
        organizationEmail: org?.email || undefined,
        organizationAddress: org?.address || undefined,
        organizationLogo: org?.logo_url || undefined,
        organizationWebsite: org?.website || undefined,
        organizationZipCode: org?.zip_code || undefined,
        organizationCity: org?.city || undefined,
        organizationState: org?.state || undefined,
        organizationSignature: org?.signature_url || undefined,
        autoSignatureOS: org?.auto_signature_os ?? false,
        clientSignatureUrl: sigData?.signature_url || undefined,
        orderData,
        isFreePlan,
      });

      toast({
        title: "PDF gerado!",
        description: "O arquivo foi baixado com sucesso",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao gerar PDF",
        description: (error as Error).message,
      });
    }
  };


  const renderServiceCard = (service: typeof services[0]) => {
    const address = formatAddress(service);
    const overdue = isServiceOverdue(service);
    const borderColor = overdue ? STATUS_BORDER_COLORS.overdue : STATUS_BORDER_COLORS[service.status] || "";

    return (
      <Card key={service.id} className={`border-l-[3px] ${borderColor} hover:shadow-card-hover transition-shadow overflow-hidden cursor-pointer`} onClick={() => handleViewOS(service.id)}>
        <CardContent className="p-3.5">
          <div className="space-y-2">
            {/* Header: OS number + value + Status badge */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-medium text-muted-foreground">
                  OS #{service.quote_number?.toString().padStart(4, "0")}
                </span>
                {(service.value != null && service.value > 0) && (
                  <span className="text-sm font-semibold text-foreground">
                    {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.value)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {overdue && (
                  <Badge className="text-[10px] px-1.5 py-0 h-5 font-medium bg-destructive/10 text-destructive">
                    Atrasado
                  </Badge>
                )}
                <Badge className={`text-[10px] px-1.5 py-0 h-5 font-medium ${STATUS_COLORS[service.status]}`}>
                  {STATUS_LABELS[service.status]}
                </Badge>
              </div>
            </div>

            {/* Client name (primary emphasis) */}
            <div>
              <h3 className="text-base font-semibold text-foreground truncate">
                {getClientName(service.client_id)}
              </h3>
              {service.description && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">
                  {service.description}
                </p>
              )}
            </div>

            {/* Secondary info block */}
            {(service.scheduled_date || (address && (address.street)) || service.notes) && (
              <div className="bg-muted/40 rounded-lg p-2.5 space-y-1 text-[11px] text-muted-foreground">
                {service.scheduled_date && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Data:</span>
                    <span>{formatDateTimeInTz(service.scheduled_date, tz)}</span>
                  </div>
                )}
                {address && address.street && (
                  <div className="flex items-center gap-1.5 truncate">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {[address.street, address.neighborhood].filter(Boolean).join(" - ")}
                      {address.cityState ? `, ${address.cityState}` : ""}
                    </span>
                  </div>
                )}
                {service.notes && (
                  <div className="flex gap-1.5">
                    <StickyNote className="h-3 w-3 shrink-0 mt-0.5" />
                    <p className="line-clamp-1">{service.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions: primary button + more menu */}
            <div className="flex items-center justify-between pt-1.5 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
              <div>
                {service.status === "scheduled" && (
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange(service.id, "in_progress")}
                    className="h-8 gap-1.5 bg-warning hover:bg-warning/90 text-warning-foreground"
                  >
                    <Play className="h-3.5 w-3.5" />
                    Iniciar
                  </Button>
                )}
                {service.status === "in_progress" && (
                  <Button
                    size="sm"
                    onClick={() => handleStatusChange(service.id, "completed")}
                    className="h-8 gap-1.5 bg-success hover:bg-success/90 text-success-foreground"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluir
                  </Button>
                )}
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleEdit(service)}>
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleViewOS(service.id)}>
                    <Eye className="mr-2 h-4 w-4" />
                    Visualizar OS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => guardAction(() => setWhatsappConfirmService({ id: service.id, phone: service.client?.phone || undefined }))}>
                    <Send className="mr-2 h-4 w-4" />
                    Enviar OS via WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/laudos/novo?service_id=${service.id}`)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Criar Laudo Técnico
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {availableStatuses.filter(s => s !== service.status).map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => handleStatusChange(service.id, status)}
                    >
                      {SERVICE_STATUS_LABELS[status]}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => handleDelete(service)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const selectedService = services.find(s => s.id === selectedServiceId);
  const selectedClient = selectedService ? clients.find(c => c.id === selectedService.client_id) : null;

  const availableStatuses: ServiceStatus[] = ["scheduled", "in_progress", "completed"];

  return (
    <AppLayout>
      <PageTutorialBanner pageKey="ordens-servico" title="Ordens de Serviço" message="A OS organiza o trabalho e registra o serviço profissionalmente. Ela é a base da operação." />
      <div className="space-y-6">
        <div data-tour="os-header" className="flex items-center justify-between gap-4">
         <div>
            <h1 className="text-2xl font-bold text-foreground">Ordens de Serviço</h1>
            <p className="text-muted-foreground">
              {totalCount} OS registrada{totalCount !== 1 ? "s" : ""}
            </p>
          </div>
          <Button className="gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nova OS</span>
          </Button>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente, descrição ou número..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-[200px] shrink-0">
              <ArrowUpDown className="h-4 w-4 mr-2 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-asc">Data (mais próxima)</SelectItem>
              <SelectItem value="date-desc">Data (mais distante)</SelectItem>
              <SelectItem value="created">Data de criação</SelectItem>
              <SelectItem value="client">Cliente (A–Z)</SelectItem>
              <SelectItem value="status">Status</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-5 w-20 rounded-full bg-muted" />
                </div>
                <div className="h-3 w-48 rounded bg-muted" />
                <div className="h-3 w-24 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 py-12 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
              <ClipboardList className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {search ? "Nenhuma OS encontrada" : "Crie sua primeira Ordem de Serviço"}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-5 leading-relaxed">
              {search
                ? "Tente buscar por outro termo ou alterar os filtros."
                : "Registre ordens de serviço para organizar seus atendimentos, gerar PDFs e acompanhar pagamentos."}
            </p>
          </div>
        ) : groupedServices ? (
          <>
            <div className="space-y-10">
              {groupedServices.map((group, index) => (
                <div key={group.key} className={`${group.isOverdue ? "bg-destructive/5 dark:bg-destructive/10 rounded-xl p-4 -mx-2" : ""}`}>
                  <div className={`flex items-center gap-2.5 mb-4 pb-2.5 ${index > 0 ? "pt-1" : ""}`}>
                    {group.emoji && <span className="text-base">{group.emoji}</span>}
                    <h2 className={`text-sm font-bold uppercase tracking-wider ${group.isOverdue ? "text-destructive" : "text-foreground/70"}`}>
                      {group.label}
                    </h2>
                    <Badge variant={group.isOverdue ? "destructive" : "secondary"} className="text-[10px] h-5 min-w-5 px-1.5">
                      {group.items.length}
                    </Badge>
                    <div className="flex-1 h-px bg-border/60" />
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map(renderServiceCard)}
                  </div>
                </div>
              ))}
            </div>
            {/* Load More for grouped view */}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      Carregar mais
                      <span className="text-muted-foreground">
                        ({services.length} de {totalCount})
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sortedServices.map(renderServiceCard)}
            </div>
            {/* Load More for flat view */}
            {hasNextPage && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="gap-2"
                >
                  {isFetchingNextPage ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando...
                    </>
                  ) : (
                    <>
                      Carregar mais
                      <span className="text-muted-foreground">
                        ({services.length} de {totalCount})
                      </span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {selectedService && (
        <ServiceOrderDialog
          open={osDialogOpen}
          onOpenChange={setOsDialogOpen}
          service={{
            ...selectedService,
            client: selectedClient || undefined,
          }}
        />
      )}

      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        servicesUsed={servicesUsed}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A OS #{serviceToDelete?.quote_number?.toString().padStart(4, "0")} será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!whatsappConfirmService} onOpenChange={(open) => !open && setWhatsappConfirmService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Enviar OS via WhatsApp?</AlertDialogTitle>
            <AlertDialogDescription>
              A ordem de serviço será gerada em PDF e enviada para o cliente via WhatsApp.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (whatsappConfirmService) {
                sendOSViaWhatsApp(whatsappConfirmService.id, whatsappConfirmService.phone);
                setWhatsappConfirmService(null);
              }
            }}>
              Enviar
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