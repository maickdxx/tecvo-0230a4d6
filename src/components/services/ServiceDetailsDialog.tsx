import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useServicePDFSend } from "@/hooks/useServicePDFSend";
import { useQuery } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  User, 
  Phone, 
  Calendar, 
  DollarSign, 
  FileText, 
  MapPin,
  Map,
  ExternalLink,
  CheckCircle,
  Loader2,
  AlertTriangle,
  Package,
  Wrench,
  Maximize2,
  Minimize2,
  Mail,
  Clock,
  PenLine,
  Link2,
  Share2,
  Send,
  Download,
} from "lucide-react";
import { formatDateTimeInTz, formatDateInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { supabase } from "@/integrations/supabase/client";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useServiceSignatures } from "@/hooks/useServiceSignatures";
import { useOrganization } from "@/hooks/useOrganization";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import type { Service, ServiceStatus } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { ServiceCompleteDialog } from "./ServiceCompleteDialog";
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
import type { ServicePaymentInput } from "@/hooks/useServicePayments";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { generateReceiptPDF } from "@/lib/generateReceiptPDF";
import { toast as sonnerToast } from "sonner";

interface ServiceDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service | null;
  onStatusChange?: (serviceId: string, status: ServiceStatus, paymentMethod?: string, payments?: ServicePaymentInput[], signatureBlob?: Blob | null) => Promise<void>;
  onEdit?: () => void;
}

interface ServiceItem {
  id: string;
  name?: string;
  description: string;
  quantity: number;
  unit_price: number;
  discount: number | null;
  discount_type: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: string }> = {
  scheduled: { 
    label: "Agendado", 
    className: "bg-blue-500/10 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-700",
    icon: "📅"
  },
  in_progress: { 
    label: "Em Andamento", 
    className: "bg-amber-500/10 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-700",
    icon: "⚡"
  },
  completed: { 
    label: "Concluído", 
    className: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/50 dark:text-emerald-200 dark:border-emerald-700",
    icon: "✅"
  },
  cancelled: { 
    label: "Cancelado", 
    className: "bg-destructive/10 text-destructive border-destructive/20",
    icon: "❌"
  },
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);

const calculateItemSubtotal = (item: ServiceItem) => {
  const gross = item.quantity * item.unit_price;
  if (!item.discount) return gross;
  
  if (item.discount_type === "percentage") {
    return gross - (gross * item.discount / 100);
  }
  return gross - item.discount;
};

const formatDiscount = (item: ServiceItem) => {
  if (!item.discount) return null;
  
  if (item.discount_type === "percentage") {
    return `${item.discount}%`;
  }
  return formatCurrency(item.discount);
};

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-primary/10">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between items-baseline gap-4 py-1">
      <span className="text-xs font-medium text-muted-foreground shrink-0">{label}</span>
      <span className="text-sm text-foreground text-right">{value}</span>
    </div>
  );
}

