import { useState } from "react";
import { ArrowLeft, Users, Crown, Shield, User, Briefcase, Trash2, Loader2, KeyRound, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import { useTeamMembers, type TeamMember } from "@/hooks/useTeamMembers";
import { useUserRole, type AppRole } from "@/hooks/useUserRole";
import { useAuth } from "@/hooks/useAuth";
import { InviteForm } from "./InviteForm";
import { MemberPermissionsEditor } from "./MemberPermissionsEditor";
import { MemberDetailsEditor } from "./MemberDetailsEditor";
import { useOrganization } from "@/hooks/useOrganization";

interface TeamSettingsProps {
  onBack: () => void;
}

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super ADM",
  owner: "Gestor",
  admin: "ADM",
  member: "Atendente",
  employee: "Funcionário",
};

const ROLE_ICONS: Record<AppRole, typeof Crown> = {
  super_admin: Shield,
  owner: Crown,
  admin: Shield,
  member: User,
  employee: Briefcase,
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: "bg-red-500/10 text-red-600 border-red-200",
  owner: "bg-amber-500/10 text-amber-600 border-amber-200",
  admin: "bg-blue-500/10 text-blue-600 border-blue-200",
  member: "bg-green-500/10 text-green-600 border-green-200",
  employee: "bg-purple-500/10 text-purple-600 border-purple-200",
};

export function TeamSettings({ onBack }: TeamSettingsProps) {
  const [memberToDelete, setMemberToDelete] = useState<TeamMember | null>(null);
  const [expandedPermissions, setExpandedPermissions] = useState<string | null>(null);
  const [expandedDetails, setExpandedDetails] = useState<string | null>(null);
  const { members, isLoading, error, updateRole, isUpdating, updateFieldWorker, isUpdatingFieldWorker, deleteMember, isDeleting } = useTeamMembers();
  const { isOwner, isAdmin } = useUserRole();
  const { user } = useAuth();
  const { organization } = useOrganization();

  const canManageRoles = isOwner || isAdmin;

  const handleDeleteConfirm = () => {
    if (memberToDelete) {
      deleteMember(memberToDelete.user_id);
      setMemberToDelete(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    console.error("TeamSettings error:", error);
  }

  return (
    <div>
      <Button
        variant="ghost"
        onClick={onBack}
        className="mb-4 -ml-2 text-muted-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Voltar
      </Button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Equipe</h1>
        <p className="text-muted-foreground">
          Gerencie os membros da sua organização
        </p>
      </div>

      {/* Invite Form Section - component handles plan check internally */}
      <div className="mb-6">
        <InviteForm />
      </div>

      {/* Team Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Membros ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {members.map((member) => {
            const RoleIcon = ROLE_ICONS[member.role];
            const isOwnerRole = member.role === "owner";
            const isSelf = member.user_id === user?.id;

            return (
              <div key={member.id} className="space-y-0">
                <div
                  className="p-4 rounded-lg border bg-card space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <span className="text-sm font-medium">
                          {member.full_name?.charAt(0)?.toUpperCase() || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">
                          {member.full_name || "Sem nome"}
                          {isSelf && <span className="text-muted-foreground ml-1">(você)</span>}
                        </p>
                        <Badge className={ROLE_COLORS[member.role]} variant="outline">
                          <RoleIcon className="h-3 w-3 mr-1" />
                          {ROLE_LABELS[member.role]}
                        </Badge>
                      </div>
                    </div>

                    {canManageRoles && !isOwnerRole && (
                      <Select
                        value={member.role}
                        onValueChange={(value) =>
                          updateRole({ userId: member.user_id, role: value as AppRole })
                        }
                        disabled={isUpdating}
                      >
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">ADM</SelectItem>
                          <SelectItem value="member">Atendente</SelectItem>
                          <SelectItem value="employee">Funcionário</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>

                  {/* Field Worker Toggle */}
                  {canManageRoles && (
                    <div className="flex items-center justify-between border-t border-border pt-3">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">Atua em Campo?</p>
                          <p className="text-xs text-muted-foreground">
                            Recebe serviços, acessa "Meu Dia" e aparece como técnico na OS
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={member.field_worker}
                        onCheckedChange={(checked) =>
                          updateFieldWorker({ userId: member.user_id, fieldWorker: checked })
                        }
                        disabled={isUpdatingFieldWorker}
                      />
                    </div>
                  )}

                  {canManageRoles && !isOwnerRole && (
                    <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground flex-1 min-w-[120px]"
                        onClick={() =>
                          setExpandedDetails(prev =>
                            prev === member.user_id ? null : member.user_id
                          )
                        }
                      >
                        <Briefcase className="h-4 w-4 mr-1" />
                        Dados RH
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        className="text-muted-foreground flex-1 min-w-[120px]"
                        onClick={() =>
                          setExpandedPermissions(prev =>
                            prev === member.user_id ? null : member.user_id
                          )
                        }
                      >
                        <KeyRound className="h-4 w-4 mr-1" />
                        Permissões
                      </Button>

                      {!isSelf && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setMemberToDelete(member)}
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {expandedDetails === member.user_id && (
                  <MemberDetailsEditor userId={member.user_id} />
                )}

                {expandedPermissions === member.user_id && organization && (
                  <MemberPermissionsEditor
                    userId={member.user_id}
                    organizationId={organization.id}
                    memberRole={member.role}
                  />
                )}
              </div>
            );
          })}

          {members.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum membro encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!memberToDelete} onOpenChange={() => setMemberToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover <strong>{memberToDelete?.full_name || "este membro"}</strong> da equipe? 
              Esta ação é irreversível e o usuário perderá acesso ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? "Removendo..." : "Remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
