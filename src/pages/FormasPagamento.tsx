import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, CreditCard, Percent, DollarSign, Banknote } from "lucide-react";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePaymentMethods, type PaymentMethod, type FeeType } from "@/hooks/usePaymentMethods";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function FormasPagamento() {
  const {
    allPaymentMethods,
    isLoadingAll,
    update,
    remove,
    isUpdating,
    isDeleting,
    formatFee,
  } = usePaymentMethods();

  const [editingMethod, setEditingMethod] = useState<PaymentMethod | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingInstallmentFees, setEditingInstallmentFees] = useState(false);
  const [installmentFees, setInstallmentFees] = useState<Record<string, string>>({});

  // Form state
  const [formName, setFormName] = useState("");
  const [formFeeType, setFormFeeType] = useState<FeeType>("percentage");
  const [formFeeValue, setFormFeeValue] = useState("");

  const resetForm = () => {
    setFormName("");
    setFormFeeType("percentage");
    setFormFeeValue("");
  };

  const handleOpenEdit = (method: PaymentMethod) => {
    setFormName(method.name);
    setFormFeeType(method.fee_type as FeeType);
    setFormFeeValue(method.fee_value.toString());
    setEditingMethod(method);
  };

  const handleUpdate = async () => {
    if (!editingMethod || !formName.trim()) return;
    await update({
      id: editingMethod.id,
      data: {
        name: formName.trim(),
        fee_type: formFeeType,
        fee_value: parseFloat(formFeeValue) || 0,
      },
    });
    setEditingMethod(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  const methodToDelete = allPaymentMethods.find((m) => m.id === deleteId);

  // Filter and group payment methods
  const activePaymentMethods = allPaymentMethods.filter((m) => m.is_active);
  const regularMethods = activePaymentMethods.filter((m) => m.installments === null);
  const creditCardMethods = activePaymentMethods
    .filter((m) => m.installments !== null)
    .sort((a, b) => (a.installments || 0) - (b.installments || 0));

  // Initialize installment fees for editing
  const handleOpenInstallmentEdit = () => {
    const fees: Record<string, string> = {};
    creditCardMethods.forEach((m) => {
      fees[m.id] = m.fee_value.toString();
    });
    setInstallmentFees(fees);
    setEditingInstallmentFees(true);
  };

  const handleSaveInstallmentFees = async () => {
    // Update all credit card methods with their new fees
    for (const method of creditCardMethods) {
      const newFee = parseFloat(installmentFees[method.id]) || 0;
      if (newFee !== method.fee_value) {
        await update({
          id: method.id,
          data: { fee_value: newFee },
        });
      }
    }
    setEditingInstallmentFees(false);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Formas de Pagamento</h1>
        <p className="text-muted-foreground">Gerencie as formas de pagamento e suas taxas</p>
      </div>

      {isLoadingAll ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Regular payment methods */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground">Métodos Regulares</h3>
            {regularMethods.map((method) => (
              <div
                key={method.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-4"
              >
                <div className="rounded-lg bg-primary/10 p-2">
                  <Banknote className="h-4 w-4 text-primary" />
                </div>

                <div className="flex-1">
                  <p className="font-medium text-card-foreground">{method.name}</p>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {method.fee_type === "percentage" ? (
                      <Percent className="h-3 w-3" />
                    ) : (
                      <DollarSign className="h-3 w-3" />
                    )}
                    <span>Taxa: {formatFee(method)}</span>
                    {method.is_default && (
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">Padrão</span>
                    )}
                  </div>
                </div>

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleOpenEdit(method)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {!method.is_default && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteId(method.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}

            {regularMethods.length === 0 && (
              <p className="py-4 text-center text-muted-foreground">
                Nenhuma forma de pagamento regular
              </p>
            )}
          </div>

          {/* Credit Card with installments */}
          {creditCardMethods.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                    </div>
                    <CardTitle className="text-base">Cartão de Crédito - Parcelamento</CardTitle>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleOpenInstallmentEdit}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar Taxas
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                  {creditCardMethods.map((method) => (
                    <div
                      key={method.id}
                      className="text-center p-3 rounded-lg bg-muted/50 border"
                    >
                      <p className="font-semibold text-sm">{method.installments}x</p>
                      <p className="text-xs text-muted-foreground">{method.fee_value}%</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Edit Dialog for regular methods */}
      <Dialog open={!!editingMethod} onOpenChange={() => setEditingMethod(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Forma de Pagamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                placeholder="Ex: Cartão de Crédito 3x"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Taxa</Label>
                <Select value={formFeeType} onValueChange={(v) => setFormFeeType(v as FeeType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual (%)</SelectItem>
                    <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Valor da Taxa</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={formFeeType === "percentage" ? "Ex: 3.5" : "Ex: 5.00"}
                  value={formFeeValue}
                  onChange={(e) => setFormFeeValue(e.target.value)}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingMethod(null)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={!formName.trim() || isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Installment Fees Dialog */}
      <Dialog open={editingInstallmentFees} onOpenChange={setEditingInstallmentFees}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar Taxas de Parcelamento</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Configure a taxa percentual para cada número de parcelas
            </p>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {creditCardMethods.map((method) => (
                <div key={method.id} className="space-y-1">
                  <Label className="text-xs">{method.installments}x</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={installmentFees[method.id] || ""}
                      onChange={(e) => setInstallmentFees(prev => ({
                        ...prev,
                        [method.id]: e.target.value,
                      }))}
                      className="pr-6"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInstallmentFees(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveInstallmentFees} disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar Taxas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover forma de pagamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover "{methodToDelete?.name}"? Ela não aparecerá mais nas opções de pagamento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
