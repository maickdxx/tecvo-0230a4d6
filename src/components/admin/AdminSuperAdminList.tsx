import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Shield, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { PlatformUser, SuperAdminGrant } from "@/hooks/useAdminUsers";

interface AdminSuperAdminListProps {
  users: PlatformUser[];
  grants: SuperAdminGrant[];
  onGrant: (userId: string) => void;
  onRevoke: (userId: string) => void;
  isGranting: boolean;
  isRevoking: boolean;
}

export function AdminSuperAdminList({
  users,
  grants,
  onGrant,
  onRevoke,
  isGranting,
  isRevoking,
}: AdminSuperAdminListProps) {
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [showGrantDialog, setShowGrantDialog] = useState(false);

  // Enrich grants with user info
  const enrichedGrants = grants.map((grant) => {
    const grantedUser = users.find((u) => u.user_id === grant.user_id);
    const grantedByUser = grant.granted_by
      ? users.find((u) => u.user_id === grant.granted_by)
      : null;
    return { ...grant, grantedUser, grantedByUser };
  });

  // Users eligible to become super admin
  const eligibleUsers = users.filter(
    (u) => !u.roles.includes("super_admin")
  );

  const handleGrant = (userId: string) => {
    onGrant(userId);
    setShowGrantDialog(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Super Admins ({grants.length})
        </h3>
        <Button size="sm" onClick={() => setShowGrantDialog(true)} disabled={isGranting}>
          <UserPlus className="h-4 w-4 mr-2" />
          Tornar Super Admin
        </Button>
      </div>

      <div className="grid gap-3">
        {enrichedGrants.map((grant) => (
          <Card key={grant.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">
                    {grant.grantedUser?.full_name || grant.grantedUser?.email || grant.user_id}
                  </span>
                  {grant.is_root && (
                    <Badge variant="destructive" className="text-xs">Raiz</Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {grant.grantedUser?.email}
                </p>
                <p className="text-xs text-muted-foreground">
                  Concedido em {format(new Date(grant.granted_at), "dd/MM/yyyy", { locale: ptBR })}
                  {grant.grantedByUser && (
                    <> por {grant.grantedByUser.full_name || grant.grantedByUser.email}</>
                  )}
                  {grant.is_root && !grant.granted_by && " (automático)"}
                </p>
              </div>
              {!grant.is_root && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setRevokeTarget(grant.user_id)}
                  disabled={isRevoking}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </CardContent>
          </Card>
        ))}

        {grants.length === 0 && (
          <p className="text-center py-8 text-muted-foreground">
            Nenhum super admin encontrado
          </p>
        )}
      </div>

      {/* Grant Dialog */}
      <Dialog open={showGrantDialog} onOpenChange={setShowGrantDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tornar Super Admin</DialogTitle>
            <DialogDescription>Selecione o usuário que receberá permissão global</DialogDescription>
          </DialogHeader>
          <Command className="border rounded-lg">
            <CommandInput placeholder="Buscar por nome ou email..." />
            <CommandList className="max-h-64">
              <CommandEmpty>Nenhum usuário encontrado</CommandEmpty>
              {eligibleUsers.map((u) => (
                <CommandItem
                  key={u.user_id}
                  value={`${u.full_name || ""} ${u.email}`}
                  onSelect={() => handleGrant(u.user_id)}
                  className="cursor-pointer"
                >
                  <div>
                    <p className="font-medium">{u.full_name || "Sem nome"}</p>
                    <p className="text-sm text-muted-foreground">{u.email}</p>
                  </div>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      {/* Revoke Confirm */}
      <AlertDialog open={!!revokeTarget} onOpenChange={(open) => !open && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Super Admin</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover as permissões de Super Admin deste usuário?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (revokeTarget) onRevoke(revokeTarget);
                setRevokeTarget(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isRevoking ? "Removendo..." : "Sim, remover"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
