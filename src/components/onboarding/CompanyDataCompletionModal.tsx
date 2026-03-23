import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { isOrgDocumentReady, type OrgFieldKey } from "@/lib/isOrgDocumentReady";
import { fetchAddressByCep, formatCep } from "@/lib/viaCep";
import { getTimezoneByState } from "@/lib/timezoneUtils";
import { toast } from "@/hooks/use-toast";

const BRAZILIAN_STATES = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG",
  "PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
];

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function CompanyDataCompletionModal({ open, onClose, onSaved }: Props) {
  const { organization, update, isUpdating } = useOrganization();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    zip_code: "",
    address: "",
    city: "",
    state: "",
  });
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [missingKeys, setMissingKeys] = useState<Set<OrgFieldKey>>(new Set());

  useEffect(() => {
    if (open && organization) {
      const check = isOrgDocumentReady(organization);
      setMissingKeys(new Set(check.missingFields.map((f) => f.key)));
      setFormData({
        name: organization.name || "",
        phone: organization.phone || "",
        zip_code: organization.zip_code ? formatCep(organization.zip_code) : "",
        address: organization.address || "",
        city: organization.city || "",
        state: organization.state || "",
      });
    }
  }, [open, organization]);

  const handleCepChange = async (value: string) => {
    const formatted = formatCep(value);
    setFormData((prev) => ({ ...prev, zip_code: formatted }));

    const clean = formatted.replace(/\D/g, "");
    if (clean.length === 8) {
      setIsFetchingCep(true);
      const result = await fetchAddressByCep(clean);
      setIsFetchingCep(false);
      if (result) {
        setFormData((prev) => ({
          ...prev,
          address: result.logradouro
            ? `${result.logradouro}${result.bairro ? ` - ${result.bairro}` : ""}`
            : prev.address,
          city: result.localidade || prev.city,
          state: result.uf || prev.state,
        }));
      }
    }
  };

  const handleSave = () => {
    // Validate all required fields
    const cleanCep = formData.zip_code.replace(/\D/g, "");
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Nome da empresa obrigatório" });
      return;
    }
    if (!formData.phone.trim()) {
      toast({ variant: "destructive", title: "Telefone obrigatório" });
      return;
    }
    if (cleanCep.length !== 8) {
      toast({ variant: "destructive", title: "CEP inválido", description: "Informe um CEP com 8 dígitos." });
      return;
    }
    if (!formData.address.trim()) {
      toast({ variant: "destructive", title: "Endereço obrigatório" });
      return;
    }
    if (!formData.city.trim()) {
      toast({ variant: "destructive", title: "Cidade obrigatória" });
      return;
    }
    if (!formData.state.trim()) {
      toast({ variant: "destructive", title: "Estado obrigatório" });
      return;
    }

    update(
      {
        name: formData.name,
        phone: formData.phone,
        zip_code: cleanCep,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        timezone: getTimezoneByState(formData.state),
      },
      {
        onSuccess: () => {
          toast({ title: "Dados atualizados!", description: "Agora você pode emitir documentos." });
          onSaved();
        },
      }
    );
  };

  const showField = (key: OrgFieldKey) => missingKeys.has(key);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <div className="rounded-lg bg-primary/10 p-2">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <DialogTitle className="text-lg">Complete os dados da empresa</DialogTitle>
          </div>
          <DialogDescription>
            Essas informações aparecem no cabeçalho das ordens de serviço, orçamentos e laudos. Preencha agora para emitir seu primeiro documento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {showField("name") && (
            <div>
              <Label htmlFor="comp-name">Nome da empresa *</Label>
              <Input
                id="comp-name"
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                placeholder="Minha Empresa"
              />
            </div>
          )}

          {showField("phone") && (
            <div>
              <Label htmlFor="comp-phone">Telefone / WhatsApp *</Label>
              <Input
                id="comp-phone"
                value={formData.phone}
                onChange={(e) => setFormData((p) => ({ ...p, phone: e.target.value }))}
                placeholder="(11) 99999-9999"
              />
            </div>
          )}

          {showField("zip_code") && (
            <div>
              <Label htmlFor="comp-cep">CEP *</Label>
              <div className="relative">
                <Input
                  id="comp-cep"
                  value={formData.zip_code}
                  onChange={(e) => handleCepChange(e.target.value)}
                  placeholder="00000-000"
                  maxLength={9}
                />
                {isFetchingCep && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          )}

          {showField("address") && (
            <div>
              <Label htmlFor="comp-address">Endereço *</Label>
              <Input
                id="comp-address"
                value={formData.address}
                onChange={(e) => setFormData((p) => ({ ...p, address: e.target.value }))}
                placeholder="Rua, número - Bairro"
              />
            </div>
          )}

          {(showField("city") || showField("state")) && (
            <div className="grid grid-cols-2 gap-3">
              {showField("city") && (
                <div>
                  <Label htmlFor="comp-city">Cidade *</Label>
                  <Input
                    id="comp-city"
                    value={formData.city}
                    onChange={(e) => setFormData((p) => ({ ...p, city: e.target.value }))}
                    placeholder="São Paulo"
                  />
                </div>
              )}
              {showField("state") && (
                <div>
                  <Label htmlFor="comp-state">Estado *</Label>
                  <Select
                    value={formData.state}
                    onValueChange={(v) => setFormData((p) => ({ ...p, state: v }))}
                  >
                    <SelectTrigger id="comp-state">
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((uf) => (
                        <SelectItem key={uf} value={uf}>
                          {uf}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          <Button onClick={handleSave} disabled={isUpdating} className="w-full">
            {isUpdating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvando...
              </>
            ) : (
              "Salvar e gerar documento"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
