import { useState } from "react";
import { ArrowLeft, Plus, Pencil, ArrowRightLeft, Banknote, Building2, Wallet, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useFinancialAccounts,
  ACCOUNT_TYPE_LABELS,
  type FinancialAccount,
  type AccountType,
  type FinancialAccountFormData,
} from "@/hooks/useFinancialAccounts";
import { TransferDialog } from "@/components/finance/TransferDialog";

const ACCOUNT_TYPE_ICONS: Record<AccountType, typeof Banknote> = {
  cash: Banknote,
  bank: Building2,
  digital: Wallet,
  card: CreditCard,
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

interface FinancialAccountsSettingsProps {
  onBack: () => void;
}

export function FinancialAccountsSettings({ onBack }: FinancialAccountsSettingsProps) {
  const { accounts, activeAccounts, isLoading, totalBalance, create, update, isCreating, isUpdating } =
    useFinancialAccounts();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [form, setForm] = useState<FinancialAccountFormData>({ name: "", account_type: "cash", balance: 0 });

  const openNew = () => {
    setEditingAccount(null);
    setForm({ name: "", account_type: "cash", balance: 0 });
    setDialogOpen(true);
  };

  const openEdit = (account: FinancialAccount) => {
    setEditingAccount(account);
    setForm({ name: account.name, account_type: account.account_type, balance: account.balance });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (editingAccount) {
      await update({ id: editingAccount.id, data: { name: form.name, account_type: form.account_type } });
    } else {
      await create(form);
    }
    setDialogOpen(false);
  };

  const toggleActive = async (account: FinancialAccount) => {
    await update({ id: account.id, data: { is_active: !account.is_active } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Contas Financeiras</h1>
          <p className="text-muted-foreground">Gerencie seus caixas e contas bancárias</p>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">Saldo Total</span>
        <span className="text-xl font-bold text-primary">{formatCurrency(totalBalance)}</span>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-1" />
          Nova Conta
        </Button>
        <Button variant="outline" onClick={() => setTransferOpen(true)} disabled={activeAccounts.length < 2}>
          <ArrowRightLeft className="h-4 w-4 mr-1" />
          Transferir
        </Button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-12">
          <h3 className="text-lg font-semibold text-foreground mb-2">Nenhuma conta cadastrada</h3>
          <p className="text-muted-foreground text-center">Crie contas financeiras para controlar seus caixas</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {accounts.map((account) => {
            const Icon = ACCOUNT_TYPE_ICONS[account.account_type] || Banknote;
            return (
              <div
                key={account.id}
                className={`rounded-xl border p-4 flex items-center gap-4 transition-all ${
                  account.is_active ? "border-border bg-card" : "border-border/50 bg-muted/30 opacity-60"
                }`}
              >
                <div className="rounded-lg bg-primary/10 p-3">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-card-foreground truncate">{account.name}</h3>
                    {!account.is_active && <Badge variant="secondary" className="text-xs">Inativa</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{ACCOUNT_TYPE_LABELS[account.account_type]}</p>
                  <p className={`text-sm font-bold mt-1 ${Number(account.balance) >= 0 ? "text-emerald-600" : "text-destructive"}`}>
                    {formatCurrency(Number(account.balance))}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(account)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Switch checked={account.is_active} onCheckedChange={() => toggleActive(account)} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Editar Conta" : "Nova Conta Financeira"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Caixa Dinheiro, Nubank PJ"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo *</Label>
              <Select
                value={form.account_type}
                onValueChange={(v) => setForm({ ...form, account_type: v as AccountType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(ACCOUNT_TYPE_LABELS) as [AccountType, string][]).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {!editingAccount && (
              <div className="space-y-2">
                <Label>Saldo Inicial (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.balance ?? 0}
                  onChange={(e) => setForm({ ...form, balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!form.name || isCreating || isUpdating}>
              {editingAccount ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}
