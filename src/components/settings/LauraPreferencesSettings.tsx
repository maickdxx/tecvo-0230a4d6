import { ArrowLeft, Bot, Truck, Wrench, CheckCircle2, Calendar, AlertTriangle, Sparkles, MessageSquare, Smartphone, Zap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useLauraPreferences, type LauraPreferences } from "@/hooks/useLauraPreferences";
import { useAICredits, CREDIT_PACKAGES } from "@/hooks/useAICredits";

interface LauraPreferencesSettingsProps {
  onBack: () => void;
}

interface PreferenceToggle {
  key: keyof LauraPreferences;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface PreferenceGroup {
  title: string;
  description: string;
  items: PreferenceToggle[];
}

const PREFERENCE_GROUPS: PreferenceGroup[] = [
  {
    title: "Atendimento",
    description: "Notificações sobre serviços em andamento",
    items: [
      {
        key: "service_en_route",
        label: "Deslocamento iniciado",
        description: "Quando alguém da equipe sai a caminho do cliente",
        icon: Truck,
      },
      {
        key: "service_started",
        label: "Serviço iniciado",
        description: "Quando um atendimento começa no local",
        icon: Wrench,
      },
      {
        key: "service_completed",
        label: "Serviço finalizado",
        description: "Quando um atendimento é concluído",
        icon: CheckCircle2,
      },
    ],
  },
  {
    title: "Agenda",
    description: "Lembretes e alertas de compromissos",
    items: [
      {
        key: "schedule_reminder",
        label: "Lembretes de agenda",
        description: "Avisos sobre serviços agendados para você",
        icon: Calendar,
      },
    ],
  },
  {
    title: "Operação",
    description: "Alertas operacionais do sistema",
    items: [
      {
        key: "operational_alerts",
        label: "Alertas operacionais",
        description: "Situações que precisam de atenção imediata",
        icon: AlertTriangle,
      },
    ],
  },
  {
    title: "Laura para mim",
    description: "Mensagens pessoais da Laura para você",
    items: [
      {
        key: "laura_tips",
        label: "Dicas e resumos úteis",
        description: "Insights de negócio e resumos operacionais",
        icon: Sparkles,
      },
    ],
  },
];

const CHANNEL_TOGGLES: PreferenceToggle[] = [
  {
    key: "channel_whatsapp",
    label: "WhatsApp",
    description: "Receber notificações pelo WhatsApp pessoal",
    icon: Smartphone,
  },
  {
    key: "channel_internal",
    label: "Chat interno",
    description: "Receber notificações dentro do sistema",
    icon: MessageSquare,
  },
];

export function LauraPreferencesSettings({ onBack }: LauraPreferencesSettingsProps) {
  const { preferences, loading, saving, updatePreference } = useLauraPreferences();
  const { balance, isLow, isEmpty, isLoading: creditsLoading, purchaseCredits, purchasing } = useAICredits();

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Laura</h1>
            <p className="text-muted-foreground">Carregando preferências...</p>
          </div>
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
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
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Bot className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Laura</h1>
            <p className="text-muted-foreground">
              Escolha o que a Laura te avisa e por onde
            </p>
          </div>
        </div>
      </div>

      {/* AI Credits / Capacity */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Capacidade de IA
          </CardTitle>
          <CardDescription className="text-xs">
            Gerencie os recursos inteligentes da Laura
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {creditsLoading ? (
            <Skeleton className="h-16 w-full rounded-lg" />
          ) : (
            <>
              {/* Balance display */}
              <div className="rounded-lg border border-border/60 bg-muted/20 p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">
                    {isEmpty ? "IA pausada" : isLow ? "Capacidade limitada" : "IA ativa"}
                  </p>
                  <p className={`text-2xl font-bold ${isEmpty ? "text-destructive" : isLow ? "text-amber-600" : "text-foreground"}`}>
                    {balance} <span className="text-sm font-normal text-muted-foreground">interações</span>
                  </p>
                </div>
                <span className={`h-3 w-3 rounded-full ${isEmpty ? "bg-destructive animate-pulse" : isLow ? "bg-amber-500" : "bg-emerald-500"}`} />
              </div>

              {isEmpty && (
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">
                    A IA está pausada. Recarregue para continuar usando os recursos inteligentes.
                  </p>
                </div>
              )}

              {/* Packages */}
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Recarregar</p>
                {CREDIT_PACKAGES.map((pack, idx) => (
                  <button
                    key={pack.id}
                    className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all group relative"
                    onClick={() => purchaseCredits(pack.id)}
                    disabled={purchasing}
                  >
                    {idx === 1 && (
                      <span className="absolute -top-2 left-4 text-[10px] font-semibold bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                        Popular
                      </span>
                    )}
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{pack.label}</p>
                      <p className="text-xs text-muted-foreground">{pack.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        R$ {pack.price.toFixed(2).replace(".", ",")}
                      </span>
                      {purchasing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </button>
                ))}
              </div>

              {/* Usage reference */}
              <div className="rounded-lg border border-border/40 p-3 space-y-1.5">
                <p className="text-xs font-medium text-foreground">Uso por recurso</p>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Resposta inteligente</span>
                  <span className="font-medium text-foreground">1 interação</span>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Análise completa / Criar OS</span>
                  <span className="font-medium text-foreground">3 interações</span>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Channels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Canais de entrega</CardTitle>
          <CardDescription className="text-xs">
            Por onde você quer receber as notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {CHANNEL_TOGGLES.map((toggle, index) => {
            const Icon = toggle.icon;
            return (
              <div key={toggle.key}>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor={`channel-${toggle.key}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {toggle.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{toggle.description}</p>
                    </div>
                  </div>
                  <Switch
                    id={`channel-${toggle.key}`}
                    checked={preferences[toggle.key]}
                    onCheckedChange={(checked) => updatePreference(toggle.key, checked)}
                    disabled={saving}
                  />
                </div>
                {index < CHANNEL_TOGGLES.length - 1 && <Separator />}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Preference Groups */}
      {PREFERENCE_GROUPS.map((group) => (
        <Card key={group.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">{group.title}</CardTitle>
            <CardDescription className="text-xs">{group.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1">
            {group.items.map((toggle, index) => {
              const Icon = toggle.icon;
              return (
                <div key={toggle.key}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <div className="space-y-0.5">
                        <Label
                          htmlFor={`pref-${toggle.key}`}
                          className="text-sm font-medium cursor-pointer"
                        >
                          {toggle.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">{toggle.description}</p>
                      </div>
                    </div>
                    <Switch
                      id={`pref-${toggle.key}`}
                      checked={preferences[toggle.key]}
                      onCheckedChange={(checked) => updatePreference(toggle.key, checked)}
                      disabled={saving}
                    />
                  </div>
                  {index < group.items.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Info footer */}
      <p className="text-xs text-muted-foreground text-center pb-4">
        A Laura nunca envia mensagens para seus clientes sem sua autorização.
        Estas preferências controlam apenas o que <strong>você</strong> recebe.
      </p>
    </div>
  );
}
