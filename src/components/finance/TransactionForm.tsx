import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import {
  type Transaction,
  type TransactionFormData,
  type TransactionType,
} from "@/hooks/useTransactions";
import { useTransactionCategories } from "@/hooks/useTransactionCategories";
import {
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { useSuppliers } from "@/hooks/useSuppliers";
import { usePaymentMethods, type PaymentMethod } from "@/hooks/usePaymentMethods";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import { getTodayInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
const transactionSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Selecione uma categoria"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(2, "Descrição obrigatória"),
  date: z.string().min(1, "Data obrigatória"),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
  supplier_id: z.string().optional(),
  financial_account_id: z.string().optional(),
});

interface TransactionFormProps {
  transaction?: Transaction | null;
  defaultType?: TransactionType;
  defaultCategory?: string;
  onSubmit: (data: TransactionFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function TransactionForm({
  transaction,
  defaultType = "income",
  defaultCategory,
  onSubmit,
  onCancel,
  isSubmitting,
}: TransactionFormProps) {
  const { groupedIncomeCategories, groupedExpenseCategories, isLoading: isLoadingCategories } = useTransactionCategories();
  const { suppliers, isLoading: isLoadingSuppliers } = useSuppliers();
  const { paymentMethods, isLoading: isLoadingPaymentMethods, formatFee } = usePaymentMethods();
  const { activeAccounts, isLoading: isLoadingFinancialAccounts } = useFinancialAccounts();
  const tz = useOrgTimezone();

  // Separate regular methods from credit card installments
  const regularMethods = paymentMethods.filter((m) => m.installments === null);
  const creditCardMethods = paymentMethods
    .filter((m) => m.installments !== null)
    .sort((a, b) => (a.installments || 0) - (b.installments || 0));

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: transaction?.type ?? defaultType,
      category: transaction?.category ?? defaultCategory ?? "",
      amount: transaction?.amount ?? undefined,
      description: transaction?.description ?? (defaultCategory === "prolabore" ? "Pró-labore" : ""),
      date: transaction?.date ?? getTodayInTz(tz),
      payment_method: transaction?.payment_method ?? "",
      notes: transaction?.notes ?? "",
      supplier_id: (transaction as Transaction & { supplier_id?: string })?.supplier_id ?? "",
      financial_account_id: (transaction as Transaction & { financial_account_id?: string })?.financial_account_id ?? "",
    },
  });

  const selectedType = watch("type");
  const paymentMethodValue = watch("payment_method");
  const groupedCategories = selectedType === "income" ? groupedIncomeCategories : groupedExpenseCategories;

  // Check if current value is a credit card method
  const isCreditCardSelected = paymentMethodValue?.startsWith("credit_card_");
  const [showInstallments, setShowInstallments] = useState(isCreditCardSelected);
  const [selectedBaseType, setSelectedBaseType] = useState(
    isCreditCardSelected ? "credit_card" : paymentMethodValue
  );

  // Sync showInstallments with value
  useEffect(() => {
    const isCC = paymentMethodValue?.startsWith("credit_card_");
    setShowInstallments(isCC);
    if (isCC) {
      setSelectedBaseType("credit_card");
    } else if (paymentMethodValue) {
      setSelectedBaseType(paymentMethodValue);
    }
  }, [paymentMethodValue]);

  const handleBaseTypeChange = (baseType: string) => {
    setSelectedBaseType(baseType);
    
    if (baseType === "credit_card") {
      setShowInstallments(true);
      const firstInstallment = creditCardMethods.find((m) => m.installments === 1);
      if (firstInstallment) {
        setValue("payment_method", firstInstallment.slug);
      }
    } else {
      setShowInstallments(false);
      setValue("payment_method", baseType);
    }
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    const data: TransactionFormData & { supplier_id?: string; financial_account_id?: string } = {
      type: formData.type as TransactionType,
      category: formData.category as string,
      amount: formData.amount as number,
      description: formData.description as string,
      date: formData.date as string,
      due_date: formData.date as string,
      payment_method: formData.payment_method as string | undefined,
      notes: formData.notes as string | undefined,
      supplier_id: formData.supplier_id as string | undefined,
      financial_account_id: formData.financial_account_id as string | undefined,
    };
    console.log("SALVANDO TRANSAÇÃO:", data);
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="type">Tipo *</Label>
          <Controller
            name="type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Entrada</SelectItem>
                  <SelectItem value="expense">Saída</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria *</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value} disabled={isLoadingCategories}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {groupedCategories.map((group) => (
                    <SelectGroup key={group.parent.id}>
                      <SelectLabel>{group.parent.name}</SelectLabel>
                      {group.children.map((cat) => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Valor (R$) *</Label>
          <Input
            id="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0,00"
            {...register("amount")}
          />
          {errors.amount && (
            <p className="text-sm text-destructive">{errors.amount.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="date">Data *</Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
          />
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição *</Label>
        <Input
          id="description"
          placeholder="Ex: Serviço de manutenção - Cliente X"
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="payment_method">Forma de Pagamento</Label>
        <Select 
          value={showInstallments ? "credit_card" : selectedBaseType} 
          onValueChange={handleBaseTypeChange} 
          disabled={isLoadingPaymentMethods}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {regularMethods.map((method) => (
              <SelectItem key={method.id} value={method.slug}>
                {method.name}
                {method.fee_value > 0 && (
                  <span className="text-muted-foreground ml-2">
                    ({formatFee(method)})
                  </span>
                )}
              </SelectItem>
            ))}
            {creditCardMethods.length > 0 && (
              <SelectItem value="credit_card">
                Cartão de Crédito
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Installment selector for credit card */}
        {showInstallments && creditCardMethods.length > 0 && (
          <div className="space-y-1 mt-2">
            <Label className="text-xs text-muted-foreground">Parcelas</Label>
            <Controller
              name="payment_method"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ""} onValueChange={field.onChange} disabled={isLoadingPaymentMethods}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione as parcelas..." />
                  </SelectTrigger>
                  <SelectContent>
                    {creditCardMethods.map((method) => (
                      <SelectItem key={method.id} value={method.slug}>
                        {method.installments}x
                        {method.fee_value > 0 && (
                          <span className="text-muted-foreground ml-2">
                            (Taxa: {method.fee_value}%)
                          </span>
                        )}
                        {method.fee_value === 0 && (
                          <span className="text-muted-foreground ml-2">
                            (sem juros)
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        )}
      </div>

      {/* Supplier field - only for expenses */}
      {selectedType === "expense" && (
        <div className="space-y-2">
          <Label htmlFor="supplier_id">Fornecedor (opcional)</Label>
          <Controller
            name="supplier_id"
            control={control}
            render={({ field }) => (
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""} 
                disabled={isLoadingSuppliers}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um fornecedor..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Nenhum</SelectItem>
                  {suppliers.map((supplier) => (
                    <SelectItem key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Financial Account */}
      <div className="space-y-2">
        <Label htmlFor="financial_account_id">Conta Financeira</Label>
        <Controller
          name="financial_account_id"
          control={control}
          render={({ field }) => (
            <Select
              onValueChange={field.onChange}
              value={field.value || ""}
              disabled={isLoadingFinancialAccounts}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma conta..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Nenhuma</SelectItem>
                {activeAccounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          placeholder="Notas adicionais"
          rows={2}
          {...register("notes")}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {transaction ? "Salvar" : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
