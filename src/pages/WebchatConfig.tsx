import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Copy,
  Check,
  Loader2,
  Eye,
  Save,
  Globe,
  MessageCircle,
  Palette,
  Code2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AppLayout } from "@/components/layout";
import { useWebchatConfig } from "@/hooks/useWebchatConfig";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";

const COLOR_PRESETS = [
  { label: "Azul", value: "#2563eb" },
  { label: "Verde", value: "#16a34a" },
  { label: "Roxo", value: "#7c3aed" },
  { label: "Vermelho", value: "#dc2626" },
  { label: "Laranja", value: "#ea580c" },
  { label: "Rosa", value: "#db2777" },
  { label: "Ciano", value: "#0891b2" },
  { label: "Preto", value: "#171717" },
];

export default function WebchatConfig() {
  const navigate = useNavigate();
  const { config, isLoading, save, isSaving } = useWebchatConfig();
  const { organization } = useOrganization();
  const [copied, setCopied] = useState(false);

  // Form state
  const [isActive, setIsActive] = useState(false);
  const [position, setPosition] = useState("right");
  const [color, setColor] = useState("#2563eb");
  const [buttonText, setButtonText] = useState("Fale conosco");
  const [welcomeMessage, setWelcomeMessage] = useState("Olá! Como podemos ajudar?");
  const [autoShowWelcome, setAutoShowWelcome] = useState(false);
  const [displayName, setDisplayName] = useState("Atendimento");
  const [bottomDistance, setBottomDistance] = useState(20);

  // Load config
  useEffect(() => {
    if (config) {
      setIsActive(config.is_active);
      setPosition(config.position || "right");
      setColor(config.color || "#2563eb");
      setButtonText(config.button_text || "Fale conosco");
      setWelcomeMessage(config.welcome_message || "Olá! Como podemos ajudar?");
      setAutoShowWelcome(config.auto_show_welcome);
      setDisplayName(config.display_name || "Atendimento");
      setBottomDistance(config.bottom_distance || 20);
    } else if (organization?.name) {
      setDisplayName(organization.name);
    }
  }, [config, organization?.name]);

  const handleSave = () => {
    save({
      is_active: isActive,
      position,
      color,
      button_text: buttonText,
      welcome_message: welcomeMessage,
      auto_show_welcome: autoShowWelcome,
      display_name: displayName,
      bottom_distance: bottomDistance,
    });
  };

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || "vcuwimodpfbzpuvzesfm";
  const scriptCode = `<script src="https://${projectId}.supabase.co/functions/v1/webchat-api?action=widget&org=${organization?.id}" defer><\/script>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(scriptCode);
    setCopied(true);
    toast.success("Código copiado!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/whatsapp/canais")}
            className="gap-1.5 mb-4 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Canais
          </Button>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Globe className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-foreground">Chat do Site</h1>
                <p className="text-sm text-muted-foreground">
                  Configure um widget de chat para o site da sua empresa.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {isActive ? "Ativo" : "Inativo"}
                </span>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
              <Button onClick={handleSave} disabled={isSaving} className="gap-1.5">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Salvar
              </Button>
            </div>
          </div>
        </div>

        <Tabs defaultValue="config" className="space-y-6">
          <TabsList>
            <TabsTrigger value="config" className="gap-1.5">
              <Palette className="h-3.5 w-3.5" />
              Personalização
            </TabsTrigger>
            <TabsTrigger value="install" className="gap-1.5">
              <Code2 className="h-3.5 w-3.5" />
              Instalação
            </TabsTrigger>
            <TabsTrigger value="preview" className="gap-1.5">
              <Eye className="h-3.5 w-3.5" />
              Preview
            </TabsTrigger>
          </TabsList>

          {/* ── CONFIGURATION TAB ── */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Appearance */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Palette className="h-4 w-4 text-primary" />
                    Aparência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do atendimento</Label>
                    <Input
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Ex: Space Ar Condicionado"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Cor principal</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_PRESETS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => setColor(c.value)}
                          className={`h-8 w-8 rounded-lg border-2 transition-all ${
                            color === c.value ? "border-foreground scale-110" : "border-transparent"
                          }`}
                          style={{ background: c.value }}
                          title={c.label}
                        />
                      ))}
                      <div className="flex items-center gap-1">
                        <input
                          type="color"
                          value={color}
                          onChange={(e) => setColor(e.target.value)}
                          className="h-8 w-8 rounded-lg cursor-pointer border-0 p-0"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Posição do botão</Label>
                    <Select value={position} onValueChange={setPosition}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="right">Canto inferior direito</SelectItem>
                        <SelectItem value="left">Canto inferior esquerdo</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Texto do botão</Label>
                    <Input
                      value={buttonText}
                      onChange={(e) => setButtonText(e.target.value)}
                      placeholder="Ex: Fale conosco"
                    />
                    <p className="text-[11px] text-muted-foreground">Deixe vazio para mostrar apenas o ícone.</p>
                  </div>

                  <div className="space-y-2">
                    <Label>Distância da borda inferior (px)</Label>
                    <Input
                      type="number"
                      value={bottomDistance}
                      onChange={(e) => setBottomDistance(Number(e.target.value))}
                      min={0}
                      max={200}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Messages */}
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    Mensagens
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Mensagem de boas-vindas</Label>
                    <Textarea
                      value={welcomeMessage}
                      onChange={(e) => setWelcomeMessage(e.target.value)}
                      placeholder="Ex: Olá! Como podemos ajudar?"
                      rows={3}
                    />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium">Exibir automaticamente</p>
                      <p className="text-[11px] text-muted-foreground">
                        Mostra a mensagem como balão antes de abrir o chat
                      </p>
                    </div>
                    <Switch checked={autoShowWelcome} onCheckedChange={setAutoShowWelcome} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── INSTALLATION TAB ── */}
          <TabsContent value="install" className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Code2 className="h-4 w-4 text-primary" />
                  Código de instalação
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!isActive && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 px-4 py-3">
                    <ToggleLeft className="h-4 w-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      O chat do site está <strong>inativo</strong>. Ative-o e salve antes de instalar.
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                    <p className="text-sm font-medium text-foreground mb-1">📋 Onde colar este código?</p>
                    <p className="text-xs text-muted-foreground">
                      Cole este <code className="bg-muted px-1 py-0.5 rounded text-[11px]">&lt;script&gt;</code> no <strong>HTML do seu site</strong>, logo antes da tag de fechamento <code className="bg-muted px-1 py-0.5 rounded text-[11px]">&lt;/body&gt;</code>.
                    </p>
                  </div>

                  <div className="relative">
                    <pre className="bg-muted/60 rounded-lg p-4 text-xs overflow-x-auto border border-border font-mono">
                      {scriptCode}
                    </pre>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCopy}
                      className="absolute top-2 right-2 gap-1.5"
                    >
                      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {copied ? "Copiado!" : "Copiar código"}
                    </Button>
                  </div>

                  <div className="bg-muted/40 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-semibold text-foreground">📌 Passo a passo por plataforma:</p>
                    
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">WordPress</p>
                        <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside pl-1">
                          <li>Vá em <strong>Aparência → Editor de Tema → footer.php</strong></li>
                          <li>Cole o código antes de <code className="bg-muted px-1 rounded">&lt;/body&gt;</code></li>
                          <li>Salve o arquivo</li>
                        </ol>
                        <p className="text-[11px] text-muted-foreground italic pl-1">Ou use um plugin como <strong>"Insert Headers and Footers"</strong> e cole na seção Footer.</p>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Wix</p>
                        <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside pl-1">
                          <li>Vá em <strong>Configurações → Código personalizado</strong></li>
                          <li>Clique em <strong>"Adicionar código"</strong></li>
                          <li>Cole o script, selecione <strong>"Corpo - fim"</strong></li>
                          <li>Aplique em <strong>"Todas as páginas"</strong> e salve</li>
                        </ol>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">HTML puro</p>
                        <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside pl-1">
                          <li>Abra o arquivo <code className="bg-muted px-0.5 rounded">index.html</code> do seu site</li>
                          <li>Cole o código antes de <code className="bg-muted px-1 rounded">&lt;/body&gt;</code></li>
                          <li>Salve e suba o arquivo para o servidor</li>
                        </ol>
                      </div>

                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">Shopify</p>
                        <ol className="text-[11px] text-muted-foreground space-y-0.5 list-decimal list-inside pl-1">
                          <li>Vá em <strong>Loja virtual → Temas → Editar código</strong></li>
                          <li>Abra o arquivo <code className="bg-muted px-0.5 rounded">theme.liquid</code></li>
                          <li>Cole antes de <code className="bg-muted px-1 rounded">&lt;/body&gt;</code></li>
                        </ol>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
                    <MessageCircle className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-[11px] text-muted-foreground">
                      Após instalar, visite seu site e o botão do chat aparecerá no canto {position === "right" ? "inferior direito" : "inferior esquerdo"}. Pode levar até 5 minutos para o cache atualizar.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── PREVIEW TAB ── */}
          <TabsContent value="preview">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  Preview do Widget
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative bg-gradient-to-br from-muted/30 to-muted/60 rounded-xl border border-border overflow-hidden" style={{ height: 500 }}>
                  {/* Fake website content */}
                  <div className="p-6 space-y-3">
                    <div className="h-4 w-48 bg-muted rounded" />
                    <div className="h-3 w-72 bg-muted/60 rounded" />
                    <div className="h-3 w-64 bg-muted/60 rounded" />
                    <div className="h-32 w-full bg-muted/40 rounded-lg mt-4" />
                    <div className="h-3 w-56 bg-muted/60 rounded" />
                    <div className="h-3 w-48 bg-muted/60 rounded" />
                  </div>

                  {/* Widget preview */}
                  <div
                    className="absolute flex flex-col items-end gap-3"
                    style={{
                      bottom: 20,
                      ...(position === "left" ? { left: 20 } : { right: 20 }),
                    }}
                  >
                    {/* Chat panel preview */}
                    <div className="w-72 rounded-2xl shadow-xl overflow-hidden bg-white border border-border/60">
                      {/* Header */}
                      <div className="px-4 py-3 flex items-center gap-3" style={{ background: color }}>
                        <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">
                            {(displayName || "A").charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-white text-xs font-bold">{displayName || "Atendimento"}</p>
                          <p className="text-white/70 text-[10px]">Responderemos em breve</p>
                        </div>
                      </div>
                      {/* Messages */}
                      <div className="bg-gray-50 p-3 space-y-2" style={{ minHeight: 120 }}>
                        <div className="flex">
                          <div className="bg-white border border-border/50 rounded-xl rounded-bl-sm px-3 py-2 text-xs max-w-[80%]">
                            {welcomeMessage || "Olá! Como podemos ajudar?"}
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <div className="rounded-xl rounded-br-sm px-3 py-2 text-xs text-white max-w-[80%]" style={{ background: color }}>
                            Boa tarde! Preciso de um orçamento
                          </div>
                        </div>
                      </div>
                      {/* Input */}
                      <div className="px-3 py-2 border-t border-border/40 flex gap-2 items-center">
                        <div className="flex-1 bg-muted/50 rounded-full h-7 px-3 flex items-center">
                          <span className="text-[10px] text-muted-foreground">Digite sua mensagem...</span>
                        </div>
                        <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ background: color }}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" className="h-3.5 w-3.5">
                            <line x1="22" y1="2" x2="11" y2="13" />
                            <polygon points="22 2 15 22 11 13 2 9 22 2" />
                          </svg>
                        </div>
                      </div>
                      {/* Footer */}
                      <div className="text-center py-1.5 border-t border-border/30">
                        <span className="text-[9px] text-muted-foreground">Powered by Tecvo</span>
                      </div>
                    </div>

                    {/* Floating button */}
                    <button
                      className="rounded-full px-5 py-3 text-white text-xs font-semibold flex items-center gap-2 shadow-lg"
                      style={{ background: color }}
                    >
                      <MessageCircle className="h-4 w-4" />
                      {buttonText && <span>{buttonText}</span>}
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
