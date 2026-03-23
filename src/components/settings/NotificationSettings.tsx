import { ArrowLeft, Bell, BellOff, BellRing, CheckCircle2, XCircle, AlertCircle, Smartphone, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useNotifications } from "@/hooks/useNotifications";
import { useOrganization } from "@/hooks/useOrganization";

interface NotificationSettingsProps {
  onBack: () => void;
}

const CATEGORY_LABELS: { key: string; label: string; description: string }[] = [
  { key: "new_service", label: "Novo serviço fechado", description: "Quando um serviço for concluído" },
  { key: "new_schedule", label: "Novo agendamento", description: "Quando um novo agendamento for criado" },
  { key: "recurrence_alert", label: "Recorrência de cliente", description: "Cliente atingiu 6 meses desde o último serviço" },
  { key: "goal_reached", label: "Meta atingida", description: "Quando a meta mensal for alcançada" },
  { key: "whatsapp_message", label: "Mensagem no WhatsApp", description: "Mensagens recebidas pelo canal integrado" },
];

export function NotificationSettings({ onBack }: NotificationSettingsProps) {
  const {
    isSupported,
    permissionStatus,
    isSubscribed,
    loading,
    preferences,
    requestPermission,
    unsubscribe,
    updatePreferences,
  } = useNotifications();
  const { organization, update } = useOrganization();

  const statusConfig = {
    granted: { label: "Ativado", variant: "default" as const, icon: CheckCircle2, color: "text-green-600" },
    denied: { label: "Negado", variant: "destructive" as const, icon: XCircle, color: "text-destructive" },
    default: { label: "Não configurado", variant: "secondary" as const, icon: AlertCircle, color: "text-muted-foreground" },
    unsupported: { label: "Não suportado", variant: "secondary" as const, icon: AlertCircle, color: "text-muted-foreground" },
  };

  const status = statusConfig[permissionStatus];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Notificações</h1>
          <p className="text-muted-foreground">Gerencie alertas e notificações push</p>
        </div>
      </div>

      {/* Status & Activation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellRing className="h-5 w-5 text-primary" />
            Notificações Push
          </CardTitle>
          <CardDescription>Receba alertas diretamente no seu dispositivo</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
            <div className="flex items-center gap-3">
              <Smartphone className="h-8 w-8 text-primary" />
              <div>
                <p className="font-medium text-foreground">Este dispositivo</p>
                <p className="text-sm text-muted-foreground">
                  {isSubscribed ? "Recebendo notificações" : "Notificações desativadas"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusIcon className={`h-4 w-4 ${status.color}`} />
              <Badge variant={status.variant}>{status.label}</Badge>
            </div>
          </div>

          {!isSupported && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
              <p className="text-sm text-foreground">
                Seu navegador não suporta notificações push. Para receber alertas, instale o aplicativo (PWA) ou use um navegador compatível.
              </p>
            </div>
          )}

          {permissionStatus === "denied" && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-sm text-foreground">
                As notificações foram bloqueadas pelo navegador. Para reativar, acesse as configurações do navegador → Permissões do site → Notificações e permita para este site.
              </p>
            </div>
          )}

          {isSupported && permissionStatus !== "denied" && (
            <div className="flex gap-3">
              {isSubscribed ? (
                <Button variant="outline" onClick={unsubscribe} disabled={loading}>
                  <BellOff className="mr-2 h-4 w-4" />
                  {loading ? "Desativando..." : "Desativar notificações"}
                </Button>
              ) : (
                <Button onClick={requestPermission} disabled={loading}>
                  <Bell className="mr-2 h-4 w-4" />
                  {loading ? "Ativando..." : "Ativar notificações"}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto WhatsApp Notification */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageSquare className="h-5 w-5 text-primary" />
            Mensagem automática ao cliente
          </CardTitle>
          <CardDescription>Envio de WhatsApp quando um serviço é concluído</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-2">
            <div className="space-y-0.5">
              <Label htmlFor="auto-notify-client" className="text-sm font-medium cursor-pointer">
                Enviar link do portal ao concluir serviço
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando ativado, o cliente recebe automaticamente uma mensagem no WhatsApp com o link para acompanhar os detalhes do serviço.
              </p>
            </div>
            <Switch
              id="auto-notify-client"
              checked={(organization as any)?.auto_notify_client_completion ?? true}
              onCheckedChange={(checked) => update({ auto_notify_client_completion: checked } as any)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Category Preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Categorias de notificação
          </CardTitle>
          <CardDescription>Escolha quais tipos de alerta deseja receber</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {CATEGORY_LABELS.map((cat, index) => (
            <div key={cat.key}>
              <div className="flex items-center justify-between py-3">
                <div className="space-y-0.5">
                  <Label htmlFor={`notif-${cat.key}`} className="text-sm font-medium cursor-pointer">
                    {cat.label}
                  </Label>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
                <Switch
                  id={`notif-${cat.key}`}
                  checked={preferences[cat.key as keyof typeof preferences]}
                  onCheckedChange={(checked) => updatePreferences({ [cat.key]: checked })}
                />
              </div>
              {index < CATEGORY_LABELS.length - 1 && <Separator />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