export function ServiceDetailsDialog({
  open,
  onOpenChange,
  service,
  onStatusChange,
  onEdit,
}: ServiceDetailsDialogProps) {
  const orgTz = useOrgTimezone();
  const navigate = useNavigate();
  const [isUpdating, setIsUpdating] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [showWhatsappConfirm, setShowWhatsappConfirm] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState(false);
  const { sendOSViaWhatsApp, sending: sendingPDF } = useServicePDFSend();
  const { typeLabels } = useServiceTypes();
  const { user } = useAuth();
  const { isEmployee } = useUserRole();
  const { paymentMethods, isLoading: isLoadingPaymentMethods, formatFee } = usePaymentMethods();
  const { signature, createSignatureLink, isCreatingLink } = useServiceSignatures(service?.id);
  const { organization } = useOrganization();

  // Fetch payments for completed services (for receipt)
  const { data: servicePayments = [] } = useQuery({
    queryKey: ["service-payments-receipt", service?.id],
    queryFn: async () => {
      if (!service?.id) return [];
      const { data } = await supabase
        .from("service_payments")
        .select("*")
        .eq("service_id", service.id);
      return data || [];
    },
    enabled: !!service?.id && service?.status === "completed" && open,
  });

  const handleDownloadReceipt = useCallback(async () => {
    if (!service || !organization) return;
    setDownloadingReceipt(true);
    try {
      const payments = servicePayments.map((sp: any) => {
        const method = paymentMethods.find(m => m.slug === sp.payment_method);
        return { method: method?.name || sp.payment_method, amount: sp.amount };
      });

      // Fallback if no split payments
      if (payments.length === 0 && service.value) {
        payments.push({ method: service.payment_method || "Não informado", amount: service.value });
      }

      const blob = await generateReceiptPDF({
        organizationName: organization.name || "Empresa",
        organizationCnpj: organization.cnpj_cpf || undefined,
        organizationPhone: organization.phone || undefined,
        organizationEmail: organization.email || undefined,
        organizationAddress: organization.address || undefined,
        organizationLogo: organization.logo_url || undefined,
        clientName: service.client?.name || "Cliente",
        quoteNumber: service.quote_number,
        serviceDescription: service.description || undefined,
        serviceValue: service.value || 0,
        payments,
        completedDate: service.completed_date || undefined,
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Recibo-OS-${String(service.quote_number || "0000").padStart(4, "0")}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      sonnerToast.success("Recibo baixado com sucesso!");
    } catch (err) {
      console.error("Receipt PDF error:", err);
      sonnerToast.error("Erro ao gerar recibo PDF.");
    } finally {
      setDownloadingReceipt(false);
    }
  }, [service, organization, servicePayments, paymentMethods]);

  const { data: serviceItems = [] } = useQuery({
    queryKey: ["service-items-dialog", service?.id],
    queryFn: async () => {
      if (!service?.id) return [];
      const { data, error } = await supabase
        .from("service_items")
        .select("*")
        .eq("service_id", service.id)
        .order("created_at");
      if (error) throw error;
      return data as ServiceItem[];
    },
    enabled: !!service?.id && open,
  });

  const { data: assignedProfile } = useQuery({
    queryKey: ["profile-name", service?.assigned_to],
    queryFn: async () => {
      if (!service?.assigned_to) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", service.assigned_to)
        .single();
      return data;
    },
    enabled: !!service?.assigned_to && open,
  });

  if (!service) return null;

  // Block employee access to services not assigned to them
  const isAccessDenied = isEmployee && service.assigned_to !== user?.id;

  if (isAccessDenied) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="sm:max-w-md p-0">
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <AlertTriangle className="h-12 w-12 text-destructive" />
            <h2 className="text-lg font-semibold text-foreground">Acesso Negado</h2>
            <p className="text-sm text-muted-foreground">
              Você não tem permissão para visualizar este serviço.
            </p>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const canMarkAsCompleted = 
    onStatusChange && 
    service.status !== "completed" && 
    service.status !== "cancelled";

  const handleOpenCompleteDialog = () => {
    if (!service.value) {
      handleCompleteWithPayments([]);
      return;
    }
    setShowCompleteDialog(true);
  };

  const handleCompleteWithPayments = async (payments: ServicePaymentInput[], signatureBlob?: Blob | null) => {
    if (!service || !onStatusChange) return;
    setIsUpdating(true);
    try {
      const mainMethod = payments[0]?.payment_method;
      await onStatusChange(service.id, "completed", mainMethod, payments, signatureBlob);
      setShowCompleteDialog(false);
      onOpenChange(false);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendSignatureLink = async () => {
    if (!service) return;
    try {
      let sig = signature;
      if (!sig) {
        sig = await createSignatureLink(service.id);
      }
      const url = `${window.location.origin}/assinar/${sig.token}`;
      if (navigator.share) {
        await navigator.share({ title: `Assinar OS #${service.quote_number}`, url });
      } else {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copiado!", description: "Cole e envie para o cliente" });
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast({ variant: "destructive", title: "Erro", description: err.message });
      }
    }
  };

  const hasServiceAddress = service.service_street || service.service_city;
  
  const getAddress = () => {
    if (hasServiceAddress) {
      const parts = [
        service.service_street,
        service.service_number,
        service.service_complement,
      ].filter(Boolean).join(", ");
      
      const location = [
        service.service_neighborhood,
        service.service_city,
        service.service_state,
      ].filter(Boolean).join(" - ");
      
      const zipCode = service.service_zip_code;
      
      return { parts, location, zipCode };
    }
    
    if (service.client?.address) {
      return { 
        parts: service.client.address, 
        location: null, 
        zipCode: null 
      };
    }
    
    return null;
  };

  const address = getAddress();

  const openInMaps = () => {
    let query = "";
    if (hasServiceAddress) {
      const parts = [
        service.service_street,
        service.service_number,
        service.service_neighborhood,
        service.service_city,
        service.service_state,
      ].filter(Boolean);
      query = parts.join(", ");
    } else if (service.client?.address) {
      query = service.client.address;
    }
    
    if (query) {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, '_blank');
    }
  };

  const statusConfig = STATUS_CONFIG[service.status] || STATUS_CONFIG.scheduled;

  const itemsTotal = serviceItems.reduce((sum, item) => sum + calculateItemSubtotal(item), 0);

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent 
          side="right" 
          className={cn(
            "overflow-y-auto transition-all duration-200 p-0",
            expanded ? "sm:max-w-2xl" : "sm:max-w-md"
          )}
        >
          {/* Premium Header */}
          <div className="bg-muted/30 border-b border-border/40 px-5 pt-5 pb-4">
            <div className="flex items-center justify-between mb-3">
              <SheetHeader className="text-left p-0">
                <SheetTitle className="text-base font-semibold tracking-tight">Detalhes do Serviço</SheetTitle>
              </SheetHeader>
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setExpanded(!expanded)}
                  className="hidden sm:flex h-8 w-8"
                  title={expanded ? "Reduzir" : "Expandir"}
                >
                  {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>

            {/* Client + Status */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground truncate">
                  {service.client?.name || "Cliente não encontrado"}
                </p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {service.client?.phone && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {service.client.phone}
                    </span>
                  )}
                  {service.client?.email && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {service.client.email}
                    </span>
                  )}
                </div>
              </div>
              <Badge className={cn("text-xs font-medium border shrink-0", statusConfig.className)}>
                {statusConfig.label}
              </Badge>
            </div>
          </div>
          
          {/* Content */}
          <div className="px-5 py-4 space-y-3">
            {/* Date & Technician & Value */}
            <div className="rounded-xl bg-muted/20 p-4">
              {service.service_type && (
                <InfoRow label="Tipo de Serviço" value={typeLabels[service.service_type] || service.service_type} />
              )}
              {(service.scheduled_date || service.entry_date) && (
                <InfoRow
                  label="Data Agendada"
                  value={
                    service.entry_date
                      ? formatDateTimeInTz(service.entry_date, orgTz)
                      : formatDateInTz(service.scheduled_date!, orgTz)
                  }
                />
              )}
              {service.assigned_to && assignedProfile?.full_name && (
                <InfoRow label="Técnico Responsável" value={assignedProfile.full_name} />
              )}
              {service.value != null && (
                <div className="flex justify-between items-baseline gap-4 py-1">
                  <span className="text-xs font-medium text-muted-foreground shrink-0">Valor Total</span>
                  <span className="text-base font-bold text-primary">{formatCurrency(service.value)}</span>
                </div>
              )}
            </div>

            {/* Service Items */}
            {serviceItems.length > 0 && (
              <div className="rounded-xl bg-muted/20 p-4">
                <SectionHeader icon={Package} title={`Serviços (${serviceItems.length})`} />
                <div className="space-y-2">
                  {serviceItems.map((item) => {
                    const subtotal = calculateItemSubtotal(item);
                    const discount = formatDiscount(item);
                    
                    return (
                      <div key={item.id} className="rounded-lg border border-border/40 bg-background/60 p-3">
                        <p className="text-sm font-medium text-foreground">{item.name || item.description}</p>
                        {item.name && item.description && item.name !== item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 italic">{item.description}</p>
                        )}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                          <span>
                            {item.quantity} un × {formatCurrency(item.unit_price)}
                          </span>
                          {discount && (
                            <span className="text-destructive">
                              - {discount}
                            </span>
                          )}
                          <span className="font-semibold text-foreground ml-auto">
                            {formatCurrency(subtotal)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Items Total */}
                {serviceItems.length > 1 && (
                  <div className="mt-3 pt-3 border-t border-border/40 flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Total dos Itens</span>
                    <span className="text-sm font-bold text-primary">{formatCurrency(itemsTotal)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {service.description && (
              <div className="rounded-xl bg-muted/20 p-4">
                <SectionHeader icon={FileText} title="Descrição" />
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {service.description}
                </p>
              </div>
            )}

            {/* Notes */}
            {service.notes && (
              <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-800/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-300 tracking-tight">Observações</h3>
                </div>
                <p className="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                  {service.notes}
                </p>
              </div>
            )}

            {/* Internal Notes */}
            {service.internal_notes && (
              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/60 dark:border-blue-800/40 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-blue-100 dark:bg-blue-900/40">
                    <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 tracking-tight">Observações Internas</h3>
                  <span className="text-[10px] font-medium text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded">Somente equipe</span>
                </div>
                <p className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                  {service.internal_notes}
                </p>
              </div>
            )}

            {/* Address */}
            {address && (
              <div className="rounded-xl bg-muted/20 p-4">
                <SectionHeader icon={MapPin} title="Endereço" />
                <div className="space-y-0.5">
                  <p className="text-sm text-foreground">{address.parts}</p>
                  {address.location && <p className="text-xs text-muted-foreground">{address.location}</p>}
                  {address.zipCode && <p className="text-xs text-muted-foreground">CEP: {address.zipCode}</p>}
                </div>
              </div>
            )}

            {/* Client Signature Status */}
            {service.status === "completed" && organization?.require_client_signature && (
              <div className="rounded-xl bg-muted/20 p-4">
                <SectionHeader icon={PenLine} title="Assinatura do Cliente" />
                {signature?.signature_url ? (
                  <div className="space-y-2">
                    <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-700">
                      <CheckCircle className="h-3 w-3 mr-1" /> Assinatura coletada
                    </Badge>
                    <div className="rounded-lg border border-border bg-white p-2 flex items-center justify-center">
                      <img src={signature.signature_url} alt="Assinatura do cliente" className="max-h-16 max-w-full object-contain" />
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
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-1">
              {/* Execution mode - primary action for in_progress services */}
              {(service.status === "in_progress" || service.status === "scheduled") && (
                <Button 
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/executar-servico/${service.id}`);
                  }}
                  variant={service.status === "in_progress" ? "default" : "outline"}
                  className="w-full rounded-xl shadow-sm"
                >
                  <Wrench className="h-4 w-4 mr-2" />
                  {service.status === "in_progress" ? "Continuar Execução" : "Iniciar Execução"}
                </Button>
              )}
              {onEdit && (
                <Button 
                  variant="outline"
                  onClick={onEdit}
                  className="w-full rounded-xl shadow-sm"
                >
                  <PenLine className="h-4 w-4 mr-2" />
                  Editar Serviço
                </Button>
              )}
              {canMarkAsCompleted && (
                <Button 
                  onClick={handleOpenCompleteDialog}
                  className="w-full rounded-xl shadow-sm"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Marcar como Concluído
                </Button>
              )}
              
              {service.document_type === "service_order" && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl shadow-sm"
                  onClick={() => setShowWhatsappConfirm(true)}
                  disabled={sendingPDF}
                >
                  {sendingPDF ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Enviar OS via WhatsApp
                </Button>
              )}

              {service.status === "completed" && (
                <Button
                  variant="outline"
                  className="w-full rounded-xl shadow-sm"
                  onClick={handleDownloadReceipt}
                  disabled={downloadingReceipt}
                >
                  {downloadingReceipt ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Baixar Recibo PDF
                </Button>
              )}
              
              <div className="flex gap-2">
                {address && (
                  <Button 
                    variant="outline" 
                    className="flex-1 rounded-xl"
                    onClick={openInMaps}
                  >
                    <Map className="h-4 w-4 mr-2" />
                    Abrir Mapa
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </Button>
                )}
                {service.client?.phone && (
                  <Button asChild variant="outline" className="flex-1 rounded-xl">
                    <a href={`tel:${service.client.phone}`}>
                      <Phone className="h-4 w-4 mr-2" />
                      Ligar
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Complete Service Dialog */}
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
    </>
  );
}