import { useState } from "react";
import {
  AlertTriangle, Unplug, ChevronDown, ChevronRight,
  CheckSquare, Square, ArrowRight, Loader2, Users, Wifi, WifiOff
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  useOrphanedRecurrenceContacts,
  OrphanedGroup,
  OrphanedRecurrenceContact,
} from "@/hooks/useOrphanedRecurrenceContacts";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string; icon: React.ElementType }> = {
    deleted: { label: "Excluído", className: "bg-destructive/10 text-destructive border-destructive/20", icon: Unplug },
    disconnected: { label: "Desconectado", className: "bg-warning/10 text-warning border-warning/20", icon: WifiOff },
    error: { label: "Erro", className: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
    unknown: { label: "Não encontrado", className: "bg-muted text-muted-foreground", icon: Unplug },
  };
  const c = config[status] || config.unknown;
  const Icon = c.icon;

  return (
    <Badge variant="outline" className={cn("text-[10px] gap-1", c.className)}>
      <Icon className="h-2.5 w-2.5" />
      {c.label}
    </Badge>
  );
}

function GroupSection({
  group,
  selected,
  onToggle,
  onToggleAll,
}: {
  group: OrphanedGroup;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (ids: string[], checked: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const contactWaIds = group.contacts.map(c => c.whatsappContactId).filter(Boolean) as string[];
  const allSelected = contactWaIds.length > 0 && contactWaIds.every(id => selected.has(id));
  const someSelected = contactWaIds.some(id => selected.has(id));

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">
            {group.channelName}
          </span>
          <StatusBadge status={group.channelStatus} />
          <Badge variant="secondary" className="text-[10px] gap-1">
            <Users className="h-2.5 w-2.5" />
            {group.contacts.length} {group.contacts.length === 1 ? "contato" : "contatos"}
          </Badge>
        </div>
      </button>

      {expanded && (
        <div className="divide-y divide-border">
          {/* Select all row */}
          <div className="flex items-center gap-3 px-3 py-2 bg-muted/10">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => onToggleAll(contactWaIds, !!checked)}
              className={cn(someSelected && !allSelected && "opacity-60")}
            />
            <span className="text-xs text-muted-foreground font-medium">
              {allSelected ? "Desmarcar todos" : "Selecionar todos"} deste grupo
            </span>
          </div>

          {group.contacts.map((contact) => (
            <ContactRow
              key={contact.recurrenceEntryId}
              contact={contact}
              isSelected={!!contact.whatsappContactId && selected.has(contact.whatsappContactId)}
              onToggle={() => contact.whatsappContactId && onToggle(contact.whatsappContactId)}
              disabled={!contact.whatsappContactId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ContactRow({
  contact,
  isSelected,
  onToggle,
  disabled,
}: {
  contact: OrphanedRecurrenceContact;
  isSelected: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-2.5 hover:bg-muted/20 transition-colors",
      isSelected && "bg-primary/5"
    )}>
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggle}
        disabled={disabled}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground truncate">{contact.clientName}</span>
          {contact.clientPhone && (
            <span className="text-xs text-muted-foreground">{contact.clientPhone}</span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
          <span>{contact.lastServiceType}</span>
          <span>{format(new Date(contact.lastServiceDate), "dd/MM/yyyy", { locale: ptBR })}</span>
          <span className="text-destructive font-medium">{contact.blockReason}</span>
        </div>
      </div>
      {disabled && (
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          Sem contato WA
        </Badge>
      )}
    </div>
  );
}

export function OrphanedRecurrenceAlert() {
  const { groups, total, isLoading, reassign, isReassigning } = useOrphanedRecurrenceContacts();
  const { channels } = useWhatsAppChannels();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetChannelId, setTargetChannelId] = useState<string>("");
  const [showDetails, setShowDetails] = useState(false);

  const connectedChannels = channels.filter(c => c.is_connected && c.channel_status === "connected");

  if (isLoading || total === 0) return null;

  const handleToggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleToggleAll = (ids: string[], checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const handleReassign = async () => {
    if (selected.size === 0 || !targetChannelId) return;

    try {
      const result = await reassign({
        contactIds: Array.from(selected),
        newChannelId: targetChannelId,
      });
      toast.success(`${result.count} contato(s) reatribuído(s) com sucesso`);
      setSelected(new Set());
      setTargetChannelId("");
    } catch (err) {
      toast.error("Erro ao reatribuir contatos");
    }
  };

  return (
    <Card className="border-warning/40 bg-warning/5">
      <CardContent className="p-4 space-y-3">
        {/* Summary banner */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10">
            <Unplug className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {total} {total === 1 ? "recorrência bloqueada" : "recorrências bloqueadas"} por canal inválido
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total === 1 ? "Este contato não receberá" : "Estes contatos não receberão"} mensagens automáticas até serem reatribuídos a um canal ativo.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="shrink-0 gap-1.5"
          >
            {showDetails ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {showDetails ? "Ocultar" : "Corrigir"}
          </Button>
        </div>

        {showDetails && (
          <div className="space-y-3 pt-1">
            {/* Groups */}
            {groups.map((group) => (
              <GroupSection
                key={group.channelId || "no-channel"}
                group={group}
                selected={selected}
                onToggle={handleToggle}
                onToggleAll={handleToggleAll}
              />
            ))}

            {/* Reassignment action bar */}
            {selected.size > 0 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 bg-card border border-border rounded-lg">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge variant="secondary" className="shrink-0 gap-1">
                    <CheckSquare className="h-3 w-3" />
                    {selected.size} selecionado(s)
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 hidden sm:block" />
                  <Select value={targetChannelId} onValueChange={setTargetChannelId}>
                    <SelectTrigger className="flex-1 min-w-[180px]">
                      <SelectValue placeholder="Escolher novo canal..." />
                    </SelectTrigger>
                    <SelectContent>
                      {connectedChannels.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-muted-foreground">
                          Nenhum canal conectado disponível
                        </div>
                      ) : (
                        connectedChannels.map((ch) => (
                          <SelectItem key={ch.id} value={ch.id}>
                            <div className="flex items-center gap-2">
                              <Wifi className="h-3 w-3 text-success" />
                              <span>{ch.name}</span>
                              {ch.phone_number && (
                                <span className="text-muted-foreground text-xs">({ch.phone_number})</span>
                              )}
                            </div>
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleReassign}
                  disabled={!targetChannelId || isReassigning}
                  className="gap-2 shrink-0"
                >
                  {isReassigning ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Reatribuindo...</>
                  ) : (
                    <>Reatribuir canal</>
                  )}
                </Button>
              </div>
            )}

            {connectedChannels.length === 0 && (
              <div className="text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg p-3">
                ⚠️ Você não tem nenhum canal conectado. Conecte um canal de WhatsApp para poder reatribuir esses contatos.
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
