import { useEffect, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { Client, ClientFormData } from "@/hooks/useClients";
import { fetchAddressByCep, formatCep } from "@/lib/viaCep";
import { fetchCnpjData, formatCnpj, formatCpf } from "@/lib/cnpjApi";
import { toast } from "sonner";

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO"
];

const clientSchema = z.object({
  person_type: z.enum(["pf", "pj"]),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  phone: z.string().min(10, "Telefone deve ter pelo menos 10 dígitos"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  document: z.string().optional(),
  whatsapp: z.string().optional(),
  company_name: z.string().optional(),
  trade_name: z.string().optional(),
  contact_name: z.string().optional(),
  client_type: z.string().optional(),
  zip_code: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  notes: z.string().optional(),
});

interface ClientFormProps {
  client?: Client | null;
  onSubmit: (data: ClientFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function ClientForm({ client, onSubmit, onCancel, isSubmitting }: ClientFormProps) {
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [isSearchingCnpj, setIsSearchingCnpj] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    formState: { errors },
  } = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      person_type: client?.person_type === "pj" ? "pj" : "pf",
      name: client?.name ?? "",
      phone: client?.phone ?? "",
      email: client?.email ?? "",
      document: client?.document ?? "",
      whatsapp: client?.whatsapp ?? "",
      company_name: client?.company_name ?? "",
      trade_name: client?.trade_name ?? "",
      contact_name: client?.contact_name ?? "",
      client_type: client?.client_type ?? "",
      zip_code: client?.zip_code ?? "",
      street: client?.street ?? "",
      number: client?.number ?? "",
      complement: client?.complement ?? "",
      neighborhood: client?.neighborhood ?? "",
      city: client?.city ?? "",
      state: client?.state ?? "",
      notes: client?.notes ?? "",
    },
  });

  const personType = watch("person_type");
  const zipCode = watch("zip_code");
  const documentValue = watch("document");

  // CEP auto-fill
  useEffect(() => {
    const cleanCep = (zipCode || "").replace(/\D/g, "");
    if (cleanCep.length === 8) {
      setIsSearchingCep(true);
      fetchAddressByCep(cleanCep).then((addr) => {
        if (addr) {
          setValue("street", addr.logradouro);
          setValue("neighborhood", addr.bairro);
          setValue("city", addr.localidade);
          setValue("state", addr.uf);
          if (addr.complemento) setValue("complement", addr.complemento);
        } else {
          toast.warning("CEP não encontrado. Verifique e tente novamente.");
        }
      }).catch(() => {
        toast.error("Erro ao buscar CEP. Tente novamente.");
      }).finally(() => setIsSearchingCep(false));
    }
  }, [zipCode, setValue]);

  // CNPJ auto-fill
  useEffect(() => {
    const cleanDoc = (documentValue || "").replace(/\D/g, "");
    if (personType === "pj" && cleanDoc.length === 14) {
      setIsSearchingCnpj(true);
      fetchCnpjData(cleanDoc).then((data) => {
        if (data) {
          setValue("company_name", data.nome);
          setValue("trade_name", data.fantasia);
          if (data.logradouro) setValue("street", data.logradouro);
          if (data.numero) setValue("number", data.numero);
          if (data.complemento) setValue("complement", data.complemento);
          if (data.bairro) setValue("neighborhood", data.bairro);
          if (data.municipio) setValue("city", data.municipio);
          if (data.uf) setValue("state", data.uf);
          if (data.cep) setValue("zip_code", formatCep(data.cep));
        } else {
          toast.warning("CNPJ não encontrado. Verifique e tente novamente.");
        }
      }).catch(() => {
        toast.error("Erro ao buscar CNPJ. Tente novamente.");
      }).finally(() => setIsSearchingCnpj(false));
    }
  }, [documentValue, personType, setValue]);

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue("zip_code", formatCep(e.target.value));
  };

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = personType === "pj" ? formatCnpj(e.target.value) : formatCpf(e.target.value);
    setValue("document", formatted);
  };

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
      {/* Toggle PF / PJ */}
      <Tabs
        value={personType}
        onValueChange={(v) => setValue("person_type", v as "pf" | "pj")}
        className="w-full"
      >
        <TabsList className="w-full">
          <TabsTrigger value="pf" className="flex-1">Pessoa Física (PF)</TabsTrigger>
          <TabsTrigger value="pj" className="flex-1">Pessoa Jurídica (PJ)</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ── Dados Principais ── */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Dados Principais</Label>
        <Separator />

        {personType === "pj" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="document">CNPJ</Label>
              <div className="relative">
                <Input
                  id="document"
                  placeholder="00.000.000/0000-00"
                  maxLength={18}
                  value={documentValue || ""}
                  onChange={handleDocumentChange}
                />
                {isSearchingCnpj && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_name">Razão Social</Label>
              <Input id="company_name" placeholder="Razão Social" {...register("company_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="trade_name">Nome Fantasia</Label>
              <Input id="trade_name" placeholder="Nome Fantasia" {...register("trade_name")} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact_name">Responsável</Label>
              <Input id="contact_name" placeholder="Nome do responsável" {...register("contact_name")} />
            </div>
          </>
        )}

        <div className="space-y-2">
          <Label htmlFor="name">{personType === "pf" ? "Nome Completo *" : "Nome para exibição *"}</Label>
          <Input id="name" placeholder="Nome" {...register("name")} />
          {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
        </div>

        {personType === "pf" && (
          <>
            <div className="space-y-2">
              <Label htmlFor="document">CPF</Label>
              <Input
                id="document"
                placeholder="000.000.000-00"
                maxLength={14}
                value={documentValue || ""}
                onChange={handleDocumentChange}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_type">Tipo do Cliente</Label>
              <Controller
                name="client_type"
                control={control}
                render={({ field }) => (
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="residential">Residencial</SelectItem>
                      <SelectItem value="commercial">Comercial</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </>
        )}
      </div>

      {/* ── Contato ── */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Contato</Label>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone *</Label>
          <Input id="phone" placeholder="(00) 00000-0000" {...register("phone")} />
          {errors.phone && <p className="text-sm text-destructive">{errors.phone.message}</p>}
        </div>
        {personType === "pf" && (
          <div className="space-y-2">
            <Label htmlFor="whatsapp">WhatsApp</Label>
            <Input id="whatsapp" placeholder="(00) 00000-0000" {...register("whatsapp")} />
          </div>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="email@exemplo.com" {...register("email")} />
          {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
        </div>
      </div>

      {/* ── Endereço ── */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Endereço</Label>
        <Separator />
        <div className="space-y-2">
          <Label htmlFor="zip_code">CEP</Label>
          <div className="relative">
            <Input
              id="zip_code"
              placeholder="00000-000"
              maxLength={9}
              value={zipCode || ""}
              onChange={handleCepChange}
            />
            {isSearchingCep && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-[1fr,100px] gap-3">
          <div className="space-y-2">
            <Label htmlFor="street">Rua</Label>
            <Input id="street" placeholder="Rua, Avenida..." {...register("street")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="number">Nº</Label>
            <Input id="number" placeholder="123" {...register("number")} />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="complement">Complemento</Label>
          <Input id="complement" placeholder="Apt, Bloco..." {...register("complement")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input id="neighborhood" placeholder="Bairro" {...register("neighborhood")} />
        </div>
        <div className="grid grid-cols-[1fr,100px] gap-3">
          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input id="city" placeholder="Cidade" {...register("city")} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="state">Estado</Label>
            <Controller
              name="state"
              control={control}
              render={({ field }) => (
                <Select value={field.value || ""} onValueChange={field.onChange}>
                  <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    {BRAZILIAN_STATES.map((uf) => (
                      <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
      </div>

      {/* ── Observações ── */}
      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea id="notes" placeholder="Notas adicionais" rows={2} {...register("notes")} />
      </div>

      {/* ── Ações ── */}
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {client ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
