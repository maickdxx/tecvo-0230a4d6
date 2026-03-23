import { useEffect, useState } from "react";
import { formatPaymentMethod } from "@/lib/formatPaymentMethod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  FileText,
} from "lucide-react";
import type { Account, AccountStatus, AccountType } from "@/hooks/useAccounts";
import { getLinkedFees } from "@/hooks/useAccounts";
import { useAuth } from "@/hooks/useAuth";
import { formatDateInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

const STATUS_CONFIG: Record<
  AccountStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }
> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  paid: { label: "Pago", variant: "default", icon: CheckCircle2 },
  overdue: { label: "Atrasado", variant: "destructive", icon: AlertCircle },
  cancelled: { label: "Cancelado", variant: "outline", icon: XCircle },
};

const SERVICE_TYPE_LABELS: Record<string, string> = {
  instalacao: "Instalação", installation: "Instalação",
  limpeza: "Limpeza", cleaning: "Limpeza",
  manutencao: "Manutenção", maintenance: "Manutenção",
  contratos: "Contratos", maintenance_contract: "Contratos",
  outros: "Outros", other: "Outros",
  reparo: "Reparo", repair: "Reparo",
  visit: "Visita Técnica", quote: "Orçamento",
};

interface AccountDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: Account | null;
  accountType: AccountType;
}

export function AccountDetailsDialog({
  open,
  onOpenChange,
  account,
  accountType,
}: AccountDetailsDialogProps) {
  const tz = useOrgTimezone();
  const { organizationId } = useAuth();
  const [fees, setFees] = useState<{ amount: number; description: string }[]>([]);
  const [loadingFees, setLoadingFees] = useState(false);

  useEffect(() => {
    if (!open || !account?.service_id || !organizationId) {
      setFees([]);
      return;
    }

    setLoadingFees(true);
    getLinkedFees(account.service_id, organizationId)
      .then((data) => {
        setFees(data.map((t) => ({ amount: Number(t.amount), description: t.description })));
      })
      .catch(() => setFees([]))
      .finally(() => setLoadingFees(false));
  }, [open, account?.service_id, organizationId]);

  if (!account) return null;

  const statusConfig = STATUS_CONFIG[account.status] || STATUS_CONFIG.pending;
  const StatusIcon = statusConfig.icon;
  const grossAmount = Number(account.amount);
  const totalFees = fees.reduce((sum, f) => sum + f.amount, 0);
  const netAmount = accountType === "receivable" ? grossAmount - totalFees : grossAmount;
  const hasFees = fees.length > 0;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Detalhes da Conta</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Description & Status */}
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 min-w-0">
              <p className="font-semibold text-foreground">{account.description}</p>
              <p className="text-sm text-muted-foreground capitalize">{account.category}</p>
            </div>
            <Badge variant={statusConfig.variant} className="gap-1 shrink-0">
              <StatusIcon className="h-3 w-3" />
              {statusConfig.label}
            </Badge>
          </div>

          <Separator />

          {/* Values */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {hasFees ? "Valor Bruto" : "Valor"}
              </span>
              <span className="font-medium">{formatCurrency(grossAmount)}</span>
            </div>

            {hasFees && (
              <>
                {fees.map((fee, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{fee.description || "Taxa"}</span>
                    <span className="text-destructive font-medium">
                      - {formatCurrency(fee.amount)}
                    </span>
                  </div>
                ))}
                <Separator />
                <div className="flex justify-between text-sm font-semibold">
                  <span>Valor Líquido</span>
                  <span className="text-primary">{formatCurrency(netAmount)}</span>
                </div>
              </>
            )}

            {loadingFees && (
              <p className="text-xs text-muted-foreground">Carregando taxas...</p>
            )}
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-2 text-sm">
            {account.payment_method && (
              <DetailRow label="Forma de Pagamento" value={formatPaymentMethod(account.payment_method)} />
            )}
            <DetailRow label="Data Emissão" value={formatDateInTz(account.date, tz)} />
            {account.due_date && (
              <DetailRow label="Data Vencimento" value={formatDateInTz(account.due_date, tz)} />
            )}
            {account.payment_date && (
              <DetailRow label="Data Pagamento" value={formatDateInTz(account.payment_date, tz)} />
            )}
          </div>

          {/* Service link */}
          {account.service_id && account.service && (
            <>
              <Separator />
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Vínculo:</span>
                  <Badge variant="outline" className="text-xs">
                    OS #{account.service.quote_number}
                  </Badge>
                  {account.service.service_type && (
                    <span className="text-muted-foreground">
                      ({SERVICE_TYPE_LABELS[account.service.service_type] || account.service.service_type})
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Client / Supplier */}
          {(account.client?.name || account.supplier?.name) && (
            <>
              <Separator />
              <div className="text-sm">
                {accountType === "receivable" && account.client?.name && (
                  <DetailRow label="Cliente" value={account.client.name} />
                )}
                {accountType === "payable" && account.supplier?.name && (
                  <DetailRow label="Fornecedor" value={account.supplier.name} />
                )}
              </div>
            </>
          )}

          {/* Notes */}
          {account.notes && (
            <>
              <Separator />
              <div className="text-sm">
                <p className="text-muted-foreground mb-1">Observações</p>
                <p className="text-foreground whitespace-pre-wrap">{account.notes}</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground">{value}</span>
    </div>
  );
}
