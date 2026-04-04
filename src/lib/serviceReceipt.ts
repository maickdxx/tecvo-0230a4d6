import { supabase } from "@/integrations/supabase/client";
import { generateReceiptPDF } from "@/lib/generateReceiptPDF";

export interface ReceiptPaymentSnapshot {
  method: string;
  amount: number;
}

export interface ServiceReceiptRecord {
  id: string;
  organization_id: string;
  service_id: string;
  client_name: string;
  client_phone: string | null;
  quote_number: string | null;
  service_description: string | null;
  service_value: number;
  payments_snapshot: ReceiptPaymentSnapshot[];
  message: string;
  sent_via: string | null;
  sent_at: string | null;
  status: string;
}

export interface ReceiptOrganizationData {
  id?: string | null;
  name?: string | null;
  cnpj_cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  logo_url?: string | null;
}

export interface ReceiptServiceData {
  id: string;
  organization_id?: string | null;
  client_name: string;
  client_phone?: string | null;
  quote_number?: string | number | null;
  description?: string | null;
  value?: number | null;
  payment_method?: string | null;
  completed_date?: string | null;
}

interface ReceiptServicePaymentRow {
  payment_method: string | null;
  amount: number | null;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export function buildReceiptMessage(
  organizationName: string,
  clientName: string,
  quoteNumber: string | number | null | undefined,
  serviceDescription: string | null | undefined,
  serviceValue: number,
  payments: ReceiptPaymentSnapshot[],
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  let message = `📄 *RECIBO DE PAGAMENTO*\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  message += `*${organizationName}*\n`;
  message += `Data: ${dateStr} às ${timeStr}\n\n`;

  if (quoteNumber) {
    message += `📋 OS: *#${String(quoteNumber)}*\n`;
  }

  message += `👤 Cliente: *${clientName}*\n`;

  if (serviceDescription) {
    message += `🔧 Serviço: ${serviceDescription}\n`;
  }

  message += `\n`;
  message += `💰 *Valor Total: ${formatCurrency(serviceValue)}*\n\n`;

  if (payments.length > 0) {
    message += `💳 *Forma(s) de Pagamento:*\n`;
    payments.forEach((payment) => {
      message += `  • ${payment.method}: ${formatCurrency(payment.amount)}\n`;
    });
    message += `\n`;
  }

  message += `━━━━━━━━━━━━━━━━━━━━━\n`;
  message += `✅ Pagamento recebido com sucesso!\n`;
  message += `Obrigado pela confiança. 🙏`;

  return message;
}

export function resolveReceiptPayments(params: {
  servicePayments?: ReceiptServicePaymentRow[];
  existingSnapshot?: unknown;
  paymentMethodNames: Record<string, string>;
  fallbackPaymentMethod?: string | null;
  serviceValue: number;
}): ReceiptPaymentSnapshot[] {
  const paymentsFromService = (params.servicePayments || [])
    .map((payment) => ({
      method:
        params.paymentMethodNames[payment.payment_method || ""] ||
        payment.payment_method ||
        "Não informado",
      amount: Number(payment.amount || 0),
    }))
    .filter((payment) => payment.amount > 0);

  if (paymentsFromService.length > 0) {
    return paymentsFromService;
  }

  const paymentsFromSnapshot = Array.isArray(params.existingSnapshot)
    ? params.existingSnapshot
        .map((payment: any) => ({
          method: String(payment?.method || "Não informado"),
          amount: Number(payment?.amount || 0),
        }))
        .filter((payment) => payment.amount > 0)
    : [];

  if (paymentsFromSnapshot.length > 0) {
    return paymentsFromSnapshot;
  }

  if (params.serviceValue <= 0) {
    return [];
  }

  return [
    {
      method:
        params.paymentMethodNames[params.fallbackPaymentMethod || ""] ||
        params.fallbackPaymentMethod ||
        "Não informado",
      amount: params.serviceValue,
    },
  ];
}

export async function fetchLatestServiceReceipt(serviceId: string, organizationId?: string | null) {
  let query = supabase.from("service_receipts").select("*").eq("service_id", serviceId);

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as ServiceReceiptRecord | null;
}

export async function fetchServicePayments(serviceId: string) {
  const { data, error } = await supabase
    .from("service_payments")
    .select("payment_method, amount")
    .eq("service_id", serviceId);

  if (error) {
    throw error;
  }

  return (data || []) as ReceiptServicePaymentRow[];
}

export async function ensureReceiptDraft(params: {
  organization: ReceiptOrganizationData | null | undefined;
  service: ReceiptServiceData;
  payments: ReceiptPaymentSnapshot[];
  existingReceipt?: ServiceReceiptRecord | null;
}) {
  if (!params.service.organization_id) {
    throw new Error("Organização não encontrada para este serviço.");
  }

  const existingReceipt =
    params.existingReceipt ??
    (await fetchLatestServiceReceipt(params.service.id, params.service.organization_id));

  if (existingReceipt) {
    return { receipt: existingReceipt, created: false };
  }

  const { data, error } = await supabase
    .from("service_receipts")
    .insert({
      organization_id: params.service.organization_id,
      service_id: params.service.id,
      client_name: params.service.client_name,
      client_phone: params.service.client_phone || null,
      quote_number: params.service.quote_number ? String(params.service.quote_number) : null,
      service_description: params.service.description || null,
      service_value: params.service.value || 0,
      payments_snapshot: params.payments,
      message: buildReceiptMessage(
        params.organization?.name || "Empresa",
        params.service.client_name,
        params.service.quote_number,
        params.service.description,
        params.service.value || 0,
        params.payments,
      ),
      sent_via: null,
      sent_at: null,
      status: "draft",
    } as any)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return { receipt: data as ServiceReceiptRecord, created: true };
}

export async function downloadReceiptPdf(params: {
  organization: ReceiptOrganizationData | null | undefined;
  service: ReceiptServiceData;
  payments: ReceiptPaymentSnapshot[];
}) {
  const blob = await generateReceiptPDF({
    organizationName: params.organization?.name || "Empresa",
    organizationCnpj: params.organization?.cnpj_cpf || undefined,
    organizationPhone: params.organization?.phone || undefined,
    organizationEmail: params.organization?.email || undefined,
    organizationAddress: params.organization?.address || undefined,
    organizationLogo: params.organization?.logo_url || undefined,
    clientName: params.service.client_name,
    quoteNumber: params.service.quote_number,
    serviceDescription: params.service.description || undefined,
    serviceValue: params.service.value || 0,
    payments: params.payments,
    completedDate: params.service.completed_date || undefined,
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `Recibo-OS-${String(params.service.quote_number || "0000").padStart(4, "0")}.pdf`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
