import { useState } from "react";
import { getTodayInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, Plus, X } from "lucide-react";
import { useTransactionCategories, type GroupedCategory } from "@/hooks/useTransactionCategories";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useClients } from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import type { AccountFormData, AccountType } from "@/hooks/useAccounts";

const schema = z.object({
  description: z.string().min(1, "Descrição é obrigatória").max(200),
  amount: z.coerce.number().min(0.01, "Valor deve ser maior que zero"),
  date: z.string().min(1, "Data de emissão é obrigatória"),
  due_date: z.string().min(1, "Data de vencimento é obrigatória"),
  category: z.string().min(1, "Plano de contas é obrigatório"),
  payment_method: z.string().optional(),
  recurrence: z.string().optional(),
  financial_account_id: z.string().optional(),
  supplier_id: z.string().optional(),
  client_id: z.string().optional(),
  employee_id: z.string().optional(),
  payment_source_type: z.string().optional(),
  notes: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

interface AccountFullFormProps {
  accountType: AccountType;
  onSubmit: (data: AccountFormData) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
  onSaveAndNew?: (data: AccountFormData) => Promise<void>;
}

export function AccountFullForm({
  accountType,
  onSubmit,
  isSubmitting,
  onCancel,
  onSaveAndNew,
}: AccountFullFormProps) {
  const isPayable = accountType === "payable";
  const categoryType = isPayable ? "expense" : "income";

  const { groupedExpenseCategories, groupedIncomeCategories } = useTransactionCategories(categoryType);
  const { paymentMethods } = usePaymentMethods();
  const { activeAccounts } = useFinancialAccounts();
  const { suppliers } = useSuppliers();
  const { clients } = useClients();
  const { members } = useTeamMembers();

  const grouped: GroupedCategory[] = isPayable ? groupedExpenseCategories : groupedIncomeCategories;

  const tz = useOrgTimezone();
  const today = getTodayInTz(tz);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      date: today,
      due_date: today,
      recurrence: "",
      payment_source_type: isPayable ? "supplier" : "",
    },
  });

  const paymentSourceType = watch("payment_source_type");

  const buildFormData = (values: FormValues): AccountFormData => ({
    type: isPayable ? "expense" : "income",
    description: values.description,
    amount: values.amount,
    date: values.date,
    due_date: values.due_date,
    category: values.category,
    payment_method: values.payment_method || undefined,
    recurrence: (values.recurrence as any) || undefined,
    supplier_id: values.supplier_id || undefined,
    client_id: values.client_id || undefined,
    employee_id: values.employee_id || undefined,
    payment_source_type: (values.payment_source_type as any) || undefined,
    notes: values.notes || undefined,
    status: "pending",
  });

  const onSave = async (values: FormValues) => {
    await onSubmit(buildFormData(values));
  };

  const onSaveNew = async (values: FormValues) => {
    if (onSaveAndNew) {
      await onSaveAndNew(buildFormData(values));
      reset({ date: today, due_date: today, recurrence: "", payment_source_type: isPayable ? "supplier" : "" });
    }
  };

  return (
    <form className="space-y-6 max-w-4xl">
      {/* Seção 1 — Dados Principais */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Dados Principais</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2 space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input id="description" placeholder="Ex: Pagamento fornecedor X" {...register("description")} />
            {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Valor (R$) *</Label>
            <Input id="amount" type="number" step="0.01" min="0" placeholder="0,00" {...register("amount")} />
            {errors.amount && <p className="text-sm text-destructive">{errors.amount.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="date">Data de Emissão *</Label>
            <Input id="date" type="date" {...register("date")} />
            {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Data de Vencimento *</Label>
            <Input id="due_date" type="date" {...register("due_date")} />
            {errors.due_date && <p className="text-sm text-destructive">{errors.due_date.message}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Seção 2 — Classificação */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Classificação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Plano de Contas *</Label>
            <Select onValueChange={(v) => setValue("category", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {grouped.map((g) => (
                  <div key={g.parent.id}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {g.parent.name}
                    </div>
                    {g.children.map((child) => (
                      <SelectItem key={child.id} value={child.slug}>
                        {child.name}
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {errors.category && <p className="text-sm text-destructive">{errors.category.message}</p>}
          </div>
          <div className="space-y-2">
            <Label>Forma de Pagamento</Label>
            <Select onValueChange={(v) => setValue("payment_method", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.id} value={pm.slug}>
                    {pm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Recorrência</Label>
            <Select onValueChange={(v) => setValue("recurrence", v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Única" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Única</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Seção 3 — Vinculação */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">
            {isPayable ? "Destinatário" : "Origem"}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {isPayable ? (
            <>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={paymentSourceType || "supplier"}
                  onValueChange={(v) => {
                    setValue("payment_source_type", v);
                    setValue("supplier_id", "");
                    setValue("employee_id", "");
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="supplier">Fornecedor</SelectItem>
                    <SelectItem value="employee">Funcionário</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {paymentSourceType === "employee" ? (
                <div className="space-y-2">
                  <Label>Funcionário</Label>
                  <Select onValueChange={(v) => setValue("employee_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>
                          {m.full_name || m.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Select onValueChange={(v) => setValue("supplier_id", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select onValueChange={(v) => setValue("client_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Seção 4 — Conta Financeira */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Conta Financeira</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 max-w-sm">
            <Label>{isPayable ? "Conta de saída" : "Conta de entrada"}</Label>
            <Select onValueChange={(v) => setValue("financial_account_id", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {activeAccounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    {acc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Seção 5 — Observações */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Observações</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            placeholder="Informações adicionais sobre este lançamento..."
            rows={3}
            {...register("notes")}
          />
        </CardContent>
      </Card>

      {/* Botões */}
      <div className="flex flex-col sm:flex-row gap-3 pb-8">
        <Button type="button" onClick={handleSubmit(onSave)} disabled={isSubmitting} className="gap-2">
          <Save className="h-4 w-4" />
          Salvar
        </Button>
        {onSaveAndNew && (
          <Button type="button" variant="outline" onClick={handleSubmit(onSaveNew)} disabled={isSubmitting} className="gap-2">
            <Plus className="h-4 w-4" />
            Salvar e Lançar Outra
          </Button>
        )}
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting} className="gap-2">
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </div>
    </form>
  );
}
