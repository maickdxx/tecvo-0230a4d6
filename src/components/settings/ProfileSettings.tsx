import { useState, useEffect, useRef } from "react";
import { getTimezoneByState } from "@/lib/timezoneUtils";
import { Upload, X, Building2, MapPin, ArrowLeft, Target } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { useOrganization, type OrganizationUpdate } from "@/hooks/useOrganization";

const BRAZILIAN_STATES = [
  { value: "AC", label: "Acre" },
  { value: "AL", label: "Alagoas" },
  { value: "AP", label: "Amapá" },
  { value: "AM", label: "Amazonas" },
  { value: "BA", label: "Bahia" },
  { value: "CE", label: "Ceará" },
  { value: "DF", label: "Distrito Federal" },
  { value: "ES", label: "Espírito Santo" },
  { value: "GO", label: "Goiás" },
  { value: "MA", label: "Maranhão" },
  { value: "MT", label: "Mato Grosso" },
  { value: "MS", label: "Mato Grosso do Sul" },
  { value: "MG", label: "Minas Gerais" },
  { value: "PA", label: "Pará" },
  { value: "PB", label: "Paraíba" },
  { value: "PR", label: "Paraná" },
  { value: "PE", label: "Pernambuco" },
  { value: "PI", label: "Piauí" },
  { value: "RJ", label: "Rio de Janeiro" },
  { value: "RN", label: "Rio Grande do Norte" },
  { value: "RS", label: "Rio Grande do Sul" },
  { value: "RO", label: "Rondônia" },
  { value: "RR", label: "Roraima" },
  { value: "SC", label: "Santa Catarina" },
  { value: "SP", label: "São Paulo" },
  { value: "SE", label: "Sergipe" },
  { value: "TO", label: "Tocantins" },
];

interface ProfileSettingsProps {
  onBack: () => void;
}

export function ProfileSettings({ onBack }: ProfileSettingsProps) {
  const {
    organization,
    isLoading,
    update,
    isUpdating,
    uploadLogo,
    isUploadingLogo,
    removeLogo,
    isRemovingLogo,
  } = useOrganization();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: "",
    cnpj_cpf: "",
    phone: "",
    email: "",
    website: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    monthly_goal: "",
  });

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        cnpj_cpf: organization.cnpj_cpf || "",
        phone: organization.phone || "",
        email: organization.email || "",
        website: organization.website || "",
        address: organization.address || "",
        city: organization.city || "",
        state: organization.state || "",
        zip_code: organization.zip_code || "",
        monthly_goal: organization.monthly_goal ? String(organization.monthly_goal) : "",
      });
    }
  }, [organization]);

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    const updates: OrganizationUpdate = {
      name: formData.name,
      cnpj_cpf: formData.cnpj_cpf || null,
      phone: formData.phone || null,
      email: formData.email || null,
      website: formData.website || null,
      address: formData.address || null,
      city: formData.city || null,
      state: formData.state || null,
      zip_code: formData.zip_code || null,
      monthly_goal: formData.monthly_goal ? Number(formData.monthly_goal) : null,
      timezone: getTimezoneByState(formData.state),
    };
    update(updates);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        alert("O arquivo deve ter no máximo 2MB");
        return;
      }
      if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
        alert("Formato não suportado. Use PNG, JPG ou WebP");
        return;
      }
      uploadLogo(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-muted" />
          <div className="space-y-1.5">
            <div className="h-5 w-40 rounded bg-muted" />
            <div className="h-3 w-56 rounded bg-muted" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-3 w-24 rounded bg-muted" />
              <div className="h-10 w-full rounded-md bg-muted" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Perfil da Empresa</h2>
          <p className="text-sm text-muted-foreground">
            Informações que aparecerão nos orçamentos e ordens de serviço
          </p>
        </div>
      </div>

      {/* Logo Section */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Upload className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">Logo da Empresa</h3>
        </div>

        <div className="flex items-center gap-6">
          {organization?.logo_url ? (
            <div className="relative">
              <img
                src={organization.logo_url}
                alt="Logo da empresa"
                className="h-24 w-24 rounded-lg object-contain border border-border bg-background"
              />
              <Button
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6"
                onClick={() => removeLogo()}
                disabled={isRemovingLogo}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="h-24 w-24 rounded-lg border-2 border-dashed border-border flex items-center justify-center bg-muted/50">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
          )}

          <div className="flex-1">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingLogo}
            >
              {isUploadingLogo ? "Enviando..." : "Fazer upload"}
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              PNG, JPG ou WebP. Máximo 2MB.
            </p>
          </div>
        </div>
      </div>

      {/* Company Data */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Building2 className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">Dados da Empresa</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name">Nome da Empresa *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => handleChange("name", e.target.value)}
              placeholder="Nome fantasia ou razão social"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cnpj_cpf">CNPJ ou CPF</Label>
            <Input
              id="cnpj_cpf"
              value={formData.cnpj_cpf}
              onChange={(e) => handleChange("cnpj_cpf", e.target.value)}
              placeholder="00.000.000/0001-00"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">Telefone / WhatsApp</Label>
            <Input
              id="phone"
              value={formData.phone}
              onChange={(e) => handleChange("phone", e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange("email", e.target.value)}
              placeholder="contato@empresa.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="website">Website (opcional)</Label>
            <Input
              id="website"
              value={formData.website}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="www.empresa.com"
            />
          </div>
        </div>
      </div>

      {/* Monthly Goal */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">Meta Mensal</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Defina quanto sua empresa quer lucrar por mês. Se deixar em branco, o sistema sugere automaticamente com base no histórico.
        </p>
        <div className="space-y-2 max-w-xs">
          <Label htmlFor="monthly_goal">Meta de lucro mensal (R$)</Label>
          <Input
            id="monthly_goal"
            type="number"
            value={formData.monthly_goal}
            onChange={(e) => handleChange("monthly_goal", e.target.value)}
            placeholder="Ex: 20000"
          />
        </div>
      </div>

      {/* Address */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-card-foreground">Endereço</h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="address">Endereço completo</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) => handleChange("address", e.target.value)}
              placeholder="Rua, número, bairro"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city">Cidade</Label>
            <Input
              id="city"
              value={formData.city}
              onChange={(e) => handleChange("city", e.target.value)}
              placeholder="São Paulo"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="state">Estado</Label>
              <Select
                value={formData.state}
                onValueChange={(value) => handleChange("state", value)}
              >
                <SelectTrigger id="state">
                  <SelectValue placeholder="UF" />
                </SelectTrigger>
                <SelectContent>
                  {BRAZILIAN_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip_code">CEP</Label>
              <Input
                id="zip_code"
                value={formData.zip_code}
                onChange={(e) => handleChange("zip_code", e.target.value)}
                placeholder="00000-000"
              />
            </div>
          </div>
        </div>
      </div>

      <Separator />

      {/* Actions */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={isUpdating || !formData.name}
          className="flex-1"
        >
          {isUpdating ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
