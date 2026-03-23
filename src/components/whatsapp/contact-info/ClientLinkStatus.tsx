import { Link2, LinkIcon, UserPlus, Repeat2, User, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface ClientLinkStatusProps {
  isLinked: boolean;
  isAutoLinking: boolean;
  onLinkClient: () => void;
  onChangeLink: () => void;
  onRegisterClient?: () => void;
}

export function ClientLinkStatus({ isLinked, isAutoLinking, onLinkClient, onChangeLink, onRegisterClient }: ClientLinkStatusProps) {
  if (isAutoLinking) {
    return (
      <div className="flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-muted/50 border border-border">
        <div className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-muted-foreground">Buscando cliente...</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Status badge */}
      <div className="flex items-center justify-between gap-2">
        {isLinked ? (
          <>
            <Badge variant="outline" className="gap-1 text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
              <Users className="h-3 w-3" />
              Cliente
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 text-muted-foreground hover:text-foreground"
              onClick={onChangeLink}
            >
              <Repeat2 className="h-3 w-3" />
              Trocar
            </Button>
          </>
        ) : (
          <>
            <Badge variant="outline" className="gap-1 text-[11px] text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 bg-amber-500/10">
              <User className="h-3 w-3" />
              Contato
            </Badge>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[11px] gap-1"
              onClick={onLinkClient}
            >
              <Link2 className="h-3 w-3" />
              Vincular existente
            </Button>
          </>
        )}
      </div>

      {/* Register as client action - only when not linked */}
      {!isLinked && onRegisterClient && (
        <Button
          variant="default"
          size="sm"
          className="w-full gap-1.5 text-xs h-8"
          onClick={onRegisterClient}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Cadastrar como cliente
        </Button>
      )}
    </div>
  );
}
