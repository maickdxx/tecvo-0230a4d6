import { useForm, Controller } from "react-hook-form";
import { getTodayInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { PAYMENT_METHODS } from "@/hooks/useTransactions";
import { useTransactionCategories } from "@/hooks/useTransactionCategories";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useClients } from "@/hooks/useClients";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useServices } from "@/hooks/useServices";
import type { Account, AccountFormData, AccountType, PaymentSourceType } from "@/hooks/useAccounts";

const accountSchema = z.object({
  type: z.enum(["income", "expense"]),
  category: z.string().min(1, "Selecione uma categoria"),
  amount: z.coerce.number().positive("Valor deve ser maior que zero"),
  description: z.string().min(2, "Descrição obrigatória"),
  date: z.string().min(1, "Data obrigatória"),
  due_date: z.string().min(1, "Data de vencimento obrigatória"),
  payment_method: z.string().optional(),
  notes: z.string().optional(),
  supplier_id: z.string().optional(),
  client_id: z.string().optional(),
  service_id: z.string().optional(),
  employee_id: z.string().optional(),
  payment_source_type: z.string().optional(),
  recurrence: z.string().optional(),
  origin_type: z.string().optional(),
});

interface AccountFormProps {
  account?: Account | null;
  accountType: AccountType;
  onSubmit: (data: AccountFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function AccountForm({
  account,
  accountType,
  onSubmit,
  onCancel,
  isSubmitting,
}: AccountFormProps) {
  const tz = useOrgTimezone();
  const { groupedIncomeCategories, groupedExpenseCategories, isLoading: isLoadingCategories } = useTransactionCategories();
  const { suppliers, isLoading: isLoadingSuppliers } = useSuppliers();
  const { clients, isLoading: isLoadingClients } = useClients();
  const { members, isLoading: isLoadingMembers } = useTeamMembers();
  const { services, isLoading: isLoadingServices } = useServices();

  const defaultType = accountType === "payable" ? "expense" : "income";
  const groupedCategories = accountType === "payable" ? groupedExpenseCategories : groupedIncomeCategories;

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      type: account?.type ?? defaultType,
      category: account?.category ?? "",
      amount: account?.amount ?? undefined,
      description: account?.description ?? "",
      date: account?.date ?? getTodayInTz(tz),
      due_date: account?.due_date ?? getTodayInTz(tz),
      payment_method: account?.payment_method ?? "",
      notes: account?.notes ?? "",
      supplier_id: account?.supplier_id ?? "",
      client_id: account?.client_id ?? "",
      service_id: account?.service_id ?? "",
      employee_id: account?.employee_id ?? "",
      payment_source_type: account?.payment_source_type ?? "",
      recurrence: account?.recurrence ?? "",
      origin_type: account?.client_id ? "client" : account?.service_id ? "service" : "",
    },
  });

  const paymentSourceType = watch("payment_source_type");
  const originType = watch("origin_type");

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    const recurrenceValue = formData.recurrence as string;
    const data: AccountFormData = {
      type: formData.type as "income" | "expense",
      category: formData.category as string,
      amount: formData.amount as number,
      description: formData.description as string,
      date: formData.date as string,
      due_date: formData.due_date as string,
      payment_method: formData.payment_method as string | undefined,
      notes: formData.notes as string | undefined,
      supplier_id: (formData.payment_source_type === "supplier" ? formData.supplier_id : undefined) as string | undefined,
      client_id: (formData.origin_type === "client" ? formData.client_id : undefined) as string | undefined,
      service_id: (formData.origin_type === "service" ? formData.service_id : undefined) as string | undefined,
      employee_id: (formData.payment_source_type === "employee" ? formData.employee_id : undefined) as string | undefined,
      payment_source_type: formData.payment_source_type as PaymentSourceType,
      recurrence: recurrenceValue ? recurrenceValue as "weekly" | "monthly" | "yearly" : undefined,
    };
    await onSubmit(data);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {/* Payable: Payment source type */}
      {accountType === "payable" && (
        <div className="space-y-2">
          <Label htmlFor="payment_source_type">Tipo de Pagamento *</Label>
          <Controller
            name="payment_source_type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supplier">Fornecedor</SelectItem>
                  <SelectItem value="employee">Salário de Funcionário</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Payable: Supplier select */}
      {accountType === "payable" && paymentSourceType === "supplier" && (
        <div className="space-y-2">
          <Label htmlFor="supplier_id">Para qual Fornecedor? *</Label>
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

      {/* Payable: Employee select */}
      {accountType === "payable" && paymentSourceType === "employee" && (
        <div className="space-y-2">
          <Label htmlFor="employee_id">Para qual Funcionário? *</Label>
          <Controller
            name="employee_id"
            control={control}
            render={({ field }) => (
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""} 
                disabled={isLoadingMembers}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um funcionário..." />
                </SelectTrigger>
                <SelectContent>
                  {members.map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.full_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Receivable: Origin type */}
      {accountType === "receivable" && (
        <div className="space-y-2">
          <Label htmlFor="origin_type">Origem do Recebimento *</Label>
          <Controller
            name="origin_type"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a origem..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="service">Serviço Específico</SelectItem>
                  <SelectItem value="other">Outra Origem</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Receivable: Client select */}
      {accountType === "receivable" && originType === "client" && (
        <div className="space-y-2">
          <Label htmlFor="client_id">Qual Cliente? *</Label>
          <Controller
            name="client_id"
            control={control}
            render={({ field }) => (
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""} 
                disabled={isLoadingClients}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um cliente..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Receivable: Service select */}
      {accountType === "receivable" && originType === "service" && (
        <div className="space-y-2">
          <Label htmlFor="service_id">Qual Serviço? *</Label>
          <Controller
            name="service_id"
            control={control}
            render={({ field }) => (
              <Select 
                onValueChange={field.onChange} 
                value={field.value || ""} 
                disabled={isLoadingServices}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um serviço..." />
                </SelectTrigger>
                <SelectContent>
                  {services.map((service) => (
                    <SelectItem key={service.id} value={service.id}>
                      #{service.quote_number} - {service.client?.name || "Sem cliente"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

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
          {errors.category && (
            <p className="text-sm text-destructive">{errors.category.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição *</Label>
        <Input
          id="description"
          placeholder={accountType === "payable" ? "Ex: Compra de materiais" : "Ex: Recebimento cliente X"}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">Data de Emissão *</Label>
          <Input
            id="date"
            type="date"
            {...register("date")}
          />
          {errors.date && (
            <p className="text-sm text-destructive">{errors.date.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Data de Vencimento *</Label>
          <Input
            id="due_date"
            type="date"
            {...register("due_date")}
          />
          {errors.due_date && (
            <p className="text-sm text-destructive">{errors.due_date.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="payment_method">Forma de Pagamento</Label>
          <Controller
            name="payment_method"
            control={control}
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value || ""}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="recurrence">Recorrência</Label>
          <Controller
            name="recurrence"
            control={control}
            render={({ field }) => (
              <Select onValueChange={(val) => field.onChange(val === "none" ? "" : val)} value={field.value || "none"}>
                <SelectTrigger>
                  <SelectValue placeholder="Sem recorrência" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem recorrência</SelectItem>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensal</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
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
          {account ? "Salvar" : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
