import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FileText, Loader2, Search, Download, Plus, Edit, MessageCircle, Trash2, ClipboardList, MapPin, StickyNote, MoreVertical } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { useServices, type Service } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useSubscription } from "@/hooks/useSubscription";
import { QuoteDialog } from "@/components/services/QuoteDialog";
import { UpgradeModal } from "@/components/subscription";
import { generateQuotePDF } from "@/lib/generateQuotePDF";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useDocumentGuard } from "@/hooks/useDocumentGuard";
import { CompanyDataCompletionModal } from "@/components/onboarding/CompanyDataCompletionModal";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Pendente",
  completed: "Aprovado",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const STATUS_BORDER_COLORS: Record<string, string> = {
  scheduled: "border-l-blue-500",
  completed: "border-l-green-500",
  cancelled: "border-l-gray-400",
};

export default function Orcamentos() {
  const navigate = useNavigate();
  const { services, isLoading, update, remove, isUpdating, isDeleting } = useServices({ documentType: "quote" });
  const { clients } = useClients();
  const { canCreateService, servicesUsed, isFreePlan } = useSubscription();
  const { profile } = useAuth();
  const [search, setSearch] = useState("");
  const { guardAction, modalOpen: companyModalOpen, closeModal: closeCompanyModal, onDataSaved: onCompanyDataSaved } = useDocumentGuard();
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [quoteDialogOpen, setQuoteDialogOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [serviceToConvert, setServiceToConvert] = useState<Service | null>(null);

  const servicesWithQuotes = services.filter(service => {
    const client = clients.find(c => c.id === service.client_id);
    const searchLower = search.toLowerCase();
    return (
      service.description?.toLowerCase().includes(searchLower) ||
      client?.name.toLowerCase().includes(searchLower) ||
      service.quote_number.toString().includes(search)
    );
  });

  const getClientName = (clientId: string) => {
    return clients.find(c => c.id === clientId)?.name || "Cliente não encontrado";
  };

  const formatAddress = (service: Service) => {
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

  const handleGenerateQuote = (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setQuoteDialogOpen(true);
  };

  const handleCreate = () => {
    if (!canCreateService) {
      setShowUpgradeModal(true);
      return;
    }
    navigate("/orcamentos/novo");
  };

  const handleEdit = (service: Service) => {
    navigate(`/orcamentos/editar/${service.id}`);
  };

  const handleDirectDownload = async (service: Service) => {
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

      const items = (itemsRaw || []).map(item => ({
        ...item,
        discount: item.discount || 0,
        discount_type: (item.discount_type as "percentage" | "fixed") || "percentage",
      }));

      await generateQuotePDF({
        service,
        items,
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

  const handleWhatsApp = async (service: Service) => {
    const client = clients.find(c => c.id === service.client_id);
    if (!client) return;

    await handleDirectDownload(service);

    const formattedValue = service.value 
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(service.value)
      : "";

    const message = `*Orçamento #${String(service.quote_number).padStart(4, "0")}*
Cliente: ${client.name}
Data: ${format(new Date(), "dd/MM/yyyy")}
${formattedValue ? `Valor: ${formattedValue}` : ""}

_PDF do orçamento em anexo_`.trim();

    const phoneNumber = client.phone?.replace(/\D/g, "") || "";
    window.open(`https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const handleDelete = (service: Service) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (serviceToDelete) {
      await remove(serviceToDelete.id);
      setDeleteDialogOpen(false);
      setServiceToDelete(null);
      toast({
        title: "Orçamento excluído",
        description: "O orçamento foi removido com sucesso.",
      });
    }
  };

  const handleConvertToServiceOrder = (service: Service) => {
    setServiceToConvert(service);
    setConvertDialogOpen(true);
  };

  const confirmConvert = async () => {
    if (serviceToConvert) {
      await update({ 
        id: serviceToConvert.id, 
        data: { document_type: "service_order" } 
      });
      setConvertDialogOpen(false);
      setServiceToConvert(null);
      toast({
        title: "Ordem de Serviço gerada",
        description: "O orçamento foi convertido em OS com sucesso.",
      });
    }
  };

  const selectedService = services.find(s => s.id === selectedServiceId);

  const renderQuoteCard = (service: Service) => {
    const address = formatAddress(service);
    const borderColor = STATUS_BORDER_COLORS[service.status] || "border-l-blue-500";

    return (
      <Card key={service.id} className={`border-l-[3px] ${borderColor} hover:shadow-card-hover transition-shadow overflow-hidden`}>
        <CardContent className="p-5">
          <div className="space-y-3">
            {/* Header: Quote number + Status badge */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                Orçamento #{service.quote_number?.toString().padStart(4, "0")}
              </span>
              <Badge className={`text-xs font-semibold ${STATUS_COLORS[service.status] || STATUS_COLORS.scheduled}`}>
                {STATUS_LABELS[service.status] || "Pendente"}
              </Badge>
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
            {((address && (address.cep || address.street)) || service.notes) && (
              <div className="bg-muted/40 rounded-lg p-3 space-y-1.5 text-xs text-muted-foreground">
                {address && (address.cep || address.street) && (
                  <div className="flex gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      {address.cep && <p>{address.cep}</p>}
                      {address.street && <p>{address.street}{address.neighborhood ? ` - ${address.neighborhood}` : ""}</p>}
                      {address.cityState && <p>{address.cityState}</p>}
                    </div>
                  </div>
                )}
                {service.notes && (
                  <div className="flex gap-2">
                    <StickyNote className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <p className="line-clamp-2">{service.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Date & Value */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {format(new Date(service.created_at), "dd/MM/yyyy", { locale: ptBR })}
              </p>
              {service.value && (
                <p className="text-sm font-semibold text-primary">
                  R$ {service.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              )}
            </div>

            {/* Actions: more menu (same as OS) */}
            <div className="flex items-center justify-end pt-2 border-t border-border/50">
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
                  <DropdownMenuItem onClick={() => handleGenerateQuote(service.id)}>
                    <Download className="mr-2 h-4 w-4" />
                    Visualizar Orçamento
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => guardAction(() => handleDirectDownload(service))}>
                    <Download className="mr-2 h-4 w-4" />
                    Baixar PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => guardAction(() => handleWhatsApp(service))}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Compartilhar WhatsApp
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleConvertToServiceOrder(service)}>
                    <ClipboardList className="mr-2 h-4 w-4" />
                    Gerar OS
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(`/laudos/novo?quote_service_id=${service.id}`)}>
                    <FileText className="mr-2 h-4 w-4" />
                    Criar Laudo Técnico
                  </DropdownMenuItem>
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

  return (
    <AppLayout>
      <PageTutorialBanner pageKey="orcamentos" title="Orçamentos" message="Orçamentos profissionais impressionam clientes e aumentam sua taxa de conversão." />
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Orçamentos</h1>
            <p className="text-muted-foreground">
              Gere e gerencie orçamentos para seus clientes
            </p>
          </div>
          <Button className="gap-2" onClick={handleCreate}>
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Novo Orçamento</span>
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, descrição ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-32 rounded bg-muted" />
                  <div className="h-5 w-20 rounded-full bg-muted" />
                </div>
                <div className="h-3 w-48 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : servicesWithQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 py-12 px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {search ? "Nenhum orçamento encontrado" : "Crie seu primeiro orçamento"}
            </h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-5 leading-relaxed">
              {search
                ? "Tente buscar por outro termo."
                : "Gere orçamentos profissionais a partir dos seus serviços para enviar aos clientes."}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {servicesWithQuotes.map(renderQuoteCard)}
          </div>
        )}
      </div>

      {selectedService && (
        <QuoteDialog
          open={quoteDialogOpen}
          onOpenChange={setQuoteDialogOpen}
          service={selectedService}
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
            <AlertDialogTitle>Excluir orçamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O orçamento #{serviceToDelete?.quote_number} será removido permanentemente.
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

      {/* Convert to Service Order Confirmation Dialog */}
      <AlertDialog open={convertDialogOpen} onOpenChange={setConvertDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gerar Ordem de Serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              O orçamento #{serviceToConvert?.quote_number} será convertido em uma Ordem de Serviço. 
              Isso manterá todos os dados e itens do orçamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmConvert}
              disabled={isUpdating}
            >
              {isUpdating ? "Convertendo..." : "Gerar OS"}
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
