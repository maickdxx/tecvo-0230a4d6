import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useServiceLaudos } from "@/hooks/useServiceLaudos";
import { REPORT_STATUS_LABELS } from "@/hooks/useTechnicalReports";
import { generateReportPDF } from "@/lib/generateReportPDF";
import { generateServiceOrderPDF } from "@/lib/generateServiceOrderPDF";
import { useSubscription } from "@/hooks/useSubscription";
import { AppLayout } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  Map,
  ExternalLink,
  FileText,
  Package,
  Wrench,
  DollarSign,
  Edit,
  Trash2,
  MoreVertical,
  Send,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Clock,
  PenLine,
  Share2,
  Play,
  CheckCircle2,
  EyeOff,
  Download,
  Link2,
  ClipboardCheck,
  Eye,
} from "lucide-react";
import { formatDateTimeInTz, formatDateInTz, formatTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useServices, SERVICE_STATUS_LABELS } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import type { ServiceStatus } from "@/hooks/useServices";
import { useServicePDFSend } from "@/hooks/useServicePDFSend";
import { useServiceSignatures } from "@/hooks/useServiceSignatures";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useDocumentGuard } from "@/hooks/useDocumentGuard";
import { CompanyDataCompletionModal } from "@/components/onboarding/CompanyDataCompletionModal";
import { ServiceCompleteDialog } from "@/components/services/ServiceCompleteDialog";
import type { ServicePaymentInput } from "@/hooks/useServicePayments";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: typeof Calendar }> = {
  scheduled: {
    label: "Agendado",
    className: "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700",
    icon: Calendar,
  },
  in_progress: {
    label: "Em Andamento",
    className: "bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-700",
    icon: Play,
  },
  completed: {
    label: "Concluído",
    className: "bg-emerald-500/10 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-700",
    icon: CheckCircle,
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: AlertTriangle,
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface ServiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number | null;
  discount_type: string | null;
}

interface ServiceEquipment {
  id: string;
  name: string;
  brand: string | null;
  model: string | null;
  serial_number: string | null;
  defects: string | null;
  conditions: string | null;
  solution: string | null;
  technical_report: string | null;
}

const calculateItemSubtotal = (item: ServiceItem) => {
  const gross = item.quantity * item.unit_price;
  if (!item.discount) return gross;
  if (item.discount_type === "percentage") return gross - (gross * item.discount / 100);
  return gross - item.discount;
};

const formatDiscount = (item: ServiceItem) => {
  if (!item.discount) return null;
  if (item.discount_type === "percentage") return `${item.discount}%`;
  return formatCurrency(item.discount);
};

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

export default function OrdemServicoDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isEmployee } = useUserRole();
  const { organization } = useOrganization();
  const tz = useOrgTimezone();
  const { services, updateStatus, remove } = useServices();
  const { sendOSViaWhatsApp, sending: sendingPDF } = useServicePDFSend();
  const { signature, createSignature, createSignatureLink, isCreatingLink } = useServiceSignatures(id);
  const { isFreePlan } = useSubscription();
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showWhatsappConfirm, setShowWhatsappConfirm] = useState(false);
  const [showLaudoWarning, setShowLaudoWarning] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const { guardAction, modalOpen: companyModalOpen, closeModal: closeCompanyModal, onDataSaved: onCompanyDataSaved } = useDocumentGuard();

  const service = services.find(s => s.id === id);
  const { laudos, laudoCount } = useServiceLaudos(id);

  const { data: serviceItems = [] } = useQuery({
    queryKey: ["service-items-detail", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("service_items")
        .select("*")
        .eq("service_id", id)
        .is("deleted_at", null)
        .order("created_at");
      if (error) throw error;
      return data as ServiceItem[];
    },
    enabled: !!id,
  });

  const { data: serviceEquipment = [] } = useQuery({
    queryKey: ["service-equipment-detail", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("service_equipment")
        .select("*")
        .eq("service_id", id)
        .order("created_at");
      if (error) throw error;
      return data as ServiceEquipment[];
    },
    enabled: !!id,
  });

  const { data: servicePhotos = [] } = useQuery({
    queryKey: ["service-photos-detail", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("service_photos")
        .select("*")
        .eq("service_id", id)
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  if (!service) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  // Block employee access to services not assigned to them
  if (isEmployee && service.assigned_to !== user?.id) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <h2 className="text-lg font-semibold">Acesso Negado</h2>
          <p className="text-sm text-muted-foreground">Você não tem permissão para visualizar este serviço.</p>
          <Button variant="outline" onClick={() => navigate(-1)}>Voltar</Button>
        </div>
      </AppLayout>
    );
  }

  const statusConfig = STATUS_CONFIG[service.status] || STATUS_CONFIG.scheduled;
  const availableStatuses: ServiceStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

  const hasServiceAddress = service.service_street || service.service_city;
  const getAddress = () => {
    if (hasServiceAddress) {
      const parts = [service.service_street, service.service_number, service.service_complement].filter(Boolean).join(", ");
      const location = [service.service_neighborhood, service.service_city, service.service_state].filter(Boolean).join(" - ");
      const zipCode = service.service_zip_code;
      return { parts, location, zipCode };
    }
    if (service.client?.address) return { parts: service.client.address, location: null, zipCode: null };
    return null;
  };
  const address = getAddress();

  const openInMaps = () => {
    let query = "";
    if (hasServiceAddress) {
      query = [service.service_street, service.service_number, service.service_neighborhood, service.service_city, service.service_state].filter(Boolean).join(", ");
    } else if (service.client?.address) {
      query = service.client.address;
    }
    if (query) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank");
  };

  const handleStatusChange = async (newStatus: ServiceStatus) => {
    setIsUpdating(true);
    try {
      await updateStatus({ id: service.id, status: newStatus });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenCompleteDialog = () => {
    if (!service.value) {
      handleCompleteWithPayments([]);
      return;
    }
    setShowCompleteDialog(true);
  };

  const handleCompleteWithPayments = async (payments: ServicePaymentInput[], signatureBlob?: Blob | null, signerName?: string) => {
    setIsUpdating(true);
    try {
      await updateStatus({ id: service.id, status: "completed" });
      if (signatureBlob) {
        await createSignature({ serviceId: service.id, blob: signatureBlob, signerName });
      }
      setShowCompleteDialog(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    await remove(service.id);
    setShowDeleteDialog(false);
    toast({ title: "OS excluída", description: "A ordem de serviço foi removida com sucesso." });
    navigate("/ordens-servico");
  };

  const PAYMENT_METHOD_LABELS: Record<string, string> = {
    pix: "PIX", dinheiro: "Dinheiro", cartao_credito: "Cartão de Crédito",
    cartao_debito: "Cartão de Débito", boleto: "Boleto", transferencia: "Transferência",
  };

  const handleDownloadPDF = async () => {
    setIsDownloading(true);
    try {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, cnpj_cpf, phone, email, address, city, state, logo_url, website, zip_code, signature_url, auto_signature_os")
        .eq("id", organization?.id)
        .single();

      const orderData = {
        entryDate: service.entry_date ? formatDateInTz(service.entry_date, tz) : "",
        entryTime: service.entry_date ? formatTimeInTz(service.entry_date, tz) : "",
        exitDate: service.exit_date ? formatDateInTz(service.exit_date, tz) : "",
        exitTime: service.exit_date ? formatTimeInTz(service.exit_date, tz) : "",
        equipmentType: service.equipment_type || "",
        equipmentBrand: service.equipment_brand || "",
        equipmentModel: service.equipment_model || "",
        solution: service.solution || service.description || "",
        paymentMethod: service.payment_method ? PAYMENT_METHOD_LABELS[service.payment_method] || service.payment_method : "",
        paymentDueDate: service.payment_due_date ? formatDateInTz(service.payment_due_date, tz) : "",
        paymentNotes: service.payment_notes || "",
      };

      const finalValue = itemsTotal > 0 ? itemsTotal : service.value;

      await generateServiceOrderPDF({
        service: { ...service, value: finalValue },
        items: (serviceItems || []) as any,
        equipmentList: serviceEquipment || [],
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
        clientSignatureUrl: signature?.signature_url || undefined,
        orderData,
        isFreePlan,
      });

      toast({ title: "PDF gerado!", description: "O arquivo foi baixado com sucesso" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao gerar PDF", description: (error as Error).message });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSendSignatureLink = async () => {
    try {
      let sig = signature;
      if (!sig) sig = await createSignatureLink(service.id);
      const url = `${window.location.origin}/assinar/${sig.token}`;
      if (navigator.share) {
        await navigator.share({ title: `Assinar OS #${service.quote_number}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!", description: "Cole e envie para o cliente" });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") toast({ variant: "destructive", title: "Erro", description: err.message });
    }
  };

  const itemsTotal = serviceItems.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);

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
                  OS #{service.quote_number?.toString().padStart(4, "0")}
                </h1>
                <Badge className={cn("text-xs font-medium border", statusConfig.className)}>
                  {statusConfig.label}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {service.client?.name || "Cliente não encontrado"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Primary action */}
            {service.status === "scheduled" && (
              <Button size="sm" onClick={() => handleStatusChange("in_progress")} disabled={isUpdating} className="h-8 gap-1.5">
                <Play className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Iniciar</span>
              </Button>
            )}
            {service.status === "in_progress" && (
              <Button size="sm" onClick={handleOpenCompleteDialog} disabled={isUpdating} className="h-8 gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Concluir</span>
              </Button>
            )}

            {/* More menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem onClick={() => navigate(`/ordens-servico/editar/${service.id}`)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Editar OS
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => guardAction(() => setShowWhatsappConfirm(true))}
                  disabled={sendingPDF}
                >
                  <Send className="mr-2 h-4 w-4" />
                  Enviar OS via WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => guardAction(handleDownloadPDF)}
                  disabled={isDownloading}
                >
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Baixar PDF
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {laudoCount > 0 && (
                  <DropdownMenuItem onClick={() => {
                    const el = document.getElementById("laudos-vinculados-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Ver Laudos Técnicos ({laudoCount})
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => {
                  if (laudoCount > 0) {
                    setShowLaudoWarning(true);
                  } else {
                    navigate(`/laudos/novo?service_id=${service.id}`);
                  }
                }}>
                  <FileText className="mr-2 h-4 w-4" />
                  Criar Laudo Técnico
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {availableStatuses.filter(s => s !== service.status).map((status) => (
                  <DropdownMenuItem key={status} onClick={() => handleStatusChange(status)} disabled={isUpdating}>
                    {SERVICE_STATUS_LABELS[status]}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir OS
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Client info */}
        <SectionCard icon={User} title="Cliente">
          <div className="space-y-1">
            <p className="text-base font-semibold text-foreground">{service.client?.name || "—"}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {service.client?.phone && (
                <a href={`tel:${service.client.phone}`} className="text-xs text-muted-foreground flex items-center gap-1 hover:text-primary transition-colors">
                  <Phone className="h-3 w-3" /> {service.client.phone}
                </a>
              )}
              {service.client?.email && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {service.client.email}
                </span>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Service info */}
        <SectionCard icon={FileText} title="Informações do Serviço">
          {service.service_type && (
            <InfoRow label="Tipo de Serviço" value={typeLabels[service.service_type] || service.service_type} />
          )}
          {(service.scheduled_date || service.entry_date) && (
            <InfoRow
              label="Data Agendada"
              value={service.entry_date ? formatDateTimeInTz(service.entry_date, tz) : formatDateInTz(service.scheduled_date!, tz)}
            />
          )}
          {service.completed_date && (
            <InfoRow label="Data de Conclusão" value={formatDateTimeInTz(service.completed_date, tz)} />
          )}
          {service.assigned_profile?.full_name && (
            <InfoRow label="Técnico Responsável" value={service.assigned_profile.full_name} />
          )}
          {service.value != null && (
            <div className="flex justify-between items-baseline gap-4 py-1.5">
              <span className="text-xs font-medium text-muted-foreground shrink-0">Valor Total</span>
              <span className="text-base font-bold text-primary">{formatCurrency(service.value)}</span>
            </div>
          )}
        </SectionCard>

        {/* Service Items */}
        {serviceItems.length > 0 && (
          <SectionCard icon={Package} title={`Itens do Serviço (${serviceItems.length})`}>
            <div className="space-y-2">
              {serviceItems.map((item) => {
                const subtotal = calculateItemSubtotal(item);
                const discount = formatDiscount(item);
                return (
                  <div key={item.id} className="rounded-lg border border-border/40 bg-muted/20 p-3">
                    <p className="text-sm font-medium text-foreground">{item.description}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{item.quantity} un × {formatCurrency(item.unit_price)}</span>
                      {discount && <span className="text-destructive">- {discount}</span>}
                      <span className="font-semibold text-foreground ml-auto">{formatCurrency(subtotal)}</span>
                    </div>
                  </div>
                );
              })}
              {serviceItems.length > 1 && (
                <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Total dos Itens</span>
                  <span className="text-sm font-bold text-primary">{formatCurrency(itemsTotal)}</span>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Equipment */}
        {serviceEquipment.length > 0 && (
          <SectionCard icon={Wrench} title={`Equipamentos (${serviceEquipment.length})`}>
            <div className="space-y-2">
              {serviceEquipment.map((eq) => (
                <div key={eq.id} className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
                  <p className="text-sm font-medium text-foreground">{eq.name}</p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {eq.brand && <span>Marca: {eq.brand}</span>}
                    {eq.model && <span>Modelo: {eq.model}</span>}
                    {eq.serial_number && <span>Nº Série: {eq.serial_number}</span>}
                  </div>
                  {eq.defects && <p className="text-xs text-muted-foreground"><strong>Defeitos:</strong> {eq.defects}</p>}
                  {eq.solution && <p className="text-xs text-muted-foreground"><strong>Solução:</strong> {eq.solution}</p>}
                  {eq.technical_report && <p className="text-xs text-muted-foreground"><strong>Laudo:</strong> {eq.technical_report}</p>}
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Description */}
        {service.description && (
          <SectionCard icon={FileText} title="Descrição">
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{service.description}</p>
          </SectionCard>
        )}

        {/* Notes */}
        {service.notes && (
          <Card className="border-amber-200/60 dark:border-amber-800/40 bg-amber-50/50 dark:bg-amber-950/20">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                </div>
                <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300">Observações</h3>
              </div>
              <p className="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">{service.notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Internal Notes - only visible to team */}
        {(service as any).internal_notes && (
          <Card className="border-blue-200/60 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4 md:p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                  <EyeOff className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300">Observações Internas</h3>
                <span className="text-[10px] font-medium text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">Somente equipe</span>
              </div>
              <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{(service as any).internal_notes}</p>
            </CardContent>
          </Card>
        )}

        {/* Address */}
        {address && (
          <SectionCard icon={MapPin} title="Endereço">
            <div className="space-y-1">
              <p className="text-sm text-foreground">{address.parts}</p>
              {address.location && <p className="text-xs text-muted-foreground">{address.location}</p>}
              {address.zipCode && <p className="text-xs text-muted-foreground">CEP: {address.zipCode}</p>}
            </div>
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openInMaps}>
              <Map className="h-3.5 w-3.5" /> Abrir no Mapa <ExternalLink className="h-3 w-3" />
            </Button>
          </SectionCard>
        )}

        {/* Photos */}
        {servicePhotos.length > 0 && (
          <SectionCard icon={FileText} title={`Fotos (${servicePhotos.length})`}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {servicePhotos.map((photo: any) => (
                <a key={photo.id} href={photo.photo_url} target="_blank" rel="noopener noreferrer" className="block">
                  <img
                    src={photo.photo_url}
                    alt={photo.description || "Foto do serviço"}
                    className="rounded-lg border border-border object-cover aspect-square w-full hover:opacity-80 transition-opacity"
                  />
                </a>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Signature */}
        {service.status === "completed" && organization?.require_client_signature && (
          <SectionCard icon={PenLine} title="Assinatura do Cliente">
            {signature?.signature_url ? (
              <div className="space-y-2">
                <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-700">
                  <CheckCircle className="h-3 w-3 mr-1" /> Assinatura coletada
                </Badge>
                <div className="rounded-lg border border-border bg-background p-2 flex items-center justify-center">
                  <img src={signature.signature_url} alt="Assinatura" className="max-h-20 max-w-full object-contain" />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Badge variant="outline" className="text-amber-700 border-amber-300 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30 dark:border-amber-700">
                  <Clock className="h-3 w-3 mr-1" /> Assinatura pendente
                </Badge>
                <Button variant="outline" size="sm" className="w-full" onClick={handleSendSignatureLink} disabled={isCreatingLink}>
                  {isCreatingLink ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Share2 className="h-4 w-4 mr-1" />}
                  Enviar link para assinatura
                </Button>
              </div>
            )}
          </SectionCard>
        )}

        {/* Linked Laudos */}
        {laudoCount > 0 && (
          <div id="laudos-vinculados-section">
            <SectionCard icon={ClipboardCheck} title={`Laudos Técnicos Vinculados (${laudoCount})`}>
              <div className="space-y-2">
                {laudos.map((laudo) => {
                  const techName = laudo.technician_profile?.full_name || laudo.responsible_technician_name;
                  const statusLabel = REPORT_STATUS_LABELS[laudo.status] || laudo.status;
                  const statusClass = laudo.status === "finalized"
                    ? "bg-green-500/10 text-green-600 border-green-200"
                    : "bg-amber-500/10 text-amber-600 border-amber-200";
                  return (
                    <div
                      key={laudo.id}
                      className="rounded-lg border border-border/40 bg-muted/20 p-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => navigate(`/laudos/${laudo.id}`)}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            Laudo #{laudo.report_number.toString().padStart(4, "0")}
                          </span>
                          <Badge className={cn("text-[10px] border", statusClass)}>{statusLabel}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground mt-0.5">
                          <span>{formatDateInTz(laudo.report_date, tz)}</span>
                          {techName && <span>• {techName}</span>}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/laudos/${laudo.id}`)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/laudos/editar/${laudo.id}`)}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 w-full gap-1.5"
                onClick={() => {
                  if (laudoCount > 0) setShowLaudoWarning(true);
                  else navigate(`/laudos/novo?service_id=${service.id}`);
                }}
              >
                <FileText className="h-3.5 w-3.5" /> Criar Novo Laudo
              </Button>
            </SectionCard>
          </div>
        )}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 pb-6">
          <Button variant="outline" className="gap-1.5" onClick={() => navigate(`/ordens-servico/editar/${service.id}`)}>
            <Edit className="h-4 w-4" /> Editar
          </Button>
          {service.client?.phone && (
            <Button variant="outline" className="gap-1.5" asChild>
              <a href={`tel:${service.client.phone}`}>
                <Phone className="h-4 w-4" /> Ligar
              </a>
            </Button>
          )}
          <Button
            variant="outline"
            className="gap-1.5"
            onClick={() => setShowWhatsappConfirm(true)}
            disabled={sendingPDF}
          >
            {sendingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar via WhatsApp
          </Button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir ordem de serviço</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a OS #{service.quote_number?.toString().padStart(4, "0")}? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleDelete}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Complete dialog */}
      <ServiceCompleteDialog
        open={showCompleteDialog}
        onOpenChange={setShowCompleteDialog}
        serviceValue={service.value ?? 0}
        onConfirm={handleCompleteWithPayments}
      />

      <AlertDialog open={showWhatsappConfirm} onOpenChange={setShowWhatsappConfirm}>
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
              sendOSViaWhatsApp(service.id, service.client?.phone || undefined);
              setShowWhatsappConfirm(false);
            }}>
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Laudo duplicate warning */}
      <AlertDialog open={showLaudoWarning} onOpenChange={setShowLaudoWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Laudo já existente</AlertDialogTitle>
            <AlertDialogDescription>
              Esta Ordem de Serviço já possui {laudoCount} laudo{laudoCount !== 1 ? "s" : ""} técnico{laudoCount !== 1 ? "s" : ""}.
              Deseja criar um novo laudo mesmo assim?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setShowLaudoWarning(false);
              navigate(`/laudos/novo?service_id=${service.id}`);
            }}>
              Criar novo laudo
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
