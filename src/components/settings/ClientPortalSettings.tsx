import { useState, useEffect } from "react";
import { ArrowLeft, Globe, Copy, Check, Palette, Settings2, Link2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Separator } from "@/components/ui/separator";
import { useClientPortalConfig } from "@/hooks/useClientPortalConfig";
import { useOrganization } from "@/hooks/useOrganization";

interface ClientPortalSettingsProps {
  onBack: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function ClientPortalSettings({ onBack }: ClientPortalSettingsProps) {
  const { config, isLoading, updateConfig, isSaving } = useClientPortalConfig();
  const { organization } = useOrganization();

  const [isActive, setIsActive] = useState(true);
  const [displayName, setDisplayName] = useState("");
  const [welcomeMessage, setWelcomeMessage] = useState("Acompanhe seus serviços com segurança");
  const [contactPhone, setContactPhone] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#1e6bb8");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [slug, setSlug] = useState("");
  const [copied, setCopied] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setDisplayName(config.display_name || "");
      setWelcomeMessage(config.welcome_message || "Acompanhe seus serviços com segurança");
      setContactPhone(config.contact_phone || "");
      setPrimaryColor(config.primary_color || "#1e6bb8");
      setSecondaryColor(config.secondary_color || "");
      setSlug(config.slug || "");
    } else if (organization && !config) {
      setDisplayName(organization.name || "");
      setContactPhone(organization.whatsapp_owner || organization.phone || "");
      const autoSlug = slugify(organization.name || "");
      setSlug(autoSlug);
    }
  }, [config, organization]);

  const portalBaseUrl = "tecvo.com.br/portal";
  const portalLink = slug ? `https://${portalBaseUrl}/${slug}` : "";

  const handleCopyLink = () => {
    if (!portalLink) return;
    navigator.clipboard.writeText(portalLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    updateConfig({
      is_active: isActive,
      display_name: displayName || null,
      welcome_message: welcomeMessage || null,
      contact_phone: contactPhone || null,
      primary_color: primaryColor || null,
      secondary_color: secondaryColor || null,
      slug: slug || null,
    });
    setHasChanges(false);
  };

  const markChanged = () => setHasChanges(true);

  

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div><h1 className="text-2xl font-bold text-foreground">Área do Cliente</h1></div>
        </div>
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Área do Cliente</h1>
            <p className="text-muted-foreground">Configure a experiência do portal para seus clientes</p>
          </div>
        </div>
        {hasChanges && (
          <Button onClick={handleSave} disabled={isSaving} className="rounded-xl">
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        )}
      </div>

      {/* 1. Configurações Gerais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-primary" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>Defina as informações básicas do portal</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Ativar Área do Cliente</Label>
              <p className="text-xs text-muted-foreground">Permite que seus clientes acessem o portal</p>
            </div>
            <Switch checked={isActive} onCheckedChange={(v) => { setIsActive(v); markChanged(); }} />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Nome exibido da empresa</Label>
            <Input
              value={displayName}
              onChange={(e) => { setDisplayName(e.target.value); markChanged(); }}
              placeholder="Nome da sua empresa"
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Aparece no cabeçalho do portal</p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Mensagem de boas-vindas</Label>
            <Textarea
              value={welcomeMessage}
              onChange={(e) => { setWelcomeMessage(e.target.value); markChanged(); }}
              placeholder="Ex: Acompanhe seus serviços com segurança"
              className="rounded-xl resize-none"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-semibold">Telefone/WhatsApp de contato</Label>
            <Input
              value={contactPhone}
              onChange={(e) => { setContactPhone(e.target.value); markChanged(); }}
              placeholder="(11) 99999-9999"
              className="rounded-xl"
            />
            <p className="text-xs text-muted-foreground">Usado nos botões de contato do portal</p>
          </div>
        </CardContent>
      </Card>

      {/* 2. Personalização Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Palette className="h-5 w-5 text-primary" />
            Personalização Visual
          </CardTitle>
          <CardDescription>Customize as cores do portal do cliente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cor principal</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => { setPrimaryColor(e.target.value); markChanged(); }}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={primaryColor}
                  onChange={(e) => { setPrimaryColor(e.target.value); markChanged(); }}
                  className="rounded-xl font-mono text-sm"
                  placeholder="#1e6bb8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Cor secundária <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={secondaryColor || "#f59e0b"}
                  onChange={(e) => { setSecondaryColor(e.target.value); markChanged(); }}
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer"
                />
                <Input
                  value={secondaryColor}
                  onChange={(e) => { setSecondaryColor(e.target.value); markChanged(); }}
                  className="rounded-xl font-mono text-sm"
                  placeholder="#f59e0b"
                />
              </div>
            </div>
          </div>

          {/* Mini Preview */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5" /> Preview
            </Label>
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="p-4 flex items-center gap-3" style={{ backgroundColor: primaryColor + "10" }}>
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: primaryColor }}
                >
                  {(displayName || "E")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{displayName || "Sua Empresa"}</p>
                  <p className="text-xs text-muted-foreground">Área do Cliente</p>
                </div>
              </div>
              <div className="p-4 bg-card space-y-3">
                <p className="text-xs text-muted-foreground">{welcomeMessage}</p>
                <div className="flex gap-2">
                  <div
                    className="px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Botão primário
                  </div>
                  {secondaryColor && (
                    <div
                      className="px-3 py-1.5 rounded-lg text-white text-xs font-medium"
                      style={{ backgroundColor: secondaryColor }}
                    >
                      Botão secundário
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. Link do Portal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Link2 className="h-5 w-5 text-primary" />
            Link do Portal
          </CardTitle>
          <CardDescription>Configure o slug exclusivo para o portal da sua empresa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Slug da empresa</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  {portalBaseUrl}/
                </span>
                <Input
                  value={slug}
                  onChange={(e) => { setSlug(slugify(e.target.value)); markChanged(); }}
                  className="rounded-xl pl-[170px] font-mono text-sm"
                  placeholder="minha-empresa"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Use letras, números e hifens. Ex: space-ar, climatech-sp</p>
          </div>

          {portalLink && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/50 border border-border">
              <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm font-mono text-foreground truncate flex-1">{portalLink}</span>
              <Button variant="ghost" size="sm" onClick={handleCopyLink} className="shrink-0 gap-1.5">
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado!" : "Copiar"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Floating save button */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="lg" className="rounded-xl shadow-lg shadow-primary/20">
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      )}
    </div>
  );
}
