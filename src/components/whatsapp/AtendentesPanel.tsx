import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";

interface AtendentesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: "Gestor",
  admin: "Administrador",
  member: "Atendente",
  employee: "Técnico",
};

export function AtendentesDialog({ open, onOpenChange, embedded }: AtendentesDialogProps) {
  const { members, isLoading: membersLoading } = useTeamMembers();
  const { organization } = useOrganization();

  // Fetch last_access for all org members
  const { data: accessData = [] } = useQuery({
    queryKey: ["atendentes-status", organization?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, last_access, avatar_url")
        .eq("organization_id", organization!.id);
      return data || [];
    },
    enabled: (open || !!embedded) && !!organization?.id,
    refetchInterval: (open || embedded) ? 30_000 : false,
  });

  const isOnline = (userId: string) => {
    const profile = accessData.find((p) => p.user_id === userId);
    if (!profile?.last_access) return false;
    const diff = Date.now() - new Date(profile.last_access).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  const getAvatar = (userId: string) =>
    accessData.find((p) => p.user_id === userId)?.avatar_url;

  // Filter out employees (técnicos) - they don't attend WhatsApp
  const attendants = members.filter((m) => m.role !== "employee");

  const sorted = [...attendants].sort((a, b) => {
    const aOn = isOnline(a.user_id) ? 0 : 1;
    const bOn = isOnline(b.user_id) ? 0 : 1;
    return aOn - bOn;
  });

  const innerContent = (
    <div className="space-y-1 max-h-[400px] overflow-y-auto">
      {membersLoading ? (
        <p className="text-sm text-muted-foreground text-center py-6">Carregando...</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum membro encontrado</p>
      ) : (
        sorted.map((m) => {
              const online = isOnline(m.user_id);
              const avatar = getAvatar(m.user_id);
              const initial = m.full_name?.charAt(0).toUpperCase() || "?";

              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  {/* Avatar with status dot */}
                  <div className="relative">
                    <div className="h-9 w-9 rounded-full overflow-hidden bg-primary/10 flex items-center justify-center shrink-0">
                      {avatar ? (
                        <img src={avatar} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-xs font-semibold text-primary">{initial}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        "absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background",
                        online ? "bg-green-500" : "bg-muted-foreground/40"
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{m.full_name || "Sem nome"}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {ROLE_LABELS[m.role] || m.role}
                      {m.field_worker && " · Campo"}
                    </p>
                  </div>

                  {/* Status label */}
                  <span
                    className={cn(
                      "text-[11px] font-medium shrink-0",
                      online ? "text-green-600" : "text-muted-foreground"
                    )}
                  >
                    {online ? "Online" : "Offline"}
                  </span>
                </div>
              );
            })
      )}
    </div>
  );

  if (embedded) {
    return (
      <div>
        <h2 className="text-lg font-bold tracking-tight text-foreground mb-4 flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Atendentes
        </h2>
        {innerContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Atendentes
          </DialogTitle>
        </DialogHeader>
        {innerContent}
      </DialogContent>
    </Dialog>
  );
}
