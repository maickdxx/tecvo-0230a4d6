import { useState } from "react";
import { Mail, Loader2, X, Clock, Briefcase, Shield, User, Link2, Copy, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useInvites, type Invite } from "@/hooks/useInvites";
import { useSubscription } from "@/hooks/useSubscription";
import type { AppRole } from "@/hooks/useUserRole";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const ROLE_LABELS: Record<Exclude<AppRole, "owner">, string> = {
  admin: "ADM",
  member: "Atendente",
  employee: "Funcionário (Técnico de Rua)",
};

const ROLE_ICONS: Record<Exclude<AppRole, "owner">, typeof Shield> = {
  admin: Shield,
  member: User,
  employee: Briefcase,
};

const ROLE_COLORS: Record<Exclude<AppRole, "owner">, string> = {
  admin: "bg-blue-500/10 text-blue-600 border-blue-200",
  member: "bg-green-500/10 text-green-600 border-green-200",
  employee: "bg-purple-500/10 text-purple-600 border-purple-200",
};

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AppRole>("employee");
  const { invites, isLoading, createInvite, isCreating, createInviteLink, isCreatingLink, deleteInvite, isDeleting, copyInviteLink } = useInvites();
  const { canInviteMembers, maxUsers } = useSubscription();

  const handleGenerateLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    createInviteLink(
      { email: email.trim().toLowerCase(), role, maxUsers },
      {
        onSuccess: () => {
          setEmail("");
          setRole("employee");
        },
      }
    );
  };

  const handleSendEmail = () => {
    if (!email.trim()) return;

    createInvite(
      { email: email.trim().toLowerCase(), role, maxUsers },
      {
        onSuccess: () => {
          setEmail("");
          setRole("employee");
        },
      }
    );
  };

  const pendingInvites = invites.filter((i) => !i.accepted_at);

  // Show upgrade message for Free plan
  if (!canInviteMembers) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-8 text-center">
          <Crown className="h-12 w-12 mx-auto mb-4 text-primary" />
          <h3 className="font-semibold text-lg mb-2">Recurso PRO</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            No plano Free, apenas o proprietário pode usar o sistema.
            Faça upgrade para PRO para convidar funcionários e membros da equipe.
          </p>
          <Button asChild>
            <Link to="/configuracoes?tab=assinatura">
              <Crown className="mr-2 h-4 w-4" />
              Fazer upgrade para PRO
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invite Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Convidar Membro
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleGenerateLink} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr,auto,auto]">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isCreatingLink}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Função</Label>
                <Select
                  value={role}
                  onValueChange={(value) => setRole(value as AppRole)}
                  disabled={isCreatingLink}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">ADM</SelectItem>
                    <SelectItem value="member">Atendente</SelectItem>
                    <SelectItem value="employee">Funcionário (Técnico de Rua)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" variant="outline" disabled={isCreatingLink || isCreating || !email.trim()}>
                  {isCreatingLink ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="mr-2 h-4 w-4" />
                  )}
                  Gerar Link
                </Button>
                <Button type="button" onClick={handleSendEmail} disabled={isCreating || isCreatingLink || !email.trim()}>
                  {isCreating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="mr-2 h-4 w-4" />
                  )}
                  Enviar Email
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Convites Pendentes ({pendingInvites.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingInvites.map((invite) => (
              <InviteRow
                key={invite.id}
                invite={invite}
                onDelete={() => deleteInvite(invite.id)}
                isDeleting={isDeleting}
                onCopyLink={copyInviteLink}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex justify-center py-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}

function InviteRow({
  invite,
  onDelete,
  isDeleting,
  onCopyLink,
}: {
  invite: Invite;
  onDelete: () => void;
  isDeleting: boolean;
  onCopyLink: (token: string) => void;
}) {
  const RoleIcon = ROLE_ICONS[invite.role as Exclude<AppRole, "owner">] || User;
  const roleLabel = ROLE_LABELS[invite.role as Exclude<AppRole, "owner">] || invite.role;
  const roleColor = ROLE_COLORS[invite.role as Exclude<AppRole, "owner">] || "";

  const timeAgo = formatDistanceToNow(new Date(invite.created_at), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{invite.email}</p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge className={roleColor} variant="outline">
              <RoleIcon className="h-3 w-3 mr-1" />
              {roleLabel}
            </Badge>
            <span>·</span>
            <span>{timeAgo}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onCopyLink(invite.token)}
          className="text-muted-foreground hover:text-primary"
          title="Copiar link"
        >
          <Copy className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={isDeleting}
          className="text-muted-foreground hover:text-destructive"
          title="Cancelar convite"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
