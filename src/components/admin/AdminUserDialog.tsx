import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { User, Building2, CreditCard, Shield, Mail, Phone, MapPin, Calendar, Clock, Trash2, Loader2, MessageCircle, Activity, AlertTriangle, TrendingDown, Zap, Bell, BellOff } from "lucide-react";
import type { PlatformUser } from "@/hooks/useAdminUsers";
import type { UserEngagementMetrics } from "@/hooks/useEngagementMetrics";

interface AdminUserDialogProps {
  user: PlatformUser | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGrantSuperAdmin: (userId: string) => void;
  isGranting: boolean;
  onDeleteUser: (userId: string) => void;
  isDeleting: boolean;
  engagementMetrics?: UserEngagementMetrics;
  hasPushEnabled?: boolean;
  pushDeviceCount?: number;
}

function getPlanLabel(plan: string | null) {
  switch (plan) {
    case "pro": return "Pro";
    case "essential": return "Essencial";
    case "starter": return "Starter";
    default: return "Free";
  }
}

function getPlanStatus(user: PlatformUser) {
  const now = new Date();
  if (user.trial_ends_at && new Date(user.trial_ends_at) > now) {
    return "Trial";
  }
  if (user.plan_expires_at && new Date(user.plan_expires_at) < now) {
    return "Vencido";
  }
  if (user.plan === "pro" || user.plan === "essential") {
    return "Ativo";
  }
  return "Free";
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}min`;
}

function getEngagementColor(level: string) {
  switch (level) {
    case "active": return "text-emerald-600";
    case "warm": return "text-amber-600";
    case "risk": return "text-red-600";
    default: return "text-muted-foreground";
  }
}

function getEngagementLabel(level: string) {
  switch (level) {
    case "active": return "Ativo";
    case "warm": return "Morno";
    case "risk": return "Risco de Churn";
    default: return "—";
  }
}

function getEngagementBgColor(level: string) {
  switch (level) {
    case "active": return "bg-emerald-500";
    case "warm": return "bg-amber-500";
    case "risk": return "bg-red-500";
    default: return "bg-gray-400";
  }
}

export function AdminUserDialog({ user, open, onOpenChange, onGrantSuperAdmin, isGranting, onDeleteUser, isDeleting, engagementMetrics, hasPushEnabled, pushDeviceCount }: AdminUserDialogProps) {
  if (!user) return null;

  const isSuperAdmin = user.roles.includes("super_admin");
  const status = getPlanStatus(user);
  const m = engagementMetrics;

  // Calculate alerts
  const alerts: { icon: React.ReactNode; text: string; severity: "warning" | "danger" }[] = [];
  if (user.last_access) {
    const daysSinceAccess = Math.floor((Date.now() - new Date(user.last_access).getTime()) / 86400000);
    if (daysSinceAccess >= 7) {
      alerts.push({
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
        text: `Sem acesso há ${daysSinceAccess} dias`,
        severity: daysSinceAccess >= 14 ? "danger" : "warning",
      });
    }
  } else {
    alerts.push({
      icon: <AlertTriangle className="h-3.5 w-3.5" />,
      text: "Nunca acessou a plataforma",
      severity: "danger",
    });
  }

  if (m) {
    if (m.avg_session_seconds < 30 && m.accesses_30d >= 3) {
      alerts.push({
        icon: <TrendingDown className="h-3.5 w-3.5" />,
        text: "Sessões curtas recorrentes (< 30s)",
        severity: "warning",
      });
    }
    const daysSinceCreation = Math.floor((Date.now() - new Date(user.created_at).getTime()) / 86400000);
    if (daysSinceCreation > 3 && m.services_created_30d === 0) {
      alerts.push({
        icon: <Zap className="h-3.5 w-3.5" />,
        text: "Conta criada sem nenhuma OS registrada",
        severity: "warning",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {user.full_name || user.email}
          </DialogTitle>
          <DialogDescription>Detalhes completos do usuário</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Engajamento */}
          {m && (
            <>
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="h-4 w-4" /> Engajamento
                </h4>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 font-semibold ${getEngagementColor(m.engagement_level)}`}>
                    <span className={`inline-block h-3 w-3 rounded-full ${getEngagementBgColor(m.engagement_level)}`} />
                    {getEngagementLabel(m.engagement_level)}
                  </div>
                  <span className="text-sm text-muted-foreground">{m.engagement_score}/100 pts</span>
                </div>
                <Progress value={m.engagement_score} className="h-2" />

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-muted-foreground">Sessão média:</span>
                    <span className="ml-1 font-medium">{formatDuration(Math.round(m.avg_session_seconds))}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Último acesso:</span>
                    <span className="ml-1 font-medium">{formatDuration(m.last_session_duration_seconds)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Acessos (7d):</span>
                    <span className="ml-1 font-medium">{m.accesses_7d}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Acessos (30d):</span>
                    <span className="ml-1 font-medium">{m.accesses_30d}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">OS criadas (30d):</span>
                    <span className="ml-1 font-medium">{m.services_created_30d}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1">Features:</span>
                  {m.used_agenda && <Badge variant="outline" className="text-xs">Agenda</Badge>}
                  {m.used_finance && <Badge variant="outline" className="text-xs">Financeiro</Badge>}
                  {m.used_weather_art && <Badge variant="outline" className="text-xs">Marketing</Badge>}
                  {!m.used_agenda && !m.used_finance && !m.used_weather_art && (
                    <span className="text-xs text-muted-foreground">Nenhuma feature utilizada</span>
                  )}
                </div>

                {/* Alerts */}
                {alerts.length > 0 && (
                  <div className="space-y-1.5 mt-2">
                    {alerts.map((alert, i) => (
                      <div
                        key={i}
                        className={`flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                          alert.severity === "danger"
                            ? "bg-red-500/10 text-red-700 dark:text-red-400"
                            : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        {alert.icon}
                        {alert.text}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <Separator />
            </>
          )}

          {/* Alerts without metrics */}
          {!m && alerts.length > 0 && (
            <>
              <div className="space-y-1.5">
                {alerts.map((alert, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 text-xs rounded-md px-2.5 py-1.5 ${
                      alert.severity === "danger"
                        ? "bg-red-500/10 text-red-700 dark:text-red-400"
                        : "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                    }`}
                  >
                    {alert.icon}
                    {alert.text}
                  </div>
                ))}
              </div>
              <Separator />
            </>
          )}

          {/* Dados Pessoais */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4" /> Dados Pessoais
            </h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                {user.email}
              </div>
              {user.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  {user.phone}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                    onClick={() => {
                      const digits = user.phone!.replace(/\D/g, "");
                      const num = digits.startsWith("55") ? digits : `55${digits}`;
                      window.open(`https://wa.me/${num}`, "_blank");
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" />
                    WhatsApp
                  </Button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Cadastro:</span>
                {format(new Date(user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
              {(() => {
                const accessText = (() => {
                  if (!user.last_access) return "Nunca acessou";
                  const d = new Date(user.last_access);
                  const time = format(d, "HH:mm", { locale: ptBR });
                  const now = new Date();
                  const days = Math.floor((now.getTime() - d.getTime()) / 86400000);
                  if (days === 0) return `Hoje ${time}`;
                  if (days === 1) return `Ontem ${time}`;
                  if (days <= 30) return `${days} dias atrás`;
                  return format(d, "dd/MM/yyyy HH:mm", { locale: ptBR });
                })();
                const statusColor = !user.last_access ? "bg-gray-400" : (() => {
                  const days = Math.floor((Date.now() - new Date(user.last_access).getTime()) / 86400000);
                  if (days < 3) return "bg-green-500";
                  if (days < 7) return "bg-yellow-500";
                  return "bg-red-500";
                })();
                return (
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Último acesso:</span>
                    <span className={`inline-block h-2 w-2 rounded-full ${statusColor}`} />
                    {accessText}
                  </div>
                );
              })()}
            </div>
          </div>

          <Separator />

          {/* Notificações Push */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              {hasPushEnabled ? <Bell className="h-4 w-4 text-emerald-600" /> : <BellOff className="h-4 w-4" />}
              Notificações Push
            </h4>
            <div className="flex items-center gap-2 text-sm">
              {hasPushEnabled ? (
                <Badge variant="outline" className="text-emerald-600 border-emerald-300">
                  ✅ Ativo {(pushDeviceCount ?? 0) > 1 && `(${pushDeviceCount} dispositivos)`}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  ❌ Inativo — não receberá notificações push
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Organização */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Organização
            </h4>
            <div className="grid gap-2 text-sm">
              <div><span className="text-muted-foreground">Empresa:</span> {user.organization_name || "—"}</div>
              {user.org_cnpj_cpf && (
                <div><span className="text-muted-foreground">CNPJ/CPF:</span> {user.org_cnpj_cpf}</div>
              )}
              {(user.org_city || user.org_state) && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                  {[user.org_city, user.org_state].filter(Boolean).join(", ")}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Assinatura */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> Assinatura
            </h4>
            <div className="grid gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Plano:</span>
                <Badge variant="outline">{getPlanLabel(user.plan)}</Badge>
                <Badge variant={status === "Ativo" ? "default" : status === "Trial" ? "outline" : "destructive"}>
                  {status}
                </Badge>
              </div>
              {user.trial_started_at && (
                <div>
                  <span className="text-muted-foreground">Trial iniciado:</span>{" "}
                  {format(new Date(user.trial_started_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
              {user.trial_ends_at && (
                <div>
                  <span className="text-muted-foreground">Trial termina:</span>{" "}
                  {format(new Date(user.trial_ends_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
              {user.plan_expires_at && (
                <div>
                  <span className="text-muted-foreground">Expira em:</span>{" "}
                  {format(new Date(user.plan_expires_at), "dd/MM/yyyy", { locale: ptBR })}
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Gateway:</span> Stripe
              </div>
            </div>
          </div>

          <Separator />

          {/* Permissões */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" /> Permissões
            </h4>
            <div className="flex flex-wrap gap-2">
              {user.roles.map((role) => (
                <Badge key={role} variant={role === "super_admin" ? "destructive" : "secondary"}>
                  {role}
                </Badge>
              ))}
              {user.roles.length === 0 && (
                <span className="text-sm text-muted-foreground">Sem roles atribuídas</span>
              )}
            </div>
            {!isSuperAdmin && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isGranting}
                  >
                    <Shield className="h-4 w-4 mr-2" />
                    Tornar Super Admin
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Conceder Super Admin?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Deseja realmente conceder privilégios de <strong>Super Admin</strong> ao usuário{" "}
                      <strong>{user.full_name || user.email}</strong>?
                      <span className="block mt-2 text-destructive">
                        Esta ação dará acesso total ao painel administrativo da plataforma.
                      </span>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onGrantSuperAdmin(user.user_id)}>
                      Confirmar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>

          <Separator />

          {/* Zona de Perigo */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-destructive flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Zona de Perigo
            </h4>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Excluir Usuário
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir usuário?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deseja realmente excluir o usuário <strong>{user.full_name || user.email}</strong>
                    {user.organization_name && (
                      <> da organização <strong>{user.organization_name}</strong></>
                    )}?
                    <span className="block mt-2">
                      Esta ação é irreversível e removerá o usuário e todos os seus dados da plataforma.
                    </span>
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      onDeleteUser(user.user_id);
                      onOpenChange(false);
                    }}
                  >
                    Confirmar exclusão
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-xs text-muted-foreground">
              Remove o usuário, perfil, roles e libera o email para novo cadastro.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
