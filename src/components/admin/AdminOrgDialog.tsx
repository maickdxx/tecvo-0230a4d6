import { useState } from "react";
import { format, addMonths, differenceInDays } from "date-fns";
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
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  Mail,
  Phone,
  MapPin,
  Calendar,
  Trash2,
  CreditCard,
  BarChart3,
  Settings,
  MessageCircle,
  ExternalLink,
} from "lucide-react";
import { type AdminOrganization, type AdminProfile, type UsageData } from "@/hooks/useAdminOrganizations";
import { getPlanDisplayInfo, type PlanSlug } from "@/lib/planConfig";

interface AdminOrgDialogProps {
  organization: AdminOrganization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdatePlan: (orgId: string, plan: string, expiresAt: string | null) => void;
  onDelete: (orgId: string) => void;
  isUpdating?: boolean;
  isDeleting?: boolean;
  usageData?: UsageData;
}

export function AdminOrgDialog({
  organization,
  open,
  onOpenChange,
  onUpdatePlan,
  onDelete,
  isUpdating,
  isDeleting,
  usageData,
}: AdminOrgDialogProps) {
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!organization) return null;

  const handlePlanChange = (plan: string) => {
    setSelectedPlan(plan);
    let expiresAt: string | null = null;
    if (plan !== "free") {
      expiresAt = addMonths(new Date(), 1).toISOString();
    }
    onUpdatePlan(organization.id, plan, expiresAt);
  };

  const handleDelete = () => {
    onDelete(organization.id);
    setConfirmDelete(false);
    onOpenChange(false);
  };

  // Plan helpers
  const planSlug = (organization.plan || "free") as PlanSlug;
  const planInfo = getPlanDisplayInfo(planSlug);

  const planLabel = (plan: string | null) => {
    switch (plan) {
      case "pro": return "Profissional";
      case "essential": return "Essencial";
      case "starter": return "Starter";
      default: return "Gratuito";
    }
  };

  const planBadgeClass = (plan: string | null) => {
    switch (plan) {
      case "pro": return "bg-primary text-primary-foreground";
      case "essential": return "bg-blue-600 text-white";
      case "starter": return "bg-emerald-600 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Status calculation
  const now = new Date();
  const isTrialActive = organization.trial_ends_at && new Date(organization.trial_ends_at) > now;
  const isPlanExpired = organization.plan_expires_at && new Date(organization.plan_expires_at) < now;
  const isPaid = ["starter", "essential", "pro"].includes(organization.plan || "");

  const getStatusLabel = () => {
    if (organization.cancel_at_period_end) return "Cancelamento pendente";
    if (isPlanExpired && isPaid) return "Vencido";
    if (isTrialActive) return "Em trial";
    if (isPaid && !isPlanExpired) return "Ativo";
    return "Free";
  };

  const getStatusBadgeClass = () => {
    const status = getStatusLabel();
    switch (status) {
      case "Ativo": return "bg-green-600 text-white";
      case "Em trial": return "bg-amber-500 text-white";
      case "Vencido": return "bg-destructive text-destructive-foreground";
      case "Cancelamento pendente": return "bg-orange-500 text-white";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Days remaining
  const daysRemaining = organization.plan_expires_at
    ? Math.max(0, differenceInDays(new Date(organization.plan_expires_at), now))
    : null;

  // WhatsApp phone (org phone or first member phone)
  const whatsappPhone = organization.phone || organization.profiles.find(p => p.phone)?.phone;
  const cleanPhone = whatsappPhone?.replace(/\D/g, "") || "";

  // Last access across all members
  const lastTeamAccess = organization.profiles
    .filter(p => p.last_access)
    .map(p => new Date(p.last_access!))
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              {organization.name}
            </DialogTitle>
            <DialogDescription>
              Visão completa da organização
            </DialogDescription>
          </DialogHeader>

          {/* Quick Actions Bar */}
          <div className="flex flex-wrap gap-2">
            {cleanPhone && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={`https://wa.me/55${cleanPhone}`} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  WhatsApp
                </a>
              </Button>
            )}
            {organization.email && (
              <Button
                variant="outline"
                size="sm"
                asChild
              >
                <a href={`mailto:${organization.email}`}>
                  <Mail className="h-4 w-4 mr-1" />
                  Email
                </a>
              </Button>
            )}
          </div>

          <div className="space-y-5">
            {/* BLOCO 1 — Dados do Cliente */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Users className="h-4 w-4 text-primary" />
                Dados do Cliente
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <InfoRow icon={<Building2 className="h-4 w-4" />} label="Empresa" value={organization.name} />
                {organization.cnpj_cpf && <InfoRow label="CNPJ/CPF" value={organization.cnpj_cpf} />}
                {organization.email && <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={organization.email} />}
                {organization.phone && <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={organization.phone} />}
                {(organization.city || organization.state) && (
                  <InfoRow icon={<MapPin className="h-4 w-4" />} label="Localização" value={[organization.city, organization.state].filter(Boolean).join(", ")} />
                )}
                <InfoRow icon={<Calendar className="h-4 w-4" />} label="Cadastro" value={format(new Date(organization.created_at), "dd/MM/yyyy", { locale: ptBR })} />
              </div>

              {/* Members list */}
              <div className="mt-2">
                <Label className="text-xs text-muted-foreground">Membros da equipe ({organization.profiles.length})</Label>
                <div className="border rounded-lg divide-y max-h-32 overflow-y-auto mt-1">
                  {organization.profiles.length === 0 ? (
                    <p className="p-2 text-xs text-muted-foreground">Nenhum membro</p>
                  ) : (
                    organization.profiles.map((profile) => (
                      <div key={profile.id} className="p-2 text-xs flex items-center justify-between gap-2">
                        <div className="flex flex-col">
                          <span className="font-medium">{profile.full_name || "Sem nome"}</span>
                          {profile.phone && <span className="text-muted-foreground">{profile.phone}</span>}
                        </div>
                        {profile.last_access && (
                          <span className="text-muted-foreground whitespace-nowrap">
                            {format(new Date(profile.last_access), "dd/MM HH:mm")}
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {/* BLOCO 2 — Plano e Assinatura */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <CreditCard className="h-4 w-4 text-primary" />
                Plano e Assinatura
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={planBadgeClass(organization.plan)}>
                  {planLabel(organization.plan)}
                </Badge>
                <Badge className={getStatusBadgeClass()}>
                  {getStatusLabel()}
                </Badge>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <InfoRow label="Valor" value={planInfo.price} />
                <InfoRow label="Limite" value={planInfo.limitLabel} />
                {organization.trial_started_at && (
                  <InfoRow label="Trial iniciado" value={format(new Date(organization.trial_started_at), "dd/MM/yyyy", { locale: ptBR })} />
                )}
                {organization.trial_ends_at && (
                  <InfoRow label="Trial termina" value={format(new Date(organization.trial_ends_at), "dd/MM/yyyy", { locale: ptBR })} />
                )}
                {organization.plan_expires_at && (
                  <InfoRow label="Expira/Renova" value={format(new Date(organization.plan_expires_at), "dd/MM/yyyy", { locale: ptBR })} />
                )}
                {daysRemaining !== null && (
                  <InfoRow label="Dias restantes" value={`${daysRemaining} dias`} />
                )}
                {organization.cancel_at_period_end && (
                  <div className="sm:col-span-2">
                    <Badge variant="destructive" className="text-xs">⚠ Cancelamento ao fim do período</Badge>
                  </div>
                )}
              </div>

              {/* Plan change */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 pt-1">
                <Select
                  value={selectedPlan || organization.plan || "free"}
                  onValueChange={handlePlanChange}
                  disabled={isUpdating}
                >
                  <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Alterar plano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Gratuito</SelectItem>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="essential">Essencial</SelectItem>
                    <SelectItem value="pro">Profissional</SelectItem>
                  </SelectContent>
                </Select>
                {isUpdating && <span className="text-xs text-muted-foreground">Atualizando...</span>}
              </div>
            </div>

            <Separator />

            {/* BLOCO 3 — Uso da Plataforma */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <BarChart3 className="h-4 w-4 text-primary" />
                Uso da Plataforma
              </div>
              <div className="grid grid-cols-2 gap-3">
                <MetricCard label="Serviços (mês)" value={usageData?.currentMonthServices ?? 0} />
                <MetricCard label="Serviços (total)" value={usageData?.totalServices ?? 0} />
                <MetricCard label="Membros" value={organization.profiles.length} />
                <MetricCard
                  label="Último acesso"
                  value={lastTeamAccess ? format(lastTeamAccess, "dd/MM HH:mm") : "—"}
                />
              </div>
            </div>

            <Separator />

            {/* BLOCO 4 — Ações */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Settings className="h-4 w-4 text-primary" />
                Ações
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmDelete(true)}
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir Organização
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir organização e todos os dados?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja excluir a organização <strong>{organization.name}</strong>?
              <br /><br />
              Esta ação é <strong>irreversível</strong> e pode remover também usuários, dependências e dados relacionados, incluindo:
              <ul className="list-disc list-inside mt-2">
                <li>{organization.profiles.length} usuário(s) vinculado(s)</li>
                <li>Todos os clientes, serviços e transações</li>
                <li>Configurações, convites e preferências</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {isDeleting ? "Excluindo..." : "Excluir organização e todos os dados vinculados"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Helper components
function InfoRow({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0">
      {icon && <span className="text-muted-foreground shrink-0 mt-0.5">{icon}</span>}
      <span className="text-muted-foreground shrink-0">{label}:</span>
      <span className="font-medium truncate min-w-0">{value}</span>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
