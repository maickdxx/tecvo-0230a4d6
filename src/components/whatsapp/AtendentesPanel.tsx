import { useState } from "react";
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
import { Users, Search, Activity, UserCheck, UserMinus, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch last_access for all org members
  const { data: accessData = [], isLoading: accessLoading } = useQuery({
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

  const getProfileData = (userId: string) => 
    accessData.find((p) => p.user_id === userId);

  const isOnline = (userId: string) => {
    const profile = getProfileData(userId);
    if (!profile?.last_access) return false;
    const diff = Date.now() - new Date(profile.last_access).getTime();
    return diff < 5 * 60 * 1000; // 5 minutes
  };

  const attendants = members.filter((m) => m.role !== "employee");
  
  const filteredAttendants = attendants.filter((m) => 
    (m.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sorted = [...filteredAttendants].sort((a, b) => {
    const aOn = isOnline(a.user_id) ? 0 : 1;
    const bOn = isOnline(b.user_id) ? 0 : 1;
    if (aOn !== bOn) return aOn - bOn;
    return (a.full_name || "").localeCompare(b.full_name || "");
  });

  const onlineCount = attendants.filter(m => isOnline(m.user_id)).length;
  const offlineCount = attendants.length - onlineCount;

  const innerContent = (
    <div className="space-y-4">
      {/* Search and Summary */}
      <div className="space-y-4 mb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atendente..."
            className="pl-9 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {!searchTerm && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 dark:bg-green-950/20 p-3 rounded-xl border border-green-100 dark:border-green-900/30 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center">
                <UserCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-green-800 dark:text-green-300">Online</p>
                <p className="text-lg font-bold text-green-900 dark:text-green-100 leading-none">{onlineCount}</p>
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-500/10 flex items-center justify-center">
                <UserMinus className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-800 dark:text-slate-300">Offline</p>
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100 leading-none">{offlineCount}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {membersLoading || accessLoading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 px-4">
            <Users className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {searchTerm ? "Nenhum atendente encontrado para sua busca." : "Sua equipe de atendimento está vazia."}
            </p>
          </div>
        ) : (
          sorted.map((m) => {
            const online = isOnline(m.user_id);
            const profile = getProfileData(m.user_id);
            const initial = (m.full_name || "?").charAt(0).toUpperCase();

            return (
              <div
                key={m.user_id}
                className={cn(
                  "group flex items-center gap-4 rounded-xl p-3 transition-all duration-200 border",
                  online 
                    ? "bg-card border-slate-100 dark:border-slate-800 hover:border-green-200 dark:hover:border-green-900/50 shadow-sm" 
                    : "bg-muted/20 border-transparent opacity-80"
                )}
              >
                {/* Avatar with status indicator */}
                <div className="relative shrink-0">
                  <Avatar className="h-11 w-11 border-2 border-background shadow-sm">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="bg-primary/5 text-primary font-bold text-sm">
                      {initial}
                    </AvatarFallback>
                  </Avatar>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-background",
                      online ? "bg-green-500 ring-2 ring-green-500/20" : "bg-slate-400"
                    )}
                  />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {m.full_name || "Sem nome"}
                    </p>
                    {online && (
                      <Badge variant="outline" className="h-5 text-[10px] px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50">
                        Ativo
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Activity className="h-3 w-3" />
                      {ROLE_LABELS[m.role] || m.role}
                    </span>
                    {profile?.last_access && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" />
                        Visto {formatDistanceToNow(new Date(profile.last_access), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Status indicator dot/badge */}
                <div className="hidden sm:block">
                   <div className={cn(
                      "h-2 w-2 rounded-full",
                      online ? "bg-green-500 animate-pulse" : "bg-muted-foreground/20"
                   )} />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                Atendentes
              </h2>
              <p className="text-sm text-muted-foreground">Gestão de equipe em tempo real</p>
            </div>
          </div>
        </div>
        {innerContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 gap-0">
        <DialogHeader className="mb-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <Users className="h-5 w-5" />
            </div>
            Atendentes
          </DialogTitle>
        </DialogHeader>
        {innerContent}
      </DialogContent>
    </Dialog>
  );
}
