import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatPaymentMethod } from "@/lib/formatPaymentMethod";
import {
  ClipboardList,
  Download,
  MessageCircle,
  User,
  Wrench,
  Calendar,
  DollarSign,
  MapPin,
  FileText,
  CreditCard,
  Building2,
  Phone,
  Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useServiceItems } from "@/hooks/useServiceItems";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { generateServiceOrderPDF } from "@/lib/generateServiceOrderPDF";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useServiceSignatures } from "@/hooks/useServiceSignatures";
import type { Service } from "@/hooks/useServices";
import { SERVICE_STATUS_LABELS } from "@/hooks/useServices";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatDateInTz, formatTimeInTz, formatDateTimeInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useDocumentGuard } from "@/hooks/useDocumentGuard";
import { CompanyDataCompletionModal } from "@/components/onboarding/CompanyDataCompletionModal";

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
  in_progress: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
  cancelled: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
};


interface ServiceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: Service;
}

interface Organization {
  name: string;
  cnpj_cpf: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  website: string | null;
  zip_code: string | null;
  signature_url: string | null;
  auto_signature_os: boolean | null;
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-primary/10">
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

// SectionDivider removed — sections now use card containers for separation

export function ServiceOrderDialog({ open, onOpenChange, service }: ServiceOrderDialogProps) {
  const { profile } = useAuth();
  const tz = useOrgTimezone();
  const { isFreePlan } = useSubscription();
  const { items, total } = useServiceItems(service.id);
  const [isSaving, setIsSaving] = useState(false);
  const { guardAction, modalOpen: companyModalOpen, closeModal: closeCompanyModal, onDataSaved: onCompanyDataSaved } = useDocumentGuard();

  // Fetch equipment directly with useQuery to ensure it loads when dialog opens
  const { data: equipmentList = [] } = useQuery({
    queryKey: ["service-equipment-os", service.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("service_equipment")
        .select("*")
        .eq("service_id", service.id)
        .order("created_at");
      return (data || []).map((e: any) => ({
        id: e.id,
        name: e.name || "",
        brand: e.brand || "",
        model: e.model || "",
        serial_number: e.serial_number || "",
        conditions: e.conditions || "",
        defects: e.defects || "",
        solution: e.solution || "",
        technical_report: e.technical_report || "",
        warranty_terms: e.warranty_terms || "",
      }));
    },
    enabled: open,
  });

  // Fetch organization data
  const { data: org } = useQuery({
    queryKey: ["org-details-os", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;
      const { data } = await supabase
        .from("organizations")
        .select("name, cnpj_cpf, phone, email, address, city, state, logo_url, website, zip_code, signature_url, auto_signature_os")
        .eq("id", profile.organization_id)
        .single();
      return data as Organization | null;
    },
    enabled: !!profile?.organization_id && open,
  });

  // Fetch assigned technician name
  const { data: assignedProfile } = useQuery({
    queryKey: ["profile-name-os", service.assigned_to],
    queryFn: async () => {
      if (!service.assigned_to) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", service.assigned_to)
        .single();
      return data;
    },
    enabled: !!service.assigned_to && open,
  });

  const handleDownload = async () => {
    setIsSaving(true);
    try {
      const orderData = {
        entryDate: service.entry_date ? formatDateInTz(service.entry_date, tz) : "",
        entryTime: service.entry_date ? formatTimeInTz(service.entry_date, tz) : "",
        exitDate: service.exit_date ? formatDateInTz(service.exit_date, tz) : "",
        exitTime: service.exit_date ? formatTimeInTz(service.exit_date, tz) : "",
        equipmentType: service.equipment_type || "",
        equipmentBrand: service.equipment_brand || "",
        equipmentModel: service.equipment_model || "",
        solution: service.solution || service.description || "",
        paymentMethod: service.payment_method
          ? formatPaymentMethod(service.payment_method)
          : "",
        paymentDueDate: service.payment_due_date
          ? formatDateInTz(service.payment_due_date, tz)
          : "",
        paymentNotes: service.payment_notes || "",
      };

      await generateServiceOrderPDF({
        service: { ...service, value: total > 0 ? total : service.value },
        items,
        equipmentList,
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
        orderData,
        isFreePlan,
      });

      toast({ title: "Ordem de Serviço gerada!", description: "O PDF foi baixado com sucesso" });
    } catch (error) {
      toast({ variant: "destructive", title: "Erro ao gerar ordem de serviço", description: (error as Error).message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleWhatsApp = async () => {
    await handleDownload();
    const finalTotal = total > 0 ? total : (service.value || 0);
    const formattedValue = formatCurrency(finalTotal);
    const message = `*Ordem de Serviço #${service.quote_number?.toString().padStart(4, "0")}*\nCliente: ${service.client?.name || ""}\nData: ${format(new Date(), "dd/MM/yyyy", { locale: ptBR })}${finalTotal > 0 ? `\nValor: ${formattedValue}` : ""}\n\n_PDF anexado_`;
    const phoneNumber = service.client?.phone?.replace(/\D/g, "") || "";
    window.open(`https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const finalTotal = total > 0 ? total : (service.value || 0);
  const hasEquipment = equipmentList.length > 0 || service.equipment_type || service.equipment_brand || service.equipment_model;

  const hasServiceAddress = service.service_street || service.service_city;
  const getFormattedAddress = () => {
    if (hasServiceAddress) {
      const line1 = [service.service_street, service.service_number, service.service_complement].filter(Boolean).join(", ");
      const line2 = [service.service_neighborhood, service.service_city, service.service_state].filter(Boolean).join(" - ");
      return { line1, line2, zipCode: service.service_zip_code };
    }
    if (service.client?.address) {
      return { line1: service.client.address, line2: null, zipCode: null };
    }
    return null;
  };
  const address = getFormattedAddress();

  const hasPaymentInfo = service.payment_method || service.payment_due_date || service.payment_notes;
  const hasScheduleInfo = service.scheduled_date || service.entry_date || service.exit_date;

  const calculateItemSubtotal = (item: { quantity: number; unit_price: number; discount: number | null; discount_type: string | null }) => {
    const gross = item.quantity * item.unit_price;
    if (!item.discount) return gross;
    if (item.discount_type === "percentage") return gross - (gross * item.discount / 100);
    return gross - item.discount;
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto p-0">
        {/* Company Header */}
        <div className="bg-muted/30 border-b border-border/40 px-6 pt-6 pb-4">
          <div className="flex items-start gap-3.5">
            {org?.logo_url ? (
              <img
                src={org.logo_url}
                alt={org.name}
                className="h-12 w-12 rounded-xl object-contain bg-background border border-border/40 p-0.5 shadow-sm"
              />
            ) : (
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 shadow-sm">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-semibold text-foreground truncate tracking-tight">
                {org?.name || "Minha Empresa"}
              </h2>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                {org?.cnpj_cpf && (
                  <span className="text-[11px] text-muted-foreground">{org.cnpj_cpf}</span>
                )}
                {org?.phone && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                    <Phone className="h-2.5 w-2.5" />
                    {org.phone}
                  </span>
                )}
                {org?.email && (
                  <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                    <Mail className="h-2.5 w-2.5" />
                    {org.email}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 mt-3.5 pt-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-primary" />
                <span className="text-lg font-bold text-foreground tracking-tight">
                  OS #{service.quote_number?.toString().padStart(4, "0")}
                </span>
              </div>
              <Badge className={`${STATUS_COLORS[service.status]} text-xs font-medium border`}>
                {SERVICE_STATUS_LABELS[service.status]}
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground mt-1 block">
              Criada em {format(new Date(service.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
          </div>
        </div>

        {/* Content body */}
        <div className="px-6 py-4 space-y-3">
          {/* Client */}
          <div className="rounded-xl bg-muted/20 p-4">
            <SectionHeader icon={User} title="Cliente" />
            <div className="pl-8 space-y-0.5">
              <p className="text-sm font-medium text-foreground">{service.client?.name}</p>
              {service.client?.phone && (
                <p className="text-xs text-muted-foreground">{service.client.phone}</p>
              )}
              {service.client?.email && (
                <p className="text-xs text-muted-foreground">{service.client.email}</p>
              )}
            </div>
          </div>

          {/* Address */}
          {address && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={MapPin} title="Endereço do Serviço" />
              <div className="pl-8 space-y-0.5">
                {address.line1 && <p className="text-sm text-foreground">{address.line1}</p>}
                {address.line2 && <p className="text-xs text-muted-foreground">{address.line2}</p>}
                {address.zipCode && <p className="text-xs text-muted-foreground">CEP: {address.zipCode}</p>}
              </div>
            </div>
          )}

          {/* Schedule */}
          {hasScheduleInfo && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={Calendar} title="Agendamento" />
              <div className="pl-8">
                {service.scheduled_date && (
                  <InfoRow label="Data agendada" value={formatDateTimeInTz(service.scheduled_date, tz)} />
                )}
                {service.entry_date && (
                  <InfoRow label="Entrada" value={`${formatDateInTz(service.entry_date, tz)} às ${formatTimeInTz(service.entry_date, tz)}`} />
                )}
                {service.exit_date && (
                  <InfoRow label="Saída" value={`${formatDateInTz(service.exit_date, tz)} às ${formatTimeInTz(service.exit_date, tz)}`} />
                )}
              </div>
            </div>
          )}

          {/* Technician */}
          {service.assigned_to && assignedProfile?.full_name && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={Wrench} title="Técnico Responsável" />
              <p className="pl-8 text-sm text-foreground">{assignedProfile.full_name}</p>
            </div>
          )}

          {/* Equipment */}
          {hasEquipment && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={Wrench} title={`Equipamentos${equipmentList.length > 0 ? ` (${equipmentList.length})` : ''}`} />
              <div className="pl-8 space-y-3">
                {equipmentList.length > 0 ? (
                  equipmentList.map((eq, idx) => (
                    <div key={eq.id} className="rounded-lg border border-border/40 bg-background/60 p-3 space-y-1">
                      <p className="text-sm font-medium text-foreground">
                        {eq.name || `Equipamento ${idx + 1}`}
                      </p>
                      <div className="space-y-0.5">
                        {eq.brand && <InfoRow label="Marca" value={eq.brand} />}
                        {eq.model && <InfoRow label="Modelo" value={eq.model} />}
                        {eq.serial_number && <InfoRow label="Nº Série" value={eq.serial_number} />}
                        {eq.conditions && <InfoRow label="Condições" value={eq.conditions} />}
                        {eq.defects && <InfoRow label="Defeitos" value={eq.defects} />}
                        {eq.solution && <InfoRow label="Solução" value={eq.solution} />}
                        {eq.technical_report && <InfoRow label="Laudo" value={eq.technical_report} />}
                        {eq.warranty_terms && <InfoRow label="Garantia" value={eq.warranty_terms} />}
                      </div>
                    </div>
                  ))
                ) : (
                  <>
                    <InfoRow label="Tipo" value={service.equipment_type} />
                    <InfoRow label="Marca" value={service.equipment_brand} />
                    <InfoRow label="Modelo" value={service.equipment_model} />
                  </>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {(service.solution || service.description) && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={FileText} title="Descrição do Serviço" />
              <p className="pl-8 text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {service.solution || service.description}
              </p>
            </div>
          )}

          {/* Service Items */}
          {items.length > 0 && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={ClipboardList} title={`Itens (${items.length})`} />
              <div className="pl-8 space-y-2">
                {items.map((item) => {
                  const subtotal = calculateItemSubtotal(item);
                  const hasDiscount = item.discount && item.discount > 0;
                  return (
                    <div key={item.id} className="rounded-lg border border-border/40 bg-background/60 p-3">
                      <p className="text-sm font-medium text-foreground">{item.description}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                        <span>
                          {item.quantity} un × {formatCurrency(item.unit_price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-destructive">
                            - {item.discount_type === "percentage" ? `${item.discount}%` : formatCurrency(item.discount!)}
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
            </div>
          )}

          {/* Total */}
          {finalTotal > 0 && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-sm font-semibold text-foreground">Valor Total</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(finalTotal)}
              </span>
            </div>
          )}

          {/* Payment Info */}
          {hasPaymentInfo && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={CreditCard} title="Pagamento" />
              <div className="pl-8">
                <InfoRow
                  label="Forma"
                  value={service.payment_method ? formatPaymentMethod(service.payment_method) : null}
                />
                <InfoRow
                  label="Vencimento"
                  value={service.payment_due_date ? formatDateInTz(service.payment_due_date, tz) : null}
                />
                {service.payment_notes && (
                  <p className="text-xs text-muted-foreground mt-1">{service.payment_notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Notes */}
          {service.notes && (
            <div className="rounded-xl bg-muted/20 p-4">
              <SectionHeader icon={FileText} title="Observações" />
              <div className="pl-8 rounded-lg border border-amber-200/60 bg-amber-50/40 dark:border-amber-800/40 dark:bg-amber-950/20 p-3">
                <p className="text-sm text-amber-800 dark:text-amber-200 whitespace-pre-wrap">
                  {service.notes}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="rounded-xl bg-muted/10 p-3 flex gap-3">
            <Button
              onClick={() => guardAction(handleDownload)}
              disabled={isSaving}
              className="flex-1 gap-2 rounded-xl shadow-sm"
            >
              <Download className="h-4 w-4" />
              {isSaving ? "Gerando..." : "Baixar PDF"}
            </Button>
            <Button
              variant="outline"
              onClick={() => guardAction(handleWhatsApp)}
              disabled={isSaving}
              className="flex-1 gap-2 rounded-xl shadow-sm"
            >
              <MessageCircle className="h-4 w-4" />
              WhatsApp
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <CompanyDataCompletionModal
      open={companyModalOpen}
      onClose={closeCompanyModal}
      onSaved={onCompanyDataSaved}
    />
    </>
  );
}
