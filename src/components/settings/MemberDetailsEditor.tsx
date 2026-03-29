import { useState, useEffect } from "react";
import { Briefcase, CreditCard, Calendar, MapPin, StickyNote, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { useTeamMembers } from "@/hooks/useTeamMembers";

interface MemberDetailsEditorProps {
  userId: string;
}

export function MemberDetailsEditor({ userId }: MemberDetailsEditorProps) {
  const { sensitiveData, isLoading: isLoadingData } = useProfileSensitiveData(userId);
  const { updateMemberDetails, isUpdatingDetails } = useTeamMembers();

  const [details, setDetails] = useState({
    position: "",
    cpf: "",
    rg: "",
    hire_date: "",
    employee_type: "clt",
    hourly_rate: "",
    address_cep: "",
    address_street: "",
    address_number: "",
    address_neighborhood: "",
    address_city: "",
    address_state: "",
    notes: "",
  });

  useEffect(() => {
    if (sensitiveData) {
      setDetails({
        position: sensitiveData.position || "",
        cpf: sensitiveData.cpf || "",
        rg: sensitiveData.rg || "",
        hire_date: sensitiveData.hire_date || "",
        employee_type: sensitiveData.employee_type || "clt",
        hourly_rate: sensitiveData.hourly_rate ? String(sensitiveData.hourly_rate) : "",
        address_cep: sensitiveData.address_cep || "",
        address_street: sensitiveData.address_street || "",
        address_number: sensitiveData.address_number || "",
        address_neighborhood: sensitiveData.address_neighborhood || "",
        address_city: sensitiveData.address_city || "",
        address_state: sensitiveData.address_state || "",
        notes: sensitiveData.notes || "",
      });
    }
  }, [sensitiveData]);

  const handleSave = () => {
    updateMemberDetails({
      userId,
      details: {
        ...details,
        hourly_rate: details.hourly_rate ? Number(details.hourly_rate) : null,
        hire_date: details.hire_date || null,
      },
    });
  };

  if (isLoadingData) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card className="mt-3 border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-primary" />
          Dados Administrativos / RH
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cargo e Contratação */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="position">Cargo Oficial</Label>
            <Input
              id="position"
              value={details.position}
              onChange={(e) => setDetails(prev => ({ ...prev, position: e.target.value }))}
              placeholder="Ex: Técnico de Campo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="employee_type">Tipo de Contrato</Label>
            <Select 
              value={details.employee_type} 
              onValueChange={(v) => setDetails(prev => ({ ...prev, employee_type: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="clt">CLT</SelectItem>
                <SelectItem value="pj">PJ (MEI/Empresa)</SelectItem>
                <SelectItem value="freelancer">Autônomo / Freelancer</SelectItem>
                <SelectItem value="intern">Estagiário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="hire_date">Data de Admissão</Label>
            <Input
              id="hire_date"
              type="date"
              value={details.hire_date}
              onChange={(e) => setDetails(prev => ({ ...prev, hire_date: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hourly_rate">Valor Hora (R$)</Label>
            <Input
              id="hourly_rate"
              type="number"
              value={details.hourly_rate}
              onChange={(e) => setDetails(prev => ({ ...prev, hourly_rate: e.target.value }))}
              placeholder="0.00"
            />
          </div>
        </div>

        {/* Documentos */}
        <div className="grid gap-4 sm:grid-cols-2 pt-2">
          <div className="space-y-2">
            <Label htmlFor="cpf">CPF</Label>
            <Input
              id="cpf"
              value={details.cpf}
              onChange={(e) => setDetails(prev => ({ ...prev, cpf: e.target.value }))}
              placeholder="000.000.000-00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rg">RG</Label>
            <Input
              id="rg"
              value={details.rg}
              onChange={(e) => setDetails(prev => ({ ...prev, rg: e.target.value }))}
              placeholder="00.000.000-0"
            />
          </div>
        </div>

        {/* Endereço */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <MapPin className="h-3 w-3" />
            Endereço Residencial
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="address_cep">CEP</Label>
              <Input
                id="address_cep"
                value={details.address_cep}
                onChange={(e) => setDetails(prev => ({ ...prev, address_cep: e.target.value }))}
                placeholder="00000-000"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="address_street">Rua / Logradouro</Label>
              <Input
                id="address_street"
                value={details.address_street}
                onChange={(e) => setDetails(prev => ({ ...prev, address_street: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_number">Número</Label>
              <Input
                id="address_number"
                value={details.address_number}
                onChange={(e) => setDetails(prev => ({ ...prev, address_number: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_neighborhood">Bairro</Label>
              <Input
                id="address_neighborhood"
                value={details.address_neighborhood}
                onChange={(e) => setDetails(prev => ({ ...prev, address_neighborhood: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address_city">Cidade</Label>
              <Input
                id="address_city"
                value={details.address_city}
                onChange={(e) => setDetails(prev => ({ ...prev, address_city: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="space-y-2 pt-2">
          <Label htmlFor="notes" className="flex items-center gap-2">
            <StickyNote className="h-4 w-4 text-muted-foreground" />
            Observações Internas
          </Label>
          <Textarea
            id="notes"
            value={details.notes}
            onChange={(e) => setDetails(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Anotações sobre o colaborador..."
            className="min-h-[100px]"
          />
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={isUpdatingDetails} size="sm">
            {isUpdatingDetails ? (
              <>
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1" />
                Salvar Dados RH
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
