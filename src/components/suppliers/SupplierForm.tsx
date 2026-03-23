import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState } from "react";
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
import { type Supplier, type SupplierFormData, SUPPLIER_CATEGORIES } from "@/hooks/useSuppliers";
import { fetchAddressByCep } from "@/lib/viaCep";

const supplierSchema = z.object({
  name: z.string().min(2, "Nome é obrigatório"),
  phone: z.string().min(10, "Telefone inválido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cnpj_cpf: z.string().optional(),
  zip_code: z.string().optional(),
  street: z.string().optional(),
  number: z.string().optional(),
  complement: z.string().optional(),
  neighborhood: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
});

interface SupplierFormProps {
  supplier?: Supplier | null;
  onSubmit: (data: SupplierFormData) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

export function SupplierForm({
  supplier,
  onSubmit,
  onCancel,
  isSubmitting,
}: SupplierFormProps) {
  const [isLoadingCep, setIsLoadingCep] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      name: supplier?.name ?? "",
      phone: supplier?.phone ?? "",
      email: supplier?.email ?? "",
      cnpj_cpf: supplier?.cnpj_cpf ?? "",
      zip_code: supplier?.zip_code ?? "",
      street: supplier?.street ?? "",
      number: supplier?.number ?? "",
      complement: supplier?.complement ?? "",
      neighborhood: supplier?.neighborhood ?? "",
      city: supplier?.city ?? "",
      state: supplier?.state ?? "",
      category: supplier?.category ?? "",
      notes: supplier?.notes ?? "",
    },
  });

  const handleCepBlur = async (e: React.FocusEvent<HTMLInputElement>) => {
    const cep = e.target.value.replace(/\D/g, "");
    if (cep.length === 8) {
      setIsLoadingCep(true);
      const address = await fetchAddressByCep(cep);
      if (address) {
        setValue("street", address.logradouro);
        setValue("neighborhood", address.bairro);
        setValue("city", address.localidade);
        setValue("state", address.uf);
      }
      setIsLoadingCep(false);
    }
  };

  const handleFormSubmit = async (formData: Record<string, unknown>) => {
    const data: SupplierFormData = {
      name: formData.name as string,
      phone: formData.phone as string,
      email: formData.email as string || undefined,
      cnpj_cpf: formData.cnpj_cpf as string || undefined,
      zip_code: formData.zip_code as string || undefined,
      street: formData.street as string || undefined,
      number: formData.number as string || undefined,
      complement: formData.complement as string || undefined,
      neighborhood: formData.neighborhood as string || undefined,
      city: formData.city as string || undefined,
      state: formData.state as string || undefined,
      category: formData.category as string || undefined,
      notes: formData.notes as string || undefined,
    };
    await onSubmit(data);
  };

  const selectedCategory = watch("category");

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Nome *</Label>
        <Input
          id="name"
          placeholder="Nome do fornecedor"
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="phone">Telefone *</Label>
          <Input
            id="phone"
            placeholder="(00) 00000-0000"
            {...register("phone")}
          />
          {errors.phone && (
            <p className="text-sm text-destructive">{errors.phone.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="email@exemplo.com"
            {...register("email")}
          />
          {errors.email && (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cnpj_cpf">CNPJ/CPF</Label>
          <Input
            id="cnpj_cpf"
            placeholder="00.000.000/0000-00"
            {...register("cnpj_cpf")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="category">Categoria</Label>
          <Select
            value={selectedCategory}
            onValueChange={(value) => setValue("category", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {SUPPLIER_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="zip_code">CEP</Label>
          <Input
            id="zip_code"
            placeholder="00000-000"
            {...register("zip_code")}
            onBlur={handleCepBlur}
            disabled={isLoadingCep}
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="street">Rua</Label>
          <Input
            id="street"
            placeholder="Rua, Avenida..."
            {...register("street")}
            disabled={isLoadingCep}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="number">Número</Label>
          <Input
            id="number"
            placeholder="123"
            {...register("number")}
          />
        </div>

        <div className="col-span-2 space-y-2">
          <Label htmlFor="complement">Complemento</Label>
          <Input
            id="complement"
            placeholder="Apto, Sala..."
            {...register("complement")}
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            {...register("neighborhood")}
            disabled={isLoadingCep}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">Cidade</Label>
          <Input
            id="city"
            {...register("city")}
            disabled={isLoadingCep}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="state">Estado</Label>
          <Input
            id="state"
            placeholder="SP"
            maxLength={2}
            {...register("state")}
            disabled={isLoadingCep}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Observações</Label>
        <Textarea
          id="notes"
          placeholder="Informações adicionais..."
          rows={3}
          {...register("notes")}
        />
      </div>

      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
          Cancelar
        </Button>
        <Button type="submit" disabled={isSubmitting} className="flex-1">
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {supplier ? "Salvar" : "Cadastrar"}
        </Button>
      </div>
    </form>
  );
}
