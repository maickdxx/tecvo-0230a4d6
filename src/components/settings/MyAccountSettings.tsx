import { useState, useEffect } from "react";
import { ArrowLeft, User, MessageCircle, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useProfile } from "@/hooks/useProfile";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";

interface MyAccountSettingsProps {
  onBack: () => void;
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length > 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return digits;
};

export function MyAccountSettings({ onBack }: MyAccountSettingsProps) {
  const { profile, updateProfile, isUpdating } = useProfile();
  const { sensitiveData } = useProfileSensitiveData();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappPersonal, setWhatsappPersonal] = useState("");
  const [position, setPosition] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setPosition(profile.position || "");
      setWhatsappPersonal(sensitiveData?.whatsapp_personal || "");
    }
  }, [profile, sensitiveData]);

  const handleSave = () => {
    if (!fullName.trim()) return;
    updateProfile({
      fullName: fullName.trim(),
      phone: phone.trim(),
      position: position.trim(),
      whatsappPersonal: whatsappPersonal.trim(),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Minha Conta</h2>
          <p className="text-sm text-muted-foreground">Suas informações pessoais</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>Nome e telefone de contato</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo *</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Celular / WhatsApp</Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(11) 99999-9999"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5 text-primary" />
            Cargo / Função
          </CardTitle>
          <CardDescription>
            Identificação usada no atendimento e na assinatura de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="position">Sua função na empresa</Label>
            <Select value={position} onValueChange={setPosition}>
              <SelectTrigger id="position">
                <SelectValue placeholder="Selecione sua função" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tecnico">Técnico</SelectItem>
                <SelectItem value="atendimento">Atendimento</SelectItem>
                <SelectItem value="administrativo">Administrativo</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="proprietario">Proprietário</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Aparece na assinatura de mensagens do WhatsApp e na identificação de atendimentos.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-primary" />
            WhatsApp Pessoal
          </CardTitle>
          <CardDescription>
            Número usado pela IA para reconhecer suas mensagens e para assinatura automática no atendimento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="whatsappPersonal">Seu WhatsApp pessoal</Label>
            <Input
              id="whatsappPersonal"
              type="tel"
              value={whatsappPersonal}
              onChange={(e) => setWhatsappPersonal(formatPhone(e.target.value))}
              placeholder="(11) 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Opcional — informe apenas se for diferente do telefone acima. É usado para que a IA identifique suas mensagens e para assinar automaticamente respostas no WhatsApp.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={isUpdating || !fullName.trim()}
          className="flex-1"
        >
          {isUpdating ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
  );
}
