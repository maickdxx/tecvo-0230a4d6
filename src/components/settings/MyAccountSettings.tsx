import { useState, useEffect, useRef } from "react";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  ArrowLeft, 
  User, 
  MessageCircle, 
  Bot, 
  Palette, 
  Bell, 
  Camera, 
  X, 
  Upload, 
  Check, 
  Sun, 
  Moon, 
  Monitor,
  PenLine
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useProfile } from "@/hooks/useProfile";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { useNotifications } from "@/hooks/useNotifications";
import { useAISettings } from "@/hooks/useAISettings";
import { useTheme } from "next-themes";
import { useColorTheme, type ColorTheme } from "@/hooks/useColorTheme";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface MyAccountSettingsProps {
  onBack: () => void;
}

const formatPhone = (value: string) => {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length > 7) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  if (digits.length > 2) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return digits;
};

const modeOptions = [
  { id: "light", name: "Claro", icon: Sun },
  { id: "dark", name: "Escuro", icon: Moon },
  { id: "system", name: "Sistema", icon: Monitor },
];

const colorThemes: { id: ColorTheme; name: string; hsl: string }[] = [
  { id: "blue", name: "Azul", hsl: "230 72% 52%" },
  { id: "purple", name: "Roxo", hsl: "262 72% 52%" },
  { id: "orange", name: "Laranja", hsl: "24 90% 50%" },
  { id: "green", name: "Verde", hsl: "160 72% 38%" },
];

