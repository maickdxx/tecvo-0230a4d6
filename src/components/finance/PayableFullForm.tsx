import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTransactionCategories } from "@/hooks/useTransactionCategories";
import { getTodayInTz, formatDateObjInTz } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { useFinancialAccounts } from "@/hooks/useFinancialAccounts";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Save, FileText, Paperclip, Upload } from "lucide-react";
import type { AccountFormData, Account } from "@/hooks/useAccounts";

interface PayableFullFormProps {
  onSubmit: (data: AccountFormData) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
  initialData?: Account | null;
}

export function PayableFullForm({ onSubmit, isSubmitting, onCancel, initialData }: PayableFullFormProps) {
  const tz = useOrgTimezone();
  const { groupedExpenseCategories, isLoading: loadingCategories } = useTransactionCategories("expense");
  const { activeAccounts, isLoading: loadingAccounts } = useFinancialAccounts();
  const { suppliers } = useSuppliers();
  const { members } = useTeamMembers();

  const isEditing = !!initialData?.id;

  // Form state — pre-fill from initialData when editing
  const [description, setDescription] = useState(initialData?.description || "");
  const [issueDate, setIssueDate] = useState(initialData?.date?.substring(0, 10) || getTodayInTz(tz));
  const [dueDate, setDueDate] = useState(initialData?.due_date?.substring(0, 10) || getTodayInTz(tz));
  const [category, setCategory] = useState(initialData?.category || "");
  const [entityType, setEntityType] = useState<"supplier" | "employee">(
    (initialData?.payment_source_type as "supplier" | "employee") || "supplier"
  );
  const [supplierId, setSupplierId] = useState(initialData?.supplier_id || "");
  const [employeeId, setEmployeeId] = useState(initialData?.employee_id || "");
  const [financialAccountId, setFinancialAccountId] = useState(
    (initialData as any)?.financial_account_id || ""
  );
  const [grossAmount, setGrossAmount] = useState(initialData ? String(initialData.amount) : "");
  const [interest, setInterest] = useState("");
  const [discount, setDiscount] = useState("");
  const [installmentsEnabled, setInstallmentsEnabled] = useState(!!initialData?.recurrence);
  const [recurrenceType, setRecurrenceType] = useState<"monthly" | "weekly" | "yearly">(
    (initialData?.recurrence as any) || "monthly"
  );
  const [installmentCount, setInstallmentCount] = useState("2");
  const [isPaid, setIsPaid] = useState(initialData?.status === "paid");
  const [compensationDate, setCompensationDate] = useState(
    (initialData as any)?.compensation_date?.substring(0, 10) || ""
  );
  const [competenceDate, setCompetenceDate] = useState("");
  const [notes, setNotes] = useState(initialData?.notes || "");

  const parseCurrency = (v: string) => {
    if (!v) return 0;
    const t = v.trim();
    // BR format: comma as decimal separator (e.g. "2.626,50")
    if (t.includes(",")) {
      return Number(t.replace(/\./g, "").replace(",", ".")) || 0;
    }
    // Single dot with 1-2 digits after = decimal (e.g. "150.50")
    if (/^\d+\.\d{1,2}$/.test(t)) {
      return Number(t) || 0;
    }
    // Dots as thousands separators (e.g. "2.626")
    return Number(t.replace(/\./g, "")) || 0;
  };
  const gross = parseCurrency(grossAmount);
  const interestVal = parseCurrency(interest);
  const discountVal = parseCurrency(discount);
  const total = gross + interestVal - discountVal;

  const handleSubmit = async () => {
    if (!description.trim() || gross <= 0 || !financialAccountId || !category) return;

    if (isEditing) {
      // Update mode — single update, no installment splitting
      await onSubmit({
        type: "expense",
        description,
        amount: total,
        category,
        date: issueDate,
        due_date: dueDate,
        status: isPaid ? "paid" : "pending",
        payment_date: isPaid ? (compensationDate || dueDate || getTodayInTz(tz)) : undefined,
        recurrence: installmentsEnabled ? recurrenceType : undefined,
        supplier_id: entityType === "supplier" ? supplierId || undefined : undefined,
        employee_id: entityType === "employee" ? employeeId || undefined : undefined,
        payment_source_type: entityType,
        financial_account_id: financialAccountId,
        notes: notes || undefined,
        compensation_date: isPaid && compensationDate ? compensationDate : undefined,
      } as any);
      return;
    }

    const count = installmentsEnabled ? Math.max(1, Number(installmentCount) || 1) : 1;
    const parcelAmount = total / count;

    for (let i = 0; i < count; i++) {
      const parcelDue = new Date(dueDate);
      if (recurrenceType === "monthly") parcelDue.setMonth(parcelDue.getMonth() + i);
      else if (recurrenceType === "weekly") parcelDue.setDate(parcelDue.getDate() + i * 7);
      else if (recurrenceType === "yearly") parcelDue.setFullYear(parcelDue.getFullYear() + i);

      const desc = count > 1 ? `${description} (Parcela ${i + 1}/${count})` : description;

      await onSubmit({
        type: "expense",
        description: desc,
        amount: parcelAmount,
        category,
        date: issueDate,
        due_date: formatDateObjInTz(parcelDue, tz),
        status: isPaid ? "paid" : "pending",
        payment_date: isPaid ? (compensationDate || formatDateObjInTz(parcelDue, tz) || getTodayInTz(tz)) : undefined,
        recurrence: installmentsEnabled ? recurrenceType : undefined,
        supplier_id: entityType === "supplier" ? supplierId || undefined : undefined,
        employee_id: entityType === "employee" ? employeeId || undefined : undefined,
        payment_source_type: entityType,
        financial_account_id: financialAccountId,
        notes: notes || undefined,
        compensation_date: isPaid && compensationDate ? compensationDate : undefined,
      } as any);
    }
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="financial" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="financial" className="gap-1.5 text-xs sm:text-sm px-2">
            <FileText className="h-4 w-4 shrink-0 hidden sm:block" />
            <span className="truncate">Lançamento</span>
          </TabsTrigger>
          <TabsTrigger value="info" className="gap-1.5 text-xs sm:text-sm px-2">
            <FileText className="h-4 w-4 shrink-0 hidden sm:block" />
            <span className="truncate">Informações</span>
          </TabsTrigger>
          <TabsTrigger value="attachments" className="gap-1.5 text-xs sm:text-sm px-2">
            <Paperclip className="h-4 w-4 shrink-0 hidden sm:block" />
            <span className="truncate">Anexos</span>
          </TabsTrigger>
        </TabsList>

        {/* ABA 1 — Lançamento Financeiro */}
        <TabsContent value="financial" className="space-y-6 mt-6">
          {/* Dados Gerais */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Dados Gerais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="description">Descrição *</Label>
                <Input
                  id="description"
                  placeholder="Ex: Pagamento de material elétrico"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="issueDate">Data de Emissão</Label>
                  <Input id="issueDate" type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="dueDate">Data de Vencimento</Label>
                  <Input id="dueDate" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Plano de Contas *</Label>
                  <a href="/financeiro/categorias" target="_blank" className="text-xs text-primary hover:underline">
                    Gerenciar plano de contas
                  </a>
                </div>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {groupedExpenseCategories.map((group) => (
                      <SelectGroup key={group.parent.id}>
                        <SelectLabel>{group.parent.name}</SelectLabel>
                        {group.children.map((child) => (
                          <SelectItem key={child.id} value={child.slug}>
                            {child.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Entidade */}
              <div className="space-y-3">
                <Label>Entidade</Label>
                <div className="flex gap-4">
                  <Button
                    type="button"
                    variant={entityType === "supplier" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEntityType("supplier")}
                  >
                    Fornecedor
                  </Button>
                  <Button
                    type="button"
                    variant={entityType === "employee" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setEntityType("employee")}
                  >
                    Funcionário
                  </Button>
                </div>
                {entityType === "supplier" ? (
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o fornecedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value={employeeId} onValueChange={setEmployeeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o funcionário" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.user_id} value={m.user_id}>{m.full_name || "Sem nome"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Conta Financeira */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Conta Financeira</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <Label>Conta de Saída *</Label>
                <Select value={financialAccountId} onValueChange={setFinancialAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a conta" />
                  </SelectTrigger>
                  <SelectContent>
                    {activeAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — R$ {Number(a.balance).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Valores */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Valores</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="gross">Valor Bruto *</Label>
                  <Input
                    id="gross"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={grossAmount}
                    onChange={(e) => setGrossAmount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  />
                </div>
                <div>
                  <Label htmlFor="interest">Juros</Label>
                  <Input
                    id="interest"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={interest}
                    onChange={(e) => setInterest(e.target.value.replace(/[^0-9.,]/g, ""))}
                  />
                </div>
                <div>
                  <Label htmlFor="discount">Desconto</Label>
                  <Input
                    id="discount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value.replace(/[^0-9.,]/g, ""))}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-sm text-muted-foreground">Total calculado</p>
                <p className="text-2xl font-bold text-foreground">
                  R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Parcelamento — hidden in edit mode */}
          {!isEditing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Parcelamento / Recorrência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Switch checked={installmentsEnabled} onCheckedChange={setInstallmentsEnabled} />
                  <Label>Ativar parcelamento/recorrência</Label>
                </div>
                {installmentsEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Tipo</Label>
                      <Select value={recurrenceType} onValueChange={(v) => setRecurrenceType(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="weekly">Semanal</SelectItem>
                          <SelectItem value="monthly">Mensal</SelectItem>
                          <SelectItem value="yearly">Anual</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="installments">Quantidade de Parcelas</Label>
                      <Input
                        id="installments"
                        type="number"
                        min="2"
                        value={installmentCount}
                        onChange={(e) => setInstallmentCount(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Status do Pagamento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <Switch checked={isPaid} onCheckedChange={setIsPaid} />
                <Label>Pagamento já quitado?</Label>
              </div>
              {isPaid && (
                <div className="space-y-3">
                  <div>
                    <Label htmlFor="compensationDate">Data de Compensação</Label>
                    <Input
                      id="compensationDate"
                      type="date"
                      value={compensationDate}
                      onChange={(e) => setCompensationDate(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Data real em que o dinheiro saiu da conta bancária.
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    O lançamento será salvo como <strong>pago</strong>.
                  </p>
                </div>
              )}
              {!isPaid && (
                <p className="text-sm text-muted-foreground">
                  O lançamento será salvo como <strong>pendente</strong>.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 2 — Outras Informações */}
        <TabsContent value="info" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Outras Informações</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="competenceDate">Data de Competência</Label>
                <Input
                  id="competenceDate"
                  type="date"
                  value={competenceDate}
                  onChange={(e) => setCompetenceDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="notes">Observações</Label>
                <Textarea
                  id="notes"
                  placeholder="Informações adicionais sobre este lançamento..."
                  rows={5}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ABA 3 — Anexos */}
        <TabsContent value="attachments" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Anexos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center">
                <Upload className="h-10 w-10 text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground font-medium">Em breve</p>
                <p className="text-sm text-muted-foreground">Upload de comprovantes e documentos estará disponível em breve.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Botões fixos */}
      <div className="flex justify-between items-center pt-4 border-t">
        <Button variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          Voltar
        </Button>
        <Button onClick={handleSubmit} disabled={isSubmitting || !description.trim() || gross <= 0 || !financialAccountId || !category} className="gap-2">
          <Save className="h-4 w-4" />
          {isSubmitting ? "Salvando..." : isEditing ? "Salvar alterações" : "Salvar conta a pagar"}
        </Button>
      </div>
    </div>
  );
}
