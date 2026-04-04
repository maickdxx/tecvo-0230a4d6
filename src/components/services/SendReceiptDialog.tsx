import { useState, useEffect, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, CheckCircle2, Wifi, MessageCircle, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { ServicePaymentInput } from "@/hooks/useServicePayments";

interface SendReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
  clientPhone: string;
  serviceDescription: string;
  quoteNumber: string | null;
  serviceValue: number;
  payments: ServicePaymentInput[];
  paymentMethodNames: Record<string, string>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

function buildReceiptMessage(
  orgName: string,
  clientName: string,
  quoteNumber: string | null,
  serviceDescription: string,
  serviceValue: number,
  payments: ServicePaymentInput[],
  paymentMethodNames: Record<string, string>,
): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("pt-BR");
  const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  let msg = `📄 *RECIBO DE PAGAMENTO*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `*${orgName}*\n`;
  msg += `Data: ${dateStr} às ${timeStr}\n\n`;

  if (quoteNumber) {
    msg += `📋 OS: *#${quoteNumber}*\n`;
  }
  msg += `👤 Cliente: *${clientName}*\n`;
  if (serviceDescription) {
    msg += `🔧 Serviço: ${serviceDescription}\n`;
  }
  msg += `\n`;

  msg += `💰 *Valor Total: ${formatCurrency(serviceValue)}*\n\n`;

  if (payments.length > 0) {
    msg += `💳 *Forma(s) de Pagamento:*\n`;
    payments.forEach((p) => {
      const methodName = paymentMethodNames[p.payment_method] || p.payment_method;
      msg += `  • ${methodName}: ${formatCurrency(p.amount)}\n`;
    });
    msg += `\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `✅ Pagamento recebido com sucesso!\n`;
  msg += `Obrigado pela confiança. 🙏`;

  return msg;
}

export function SendReceiptDialog({
  open,
  onOpenChange,
  clientName,
  clientPhone,
  serviceDescription,
  quoteNumber,
  serviceValue,
  payments,
  paymentMethodNames,
}: SendReceiptDialogProps) {
  const { organizationId } = useAuth();
  const { organization } = useOrganization();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [sentChannel, setSentChannel] = useState("");
  const [editing, setEditing] = useState(false);

  const defaultMessage = useMemo(
    () =>
      buildReceiptMessage(
        organization?.name || "Empresa",
        clientName,
        quoteNumber,
        serviceDescription,
        serviceValue,
        payments,
        paymentMethodNames,
      ),
    [organization?.name, clientName, quoteNumber, serviceDescription, serviceValue, payments, paymentMethodNames],
  );

  const [message, setMessage] = useState(defaultMessage);

  useEffect(() => {
    if (open) {
      setMessage(defaultMessage);
      setSent(false);
      setSentChannel("");
      setEditing(false);
    }
  }, [open, defaultMessage]);

  // Fetch connected channels
  const { data: connectedChannels } = useQuery({
    queryKey: ["connected-channels-receipt", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data } = await supabase
        .from("whatsapp_channels")
        .select("id, name, phone_number")
        .eq("organization_id", organizationId)
        .eq("is_connected", true)
        .eq("channel_status", "connected")
        .in("channel_type", ["CUSTOMER_INBOX", "customer_inbox"]);
      return data || [];
    },
    enabled: !!organizationId && open,
    staleTime: 30_000,
  });

  const handleSend = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("whatsapp-send-reminder", {
        body: { phone: clientPhone, message, client_name: clientName },
      });

      if (error) throw error;

      if (data?.error) {
        const errorMessages: Record<string, string> = {
          no_channel: "Nenhum canal WhatsApp conectado.",
          invalid_phone: "Número de telefone inválido.",
          channel_disconnected: "Canal WhatsApp desconectado.",
          rate_limited: "Limite de envio atingido. Aguarde.",
        };
        toast.error(errorMessages[data.error] || data.message || "Erro ao enviar recibo.");
        setSending(false);
        return;
      }

      setSent(true);
      setSentChannel(data?.channel_name || "");
      toast.success("Recibo enviado com sucesso! 🧾");
      setTimeout(() => onOpenChange(false), 2500);
    } catch (err) {
      console.error("Receipt send error:", err);
      toast.error("Erro ao enviar recibo. Tente novamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={(v) => !sending && onOpenChange(v)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Receipt className="h-4 w-4 text-primary" />
            </div>
            Enviar Recibo via WhatsApp
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs">
            O recibo será enviado diretamente para o cliente pelo WhatsApp da Tecvo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {sent ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle2 className="h-6 w-6 text-primary" />
            </div>
            <p className="text-sm font-medium text-primary">Recibo enviado!</p>
            {sentChannel && (
              <p className="text-xs text-muted-foreground">Enviado via: {sentChannel}</p>
            )}
          </div>
        ) : (
          <>
            {/* Message preview / editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">Recibo:</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs"
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Visualizar" : "Editar"}
                </Button>
              </div>
              {editing ? (
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  className="text-xs min-h-[200px] resize-none font-mono"
                />
              ) : (
                <div className="rounded-lg bg-muted/50 border border-border p-3 max-h-[300px] overflow-y-auto">
                  <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                    {message.replace(/\*/g, "")}
                  </p>
                </div>
              )}
            </div>

            {/* Channel indicator */}
            {connectedChannels && connectedChannels.length > 0 && (
              <div className="flex items-center gap-1.5">
                <Wifi className="h-3 w-3 text-green-500" />
                <span className="text-[10px] text-muted-foreground">
                  Será enviado via:{" "}
                  <span className="font-medium text-foreground">
                    {connectedChannels.length === 1
                      ? connectedChannels[0].name
                      : "Auto (canal do contato)"}
                  </span>
                </span>
              </div>
            )}
          </>
        )}

        {!sent && (
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Pular</AlertDialogCancel>
            <Button
              onClick={handleSend}
              disabled={sending || !message.trim()}
              className="gap-1.5"
            >
              {sending ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  Enviar Recibo
                </>
              )}
            </Button>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
