import { useState, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Filter, MessageCircle, Phone, Mail, Building2, Calendar, Clock, Activity, Bell, BellOff } from "lucide-react";
import { differenceInDays, isToday, isYesterday } from "date-fns";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import type { PlatformUser } from "@/hooks/useAdminUsers";
import type { UserEngagementMetrics } from "@/hooks/useEngagementMetrics";
import { AdminUserDialog } from "./AdminUserDialog";

interface AdminUserListProps {
  users: PlatformUser[];
  isLoading: boolean;
  onGrantSuperAdmin: (userId: string) => void;
  isGranting: boolean;
  onDeleteUser: (userId: string) => void;
  isDeleting: boolean;
  engagementMap?: Map<string, UserEngagementMetrics>;
  pushEnabledUsers?: Set<string>;
  pushDeviceCounts?: Map<string, number>;
}

function getPlanStatus(user: PlatformUser) {
  const now = new Date();
  if (user.trial_ends_at && new Date(user.trial_ends_at) > now && (!user.plan || user.plan === "essential")) {
    return { label: "Trial", variant: "outline" as const };
  }
  if (user.plan_expires_at && new Date(user.plan_expires_at) < now) {
    return { label: "Vencido", variant: "destructive" as const };
  }
  if (user.plan === "pro" || user.plan === "essential") {
    return { label: "Ativo", variant: "default" as const };
  }
  return { label: "Free", variant: "secondary" as const };
}

function getRoleLabel(roles: string[]) {
  if (roles.includes("super_admin")) return { label: "Super Admin", variant: "destructive" as const };
  if (roles.includes("owner")) return { label: "Proprietário", variant: "default" as const };
  if (roles.includes("admin")) return { label: "Admin", variant: "secondary" as const };
  if (roles.includes("employee")) return { label: "Funcionário", variant: "outline" as const };
  return { label: "Membro", variant: "outline" as const };
}

function getPlanLabel(plan: string | null) {
  switch (plan) {
    case "pro": return "Pro";
    case "essential": return "Essencial";
    case "starter": return "Starter";
    default: return "Free";
  }
}

function formatLastAccess(dateStr: string | null): string {
  if (!dateStr) return "Nunca acessou";
  const date = new Date(dateStr);
  const time = format(date, "HH:mm", { locale: ptBR });
  if (isToday(date)) return `Hoje ${time}`;
  if (isYesterday(date)) return `Ontem ${time}`;
  const days = differenceInDays(new Date(), date);
  if (days <= 30) return `${days} dias atrás`;
  return format(date, "dd/MM/yyyy", { locale: ptBR });
}

function getAccessStatus(dateStr: string | null): { color: string; label: string } {
  if (!dateStr) return { color: "bg-gray-400", label: "never" };
  const days = differenceInDays(new Date(), new Date(dateStr));
  if (days < 3) return { color: "bg-green-500", label: "active" };
  if (days < 7) return { color: "bg-yellow-500", label: "warning" };
  return { color: "bg-red-500", label: "inactive" };
}

function getEngagementDot(level: string | undefined) {
  switch (level) {
    case "active": return { color: "bg-emerald-500", label: "Ativo" };
    case "warm": return { color: "bg-amber-500", label: "Morno" };
    case "risk": return { color: "bg-red-500", label: "Risco" };
    default: return { color: "bg-gray-400", label: "—" };
  }
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}min`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}min`;
}

function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

function openWhatsApp(phone: string) {
  window.open(`https://wa.me/${formatWhatsAppNumber(phone)}`, "_blank");
}

