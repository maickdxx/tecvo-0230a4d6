import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Search } from "lucide-react";
import { fetchAddressByCep, formatCep } from "@/lib/viaCep";
import { fetchCnpjData, formatCnpj, formatCpf } from "@/lib/cnpjApi";
import { toast } from "sonner";
import type { Client, ClientFormData } from "@/hooks/useClients";

const baseSchema = z.object({
  person_type: z.enum(["pf", "pj"]),
  name: z.string().optional(),
  document: z.string().optional(),
  company_name: z.string().optional(),
  trade_name: z.string().optional(),
  state_registration: z.string().optional(),
  contact_name: z.string().optional(),
  phone: z.string().min(1, "Telefone é obrigatório"),
  whatsapp: z.string().optional(),
  email: z.string().optional(),
  zip_code: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  client_origin: z.string().optional(),
  client_type: z.string().optional(),
  client_status: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
});

type FormValues = z.infer<typeof baseSchema>;

interface Props {
  client?: Client | null;
  onSubmit: (data: ClientFormData) => Promise<void>;
  isSubmitting: boolean;
  onCancel: () => void;
  inline?: boolean;
}

export function ClientFullForm({ client, onSubmit, isSubmitting, onCancel, inline = false }: Props) {
  const [personType, setPersonType] = useState<"pf" | "pj">(client?.person_type === "pj" ? "pj" : "pf");
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(baseSchema),
    defaultValues: {
      person_type: client?.person_type === "pj" ? "pj" : "pf",
      name: client?.name ?? "",
      document: client?.document ?? "",
      company_name: client?.company_name ?? "",
      trade_name: client?.trade_name ?? "",
      state_registration: client?.state_registration ?? "",
      contact_name: client?.contact_name ?? "",
      phone: client?.phone ?? "",
      whatsapp: (client as any)?.whatsapp ?? "",
      email: client?.email ?? "",
      zip_code: client?.zip_code ?? "",
      street: client?.street ?? "",
      number: client?.number ?? "",
      complement: client?.complement ?? "",
      neighborhood: client?.neighborhood ?? "",
      city: client?.city ?? "",
      state: client?.state ?? "",
      client_origin: (client as any)?.client_origin ?? "",
      client_type: (client as any)?.client_type ?? "",
      client_status: (client as any)?.client_status ?? "active",
      notes: client?.notes ?? "",
      internal_notes: (client as any)?.internal_notes ?? "",
    },
  });

  const { register, handleSubmit, setValue, watch, getValues, formState: { errors } } = form;

  const docField = register("document");
  const cepField = register("zip_code");

  useEffect(() => {
    setValue("person_type", personType);
  }, [personType, setValue]);

  const handleCepBlur = useCallback(async () => {
    const cep = getValues("zip_code") ?? "";
    if (cep.replace(/\D/g, "").length !== 8) return;
    setLoadingCep(true);
    try {
      const data = await fetchAddressByCep(cep);
      if (data) {
        setValue("street", data.logradouro, { shouldValidate: true });
        setValue("neighborhood", data.bairro, { shouldValidate: true });
        setValue("city", data.localidade, { shouldValidate: true });
        setValue("state", data.uf, { shouldValidate: true });
      } else {
        toast.warning("CEP não encontrado. Verifique e tente novamente.");
      }
    } catch {
      toast.error("Erro ao buscar CEP. Tente novamente.");
    }
    setLoadingCep(false);
  }, [getValues, setValue]);

  const handleCnpjBlur = useCallback(async () => {
    const cnpj = getValues("document") ?? "";
    if (cnpj.replace(/\D/g, "").length !== 14) return;
    setLoadingCnpj(true);
    try {
      const data = await fetchCnpjData(cnpj);
      if (data) {
        setValue("company_name", data.nome, { shouldValidate: true });
        setValue("trade_name", data.fantasia, { shouldValidate: true });
        if (data.logradouro) setValue("street", data.logradouro, { shouldValidate: true });
        if (data.numero) setValue("number", data.numero, { shouldValidate: true });
        if (data.complemento) setValue("complement", data.complemento, { shouldValidate: true });
        if (data.bairro) setValue("neighborhood", data.bairro, { shouldValidate: true });
        if (data.municipio) setValue("city", data.municipio, { shouldValidate: true });
        if (data.uf) setValue("state", data.uf, { shouldValidate: true });
        if (data.cep) setValue("zip_code", formatCep(data.cep), { shouldValidate: true });
      } else {
        toast.warning("CNPJ não encontrado. Verifique e tente novamente.");
      }
    } catch {
      toast.error("Erro ao buscar CNPJ. Tente novamente.");
    }
    setLoadingCnpj(false);
  }, [getValues, setValue]);

  const onFormSubmit = (values: FormValues) => {
    const formData: ClientFormData = {
      person_type: values.person_type,
      name: values.person_type === "pf" ? (values.name ?? "") : (values.company_name ?? values.trade_name ?? ""),
      document: values.document,
      company_name: values.company_name,
      trade_name: values.trade_name,
      state_registration: values.state_registration,
      contact_name: values.contact_name,
      phone: values.phone,
      whatsapp: values.whatsapp,
      email: values.email,
      zip_code: values.zip_code,
      street: values.street,
      number: values.number,
      complement: values.complement,
      neighborhood: values.neighborhood,
      city: values.city,
      state: values.state,
      client_origin: values.client_origin,
      client_type: values.client_type,
      client_status: values.client_status || "active",
      notes: values.notes,
      internal_notes: values.internal_notes,
    };
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6 pb-24">
      {/* Tipo de Pessoa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Tipo de Pessoa</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={personType} onValueChange={(v) => setPersonType(v as "pf" | "pj")}>
            <TabsList className="w-full">
              <TabsTrigger value="pf" className="flex-1">Pessoa Física (PF)</TabsTrigger>
              <TabsTrigger value="pj" className="flex-1">Pessoa Jurídica (PJ)</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      {/* Dados Principais */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Dados Principais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {personType === "pf" ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input id="name" {...register("name")} placeholder="Nome completo do cliente" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="document">CPF</Label>
                <Input
                  id="document"
                  {...docField}
                  placeholder="000.000.000-00"
                  maxLength={14}
                  onChange={(e) => setValue("document", formatCpf(e.target.value), { shouldValidate: true })}
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="document">CNPJ *</Label>
                <div className="relative">
                  <Input
                    id="document"
                    {...docField}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    onChange={(e) => setValue("document", formatCnpj(e.target.value), { shouldValidate: true })}
                    onBlur={(e) => { docField.onBlur(e); handleCnpjBlur(); }}
                  />
                  {loadingCnpj && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="company_name">Razão Social *</Label>
                <Input id="company_name" {...register("company_name")} placeholder="Razão social" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trade_name">Nome Fantasia</Label>
                <Input id="trade_name" {...register("trade_name")} placeholder="Nome fantasia" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="state_registration">Inscrição Estadual</Label>
                  <Input id="state_registration" {...register("state_registration")} placeholder="Opcional" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_name">Responsável / Contato</Label>
                  <Input id="contact_name" {...register("contact_name")} placeholder="Nome do responsável" />
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Contato */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contato</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone Principal *</Label>
              <Input id="phone" {...register("phone")} placeholder="(00) 00000-0000" />
              {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="whatsapp">WhatsApp</Label>
              <Input id="whatsapp" {...register("whatsapp")} placeholder="(00) 00000-0000" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" {...register("email")} placeholder="email@exemplo.com" />
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Endereço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="zip_code">CEP</Label>
            <div className="relative">
              <Input
                id="zip_code"
                {...cepField}
                placeholder="00000-000"
                maxLength={9}
                onChange={(e) => setValue("zip_code", formatCep(e.target.value), { shouldValidate: true })}
                onBlur={(e) => { cepField.onBlur(e); handleCepBlur(); }}
              />
              {loadingCep && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-2">
              <Label htmlFor="street">Rua</Label>
              <Input id="street" {...register("street")} placeholder="Rua / Avenida" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="number">Número</Label>
              <Input id="number" {...register("number")} placeholder="Nº" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="complement">Complemento</Label>
              <Input id="complement" {...register("complement")} placeholder="Apto, Sala, etc." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input id="neighborhood" {...register("neighborhood")} placeholder="Bairro" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" {...register("city")} placeholder="Cidade" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Input id="state" {...register("state")} placeholder="UF" maxLength={2} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Informações Extras */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Informações Extras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Origem do Cliente</Label>
              <Select value={watch("client_origin") || ""} onValueChange={(v) => setValue("client_origin", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indicacao">Indicação</SelectItem>
                  <SelectItem value="google">Google</SelectItem>
                  <SelectItem value="instagram">Instagram</SelectItem>
                  <SelectItem value="facebook">Facebook</SelectItem>
                  <SelectItem value="site">Site</SelectItem>
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Tipo de Cliente</Label>
              <Select value={watch("client_type") || ""} onValueChange={(v) => setValue("client_type", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="residencial">Residencial</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={watch("client_status") || "active"} onValueChange={(v) => setValue("client_status", v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="inactive">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea id="notes" {...register("notes")} placeholder="Observações gerais sobre o cliente" rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internal_notes">Observações Internas</Label>
            <Textarea id="internal_notes" {...register("internal_notes")} placeholder="Notas internas (não visíveis ao cliente)" rows={3} />
          </div>
        </CardContent>
      </Card>

      {/* Botões */}
      <div className={inline ? "border-t border-border pt-4 flex justify-end gap-3" : "fixed bottom-0 left-0 right-0 bg-background border-t p-4 flex justify-end gap-3 z-50"}>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
