import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, ArrowRight, Sparkles, MessageCircle } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/hooks/useAuth";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface OnboardingCompanyStepProps {
  onNext: () => void;
}

export function OnboardingCompanyStep({ onNext }: OnboardingCompanyStepProps) {
  const { organization, update, isUpdating } = useOrganization();
  const { user, profile } = useAuth();
  const { sensitiveData } = useProfileSensitiveData();

  const hasWhatsappPersonal = !!profile?.phone;

  const [formData, setFormData] = useState({
    name: organization?.name || "",
    phone: organization?.phone || "",
    personalWhatsapp: "",
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return formatted;
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ variant: "destructive", title: "Campo obrigatório", description: "Informe o nome da empresa" });
      return;
    }
    if (formData.phone.replace(/\D/g, "").length < 10) {
      toast({ variant: "destructive", title: "Campo obrigatório", description: "Informe o WhatsApp da empresa (mín. 10 dígitos)" });
      return;
    }

    // If personal WhatsApp is missing, require it
    if (!hasWhatsappPersonal) {
      const personalDigits = formData.personalWhatsapp.replace(/\D/g, "");
      if (personalDigits.length < 10) {
        toast({ variant: "destructive", title: "WhatsApp pessoal obrigatório", description: "Informe seu WhatsApp pessoal com DDD" });
        return;
      }
    }

    update({ name: formData.name, phone: formData.phone }, {
      onSuccess: async () => {
        const trimmedPhone = formData.phone.trim();
        if (user) {
          // Save company phone to org whatsapp_owner
          const updateData: Record<string, string> = {};

          // If user has no phone, save the one they just entered
          if (!hasWhatsappPersonal) {
            let personalDigits = formData.personalWhatsapp.replace(/\D/g, "");
            if (!personalDigits.startsWith("55") && personalDigits.length <= 11) {
              personalDigits = "55" + personalDigits;
            }
            updateData.phone = personalDigits;
            updateData.whatsapp_ai_enabled = "true";
          }

          await supabase
            .from("profiles")
            .update(updateData)
            .eq("user_id", user.id);
        }
        onNext();
      },
    });
  };

  return (
    <Card className="border-0 shadow-none">
      <CardContent className="p-0 space-y-6">
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground">Vamos criar sua empresa agora</h2>
          <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
            Só {hasWhatsappPersonal ? "2" : "3"} informações e você já começa a usar de verdade.
          </p>
        </div>

        <div className="space-y-4 max-w-md mx-auto">
          {/* Personal WhatsApp — only shown if missing (Google OAuth users) */}
          {!hasWhatsappPersonal && (
            <div className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-2">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <Label htmlFor="personal-whatsapp" className="font-semibold text-foreground">Seu WhatsApp pessoal</Label>
              </div>
              <Input 
                id="personal-whatsapp" 
                type="tel"
                inputMode="numeric"
                value={formData.personalWhatsapp} 
                onChange={(e) => handleChange("personalWhatsapp", formatPhone(e.target.value))} 
                placeholder="(11) 99999-9999"
                className="text-base h-12"
                autoFocus
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Usado para notificações, alertas e automações da Tecvo diretamente para você.
              </p>
            </div>
          )}

          <div>
            <Label htmlFor="name">Nome da Empresa</Label>
            <Input 
              id="name" 
              value={formData.name} 
              onChange={(e) => handleChange("name", e.target.value)} 
              placeholder="Ex: Clima Frio Refrigeração"
              className="text-base h-12"
              autoFocus={hasWhatsappPersonal}
            />
          </div>

          <div>
            <Label htmlFor="phone">WhatsApp da Empresa</Label>
            <Input 
              id="phone" 
              type="tel"
              inputMode="numeric"
              value={formData.phone} 
              onChange={(e) => handleChange("phone", e.target.value)} 
              placeholder="(00) 00000-0000"
              className="text-base h-12"
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              Usado para comunicação com seus clientes e notificações.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 justify-center text-xs text-muted-foreground bg-muted/50 rounded-lg py-3 px-4">
          <Sparkles className="h-4 w-4 text-primary shrink-0" />
          <span>CNPJ, endereço e logo podem ser adicionados depois em Configurações.</span>
        </div>

        <div className="flex justify-center pt-2">
          <Button
            onClick={handleSubmit}
            disabled={isUpdating}
            size="lg"
            className="min-w-[240px]"
          >
            {isUpdating ? "Salvando..." : "Começar a usar"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