export function MyAccountSettings({ onBack }: MyAccountSettingsProps) {
  const { profile, updateProfile, isUpdating } = useProfile();
  const { sensitiveData } = useProfileSensitiveData();
  const { preferences, updatePreferences } = useNotifications();
  const { theme, setTheme } = useTheme();
  const { colorTheme, setColorTheme } = useColorTheme();
  const { isOwner } = useUserRole();
  
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsappAiEnabled, setWhatsappAiEnabled] = useState(true);
  const [whatsappSignature, setWhatsappSignature] = useState("");
  const [aiAssistantName, setAiAssistantName] = useState("");
  const [aiAssistantVoice, setAiAssistantVoice] = useState("");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
    if (sensitiveData) {
      setWhatsappAiEnabled(sensitiveData.whatsapp_ai_enabled ?? true);
      setWhatsappSignature(sensitiveData.whatsapp_signature || "");
      setAiAssistantName(sensitiveData.ai_assistant_name || "");
      setAiAssistantVoice(sensitiveData.ai_assistant_voice || "neutral");
    }
  }, [profile, sensitiveData]);

  const handleSave = () => {
    if (!fullName.trim()) return;
    updateProfile({
      fullName: fullName.trim(),
      phone: phone.trim(),
      whatsappAiEnabled,
      whatsappSignature: whatsappSignature.trim(),
      aiAssistantName: aiAssistantName.trim(),
      aiAssistantVoice,
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile?.user_id) return;

    try {
      setIsUploadingAvatar(true);
      const fileExt = file.name.split('.').pop();
      const filePath = `${profile.user_id}/avatar-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl } as any)
        .eq('user_id', profile.user_id);

      if (updateError) throw updateError;

      toast({ title: "Sucesso", description: "Avatar atualizado com sucesso!" });
      window.location.reload();
    } catch (error) {
      console.error('Error uploading avatar:', error);
      toast({ 
        title: "Erro", 
        description: "Não foi possível atualizar o avatar.", 
        variant: "destructive" 
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const removeAvatar = async () => {
    if (!profile?.user_id) return;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null } as any)
        .eq('user_id', profile.user_id);

      if (error) throw error;
      toast({ title: "Sucesso", description: "Avatar removido." });
      window.location.reload();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível remover o avatar.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Meu Perfil</h2>
          <p className="text-sm text-muted-foreground">Sua identidade e preferências pessoais</p>
        </div>
      </div>

      {/* Identidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5 text-primary" />
            Dados Pessoais
          </CardTitle>
          <CardDescription>Como você aparece no sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center gap-6 pb-4 border-b border-border/50">
            <div className="relative group">
              <Avatar className="h-24 w-24 border-2 border-border">
                <AvatarImage src={profile?.avatar_url || ""} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {fullName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full shadow-lg hover:scale-110 transition-transform"
                disabled={isUploadingAvatar}
              >
                <Camera className="h-4 w-4" />
              </button>
              <input 
                ref={fileInputRef}
                type="file" 
                className="hidden" 
                accept="image/*"
                onChange={handleAvatarUpload}
              />
            </div>
            <div className="flex-1 space-y-2">
              <h3 className="font-semibold text-center sm:text-left">Foto de Perfil</h3>
              <p className="text-sm text-muted-foreground text-center sm:text-left">
                Clique no ícone para trocar sua foto de perfil. Formatos aceitos: JPG, PNG.
              </p>
              {profile?.avatar_url && (
                <Button variant="link" size="sm" onClick={removeAvatar} className="text-destructive p-0 h-auto">
                  Remover foto
                </Button>
              )}
            </div>
          </div>

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
              <Label htmlFor="phone">Celular / WhatsApp Pessoal</Label>
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

      {/* Assinatura de Mensagens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <PenLine className="h-5 w-5 text-primary" />
            Assinatura de Mensagens
          </CardTitle>
          <CardDescription>Texto adicionado ao final das comunicações no WhatsApp</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="whatsappSignature">Assinatura personalizada</Label>
            <Input
              id="whatsappSignature"
              value={whatsappSignature}
              onChange={(e) => setWhatsappSignature(e.target.value)}
              placeholder="Ex: Att, João Silva - Técnico Especialista"
            />
            <p className="text-xs text-muted-foreground">
              Esta assinatura é usada para identificar você nas mensagens enviadas aos clientes.
            </p>
          </div>
          <div className="space-y-3 pt-4 border-t border-border/50">
            <p className="text-sm font-medium">Dashboard</p>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                if (confirm("Deseja restaurar a organização padrão das ferramentas no Dashboard?")) {
                  updateProfile({ dashboardLayout: null });
                }
              }}
              className="w-full sm:w-auto"
            >
              Restaurar layout padrão
            </Button>
            <p className="text-xs text-muted-foreground">
              Remove a personalização e volta para a organização padrão dos widgets.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* IA e Notificações */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            Assistente IA & Notificações
          </CardTitle>
          <CardDescription>Como a IA interage com você</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {isOwner && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="whatsappAiEnabled" className="text-sm font-medium cursor-pointer">
                    Receber mensagens da IA no WhatsApp
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Dicas de negócio, resumos diários e alertas operacionais.
                  </p>
                </div>
                <Switch
                  id="whatsappAiEnabled"
                  checked={whatsappAiEnabled}
                  onCheckedChange={setWhatsappAiEnabled}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 pt-2 border-t border-border/50">
                <div className="space-y-2">
                  <Label htmlFor="aiName">Nome do Assistente</Label>
                  <Input
                    id="aiName"
                    value={aiAssistantName}
                    onChange={(e) => setAiAssistantName(e.target.value)}
                    placeholder="Ex: TecBot"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="aiVoice">Voz / Personalidade</Label>
                  <select 
                    id="aiVoice"
                    value={aiAssistantVoice}
                    onChange={(e) => setAiAssistantVoice(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="neutral">Neutro</option>
                    <option value="professional">Profissional</option>
                    <option value="friendly">Amigável</option>
                    <option value="enthusiastic">Entusiasta</option>
                  </select>
                </div>
              </div>
            </>
          )}

          <div className={cn("pt-4", isOwner && "border-t border-border/50")}>
            <h4 className="text-sm font-semibold mb-3">Preferências de Alerta</h4>
            <div className="space-y-3">
              {[
                { key: "new_service", label: "Novo serviço concluído" },
                { key: "new_schedule", label: "Novo agendamento" },
                { key: "whatsapp_message", label: "Mensagens recebidas" },
              ].map((notif) => (
                <div key={notif.key} className="flex items-center justify-between">
                  <Label htmlFor={`notif-${notif.key}`} className="text-sm cursor-pointer">{notif.label}</Label>
                  <Switch 
                    id={`notif-${notif.key}`}
                    checked={(preferences as any)[notif.key]}
                    onCheckedChange={(checked) => updatePreferences({ [notif.key]: checked })}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aparência */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5 text-primary" />
            Aparência & Layout
          </CardTitle>
          <CardDescription>Personalize sua interface de trabalho</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <p className="text-sm font-medium">Modo do Sistema</p>
            <div className="grid grid-cols-3 gap-3">
              {modeOptions.map((opt) => {
                const Icon = opt.icon;
                const isSelected = theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setTheme(opt.id)}
                    className={`flex flex-col items-center gap-2 rounded-lg border-2 p-3 transition-all ${
                      isSelected ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-xs font-medium">{opt.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">Cor de Destaque</p>
            <div className="grid grid-cols-4 gap-2">
              {colorThemes.map((ct) => {
                const isSelected = colorTheme === ct.id;
                return (
                  <button
                    key={ct.id}
                    onClick={() => setColorTheme(ct.id)}
                    className={`h-10 rounded-full border-2 transition-all flex items-center justify-center ${
                      isSelected ? "border-primary scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: `hsl(${ct.hsl})` }}
                  >
                    {isSelected && <Check className="h-4 w-4 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salvar */}
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Cancelar
        </Button>
        <Button
          onClick={handleSave}
          disabled={isUpdating || !fullName.trim()}
          className="flex-1"
        >
          {isUpdating ? "Salvando..." : "Salvar Alterações"}
        </Button>
      </div>
    </div>
  );
}