export function AdminUserList({ users, isLoading, onGrantSuperAdmin, isGranting, onDeleteUser, isDeleting, engagementMap, pushEnabledUsers, pushDeviceCounts }: AdminUserListProps) {
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [engagementFilter, setEngagementFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const isMobile = useIsMobile();

  const filtered = useMemo(() => {
    let result = users;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.organization_name?.toLowerCase().includes(q)
      );
    }

    if (planFilter !== "all") {
      result = result.filter((u) => (u.plan || "free") === planFilter);
    }

    if (roleFilter !== "all") {
      result = result.filter((u) => u.roles.includes(roleFilter));
    }

    if (engagementFilter !== "all" && engagementMap) {
      result = result.filter((u) => {
        const m = engagementMap.get(u.user_id);
        return m?.engagement_level === engagementFilter;
      });
    }

    return result;
  }, [users, search, planFilter, roleFilter, engagementFilter, engagementMap]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={planFilter} onValueChange={setPlanFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Plano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos planos</SelectItem>
              <SelectItem value="free">Free</SelectItem>
              <SelectItem value="starter">Starter</SelectItem>
              <SelectItem value="essential">Essencial</SelectItem>
              <SelectItem value="pro">Pro</SelectItem>
            </SelectContent>
          </Select>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Filter className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos tipos</SelectItem>
              <SelectItem value="super_admin">Super Admin</SelectItem>
              <SelectItem value="owner">Proprietário</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Membro</SelectItem>
              <SelectItem value="employee">Funcionário</SelectItem>
            </SelectContent>
          </Select>
          <Select value={engagementFilter} onValueChange={setEngagementFilter}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Activity className="h-3.5 w-3.5 mr-1" />
              <SelectValue placeholder="Engajamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="active">🟢 Ativo</SelectItem>
              <SelectItem value="warm">🟡 Morno</SelectItem>
              <SelectItem value="risk">🔴 Risco</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} usuário(s) encontrado(s)
      </p>

      {/* Mobile: Cards / Desktop: Table */}
      {isMobile ? (
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado</p>
          ) : (
            filtered.map((u) => {
              const status = getPlanStatus(u);
              const metrics = engagementMap?.get(u.user_id);
              const eng = getEngagementDot(metrics?.engagement_level);
              const hasPush = pushEnabledUsers?.has(u.user_id) ?? false;
              return (
                <Card key={u.user_id} className="cursor-pointer" onClick={() => setSelectedUser(u)}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-semibold text-sm truncate">{u.organization_name || "Sem empresa"}</span>
                      </div>
                      <div className="flex gap-1.5 shrink-0 items-center">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${eng.color}`} title={eng.label} />
                        <Badge variant="outline" className="text-xs">{getPlanLabel(u.plan)}</Badge>
                        <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {u.full_name || "—"}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    {u.phone && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Phone className="h-3 w-3" />
                        {u.phone}
                      </div>
                    )}
                    {metrics && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Activity className="h-3 w-3" />
                        <span>Score: {metrics.engagement_score}pts</span>
                        <span>·</span>
                        <span>{metrics.accesses_7d} acessos/7d</span>
                        <span>·</span>
                        <span>Sessão: {formatDuration(Math.round(metrics.avg_session_seconds))}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {hasPush ? (
                        <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-300">
                          <Bell className="h-3 w-3 mr-1" /> Push ativo
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          <BellOff className="h-3 w-3 mr-1" /> Push inativo
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      Cadastro: {format(new Date(u.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className={`inline-block h-2 w-2 rounded-full ${getAccessStatus(u.last_access).color}`} />
                      {formatLastAccess(u.last_access)}
                    </div>
                    {u.phone ? (
                      <Button
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white mt-1"
                        onClick={(e) => { e.stopPropagation(); openWhatsApp(u.phone!); }}
                      >
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Chamar no WhatsApp
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full mt-1" variant="outline" disabled>
                        Sem telefone
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="hidden md:table-cell">Empresa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Plano</TableHead>
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <TableHead>Engajamento</TableHead>
                <TableHead className="hidden lg:table-cell">Criação</TableHead>
                <TableHead className="hidden lg:table-cell">Último Acesso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    Nenhum usuário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((u) => {
                  const role = getRoleLabel(u.roles);
                  const status = getPlanStatus(u);
                   const metrics = engagementMap?.get(u.user_id);
                   const eng = getEngagementDot(metrics?.engagement_level);
                   const hasPush = pushEnabledUsers?.has(u.user_id) ?? false;
                   return (
                    <TableRow
                      key={u.user_id}
                      className="cursor-pointer"
                      onClick={() => setSelectedUser(u)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-1.5">
                          {u.full_name || "—"}
                          {hasPush ? (
                            <Bell className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <BellOff className="h-3.5 w-3.5 text-muted-foreground/50" />
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{u.email}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {u.organization_name || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={role.variant} className="text-xs">
                          {role.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs">
                          {getPlanLabel(u.plan)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <Badge variant={status.variant} className="text-xs">
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="flex items-center gap-1.5">
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${eng.color}`} />
                              <span className="text-xs text-muted-foreground">{eng.label}</span>
                              {metrics && (
                                <span className="text-xs text-muted-foreground">({metrics.engagement_score}pts)</span>
                              )}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs max-w-[220px]">
                            {metrics ? (
                              <div className="space-y-1">
                                <div>Sessão média: {formatDuration(Math.round(metrics.avg_session_seconds))}</div>
                                <div>Acessos 7d: {metrics.accesses_7d} · 30d: {metrics.accesses_30d}</div>
                                <div>OS criadas (30d): {metrics.services_created_30d}</div>
                                <div className="flex gap-1 flex-wrap">
                                  {metrics.used_agenda && <Badge variant="outline" className="text-[10px] px-1 py-0">Agenda</Badge>}
                                  {metrics.used_finance && <Badge variant="outline" className="text-[10px] px-1 py-0">Financeiro</Badge>}
                                  {metrics.used_weather_art && <Badge variant="outline" className="text-[10px] px-1 py-0">Marketing</Badge>}
                                </div>
                              </div>
                            ) : (
                              <span>Sem dados de engajamento</span>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {format(new Date(u.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-block h-2 w-2 rounded-full ${getAccessStatus(u.last_access).color}`} />
                          <span className="text-muted-foreground">{formatLastAccess(u.last_access)}</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <AdminUserDialog
        user={selectedUser}
        open={!!selectedUser}
        onOpenChange={(open) => !open && setSelectedUser(null)}
        onGrantSuperAdmin={onGrantSuperAdmin}
        isGranting={isGranting}
        onDeleteUser={onDeleteUser}
        isDeleting={isDeleting}
        engagementMetrics={selectedUser ? engagementMap?.get(selectedUser.user_id) : undefined}
        hasPushEnabled={selectedUser ? (pushEnabledUsers?.has(selectedUser.user_id) ?? false) : false}
        pushDeviceCount={selectedUser ? (pushDeviceCounts?.get(selectedUser.user_id) ?? 0) : 0}
      />
    </div>
  );
}
