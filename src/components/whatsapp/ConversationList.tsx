import { Search, X, UserPlus, MessageSquarePlus, Plus, CheckSquare, Square, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { ConversationItem } from "./ConversationItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { WhatsAppTag, getTagColorStyle } from "@/hooks/useWhatsAppTags";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { CONVERSION_STEPS, getConversionStep } from "./ConversionStatusSelector";

interface ConversationListProps {
  contacts: any[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedContactId: string | null;
  onSelectContact: (id: string) => void;
  currentUserId?: string | null;
  teamMembers?: { user_id: string; full_name: string | null }[];
  orgTags?: WhatsAppTag[];
  onNewContact?: () => void;
  onNewConversation?: () => void;
  onDeleteConversation?: (contactId: string) => void;
  onMarkUnread?: (contactId: string) => void;
  onFinalizeConversation?: (contactId: string) => void;
  onRefresh?: () => void;
  loadingMore?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

type StatusFilter = "all" | "novas" | "atendendo" | "aguardando" | "finalizado";
type ConversionFilter = string | null;

function formatCount(count: number): string {
  return count > 99 ? "99+" : String(count);
}

export function ConversationList({
  contacts,
  loading,
  searchTerm,
  onSearchChange,
  selectedContactId,
  onSelectContact,
  currentUserId,
  teamMembers = [],
  orgTags = [],
  onNewContact,
  onNewConversation,
  onDeleteConversation,
  onMarkUnread,
  onFinalizeConversation,
  onRefresh,
  loadingMore,
  hasMore,
  onLoadMore,
}: ConversationListProps) {
  const { organization } = useOrganization();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("atendendo");
  const [tagFilters, setTagFilters] = useState<string[]>([]);
  const [conversionFilter, setConversionFilter] = useState<ConversionFilter>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scheduledContactIds, setScheduledContactIds] = useState<Set<string>>(new Set());

  // Fetch contact IDs that have pending scheduled messages
  useEffect(() => {
    if (!organization?.id) return;
    const fetchScheduled = async () => {
      const { data } = await supabase
        .from("whatsapp_scheduled_messages")
        .select("contact_id")
        .eq("organization_id", organization.id)
        .eq("status", "scheduled");
      if (data) {
        setScheduledContactIds(new Set(data.map((d: any) => d.contact_id)));
      }
    };
    fetchScheduled();

    // Refresh when scheduled messages change
    const channel = supabase
      .channel("scheduled-msgs-list")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "whatsapp_scheduled_messages",
        filter: `organization_id=eq.${organization.id}`,
      }, () => { fetchScheduled(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [organization?.id]);

  // Counts per status
  // "Aguardando" is an attention layer: unread messages from client, across ALL statuses (except resolvido)
  const isAguardando = (c: any) => {
    const s = c.conversation_status || "novo";
    return s !== "resolvido" && (c.unread_count > 0 || c.is_unread) && c.last_message_is_from_me !== true;
  };

  const hasUnread = (c: any) => (c.unread_count > 0 || c.is_unread);

  const novasCount = contacts.filter(c => {
    const s = c.conversation_status || "novo";
    return s === "novo" && hasUnread(c);
  }).length;
  const atendendoCount = contacts.filter(c =>
    c.conversation_status === "atendendo" && hasUnread(c)
  ).length;
  const aguardandoCount = contacts.filter(c => isAguardando(c)).length;
  const finalizadoCount = contacts.filter(c => c.conversation_status === "resolvido" && hasUnread(c)).length;

  const toggleTagFilter = (tagName: string) => {
    setTagFilters(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  const filtered = contacts.filter((c) => {
    // When searching, ignore status filter to show results across all tabs
    if (!searchTerm.trim()) {
      const status = c.conversation_status || "novo";
      if (statusFilter === "novas" && status !== "novo") return false;
      if (statusFilter === "atendendo" && status !== "atendendo") return false;
      if (statusFilter === "aguardando" && !isAguardando(c)) return false;
      if (statusFilter === "finalizado" && status !== "resolvido") return false;
    }
    // Conversion pipeline filter
    if (conversionFilter) {
      if ((c.conversion_status || "novo_contato") !== conversionFilter) return false;
    }
    if (tagFilters.length > 0) {
      const cTags: string[] = c.tags || [];
      if (!tagFilters.some(tf => cTags.includes(tf))) return false;
    }
    return true;
  });

  const toggleCheck = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }, [filtered, selectedIds.size]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleBulkFinalize = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(selectedIds);
      const { error } = await supabase
        .from("whatsapp_contacts")
        .update({ conversation_status: "resolvido" })
        .in("id", ids);
      if (error) throw error;
      toast.success(`${ids.length} conversa(s) finalizada(s)`);
      exitSelectionMode();
      onRefresh?.();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao finalizar conversas");
    } finally {
      setBulkLoading(false);
    }
  }, [selectedIds, exitSelectionMode, onRefresh]);

  // Infinite scroll handler
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !onLoadMore || !hasMore) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = el;
      if (scrollHeight - scrollTop - clientHeight < 200) {
        onLoadMore();
      }
    };

    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [onLoadMore, hasMore]);

  const filters: { key: StatusFilter; label: string; count: number }[] = [
    { key: "novas", label: "Novas", count: novasCount },
    { key: "atendendo", label: "Em atendimento", count: atendendoCount },
    { key: "aguardando", label: "Aguardando", count: aguardandoCount },
    { key: "finalizado", label: "Finalizados", count: finalizadoCount },
  ];

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Conversas</h2>
        <div className="flex items-center gap-1">
          {!selectionMode ? (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelectionMode(true)} title="Selecionar">
              <CheckSquare className="h-4 w-4" />
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={exitSelectionMode}>
              Cancelar
            </Button>
          )}
          {!selectionMode && (onNewConversation || onNewContact) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <Plus className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {onNewConversation && (
                  <DropdownMenuItem onClick={onNewConversation}>
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Nova conversa
                  </DropdownMenuItem>
                )}
                {onNewContact && (
                  <DropdownMenuItem onClick={onNewContact}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Novo contato
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {selectionMode && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={toggleSelectAll}
          >
            {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
            {allSelected ? "Desmarcar" : "Selecionar todas"}
          </Button>
          {selectedIds.size > 0 && (
            <Button
              variant="default"
              size="sm"
              className="h-7 text-xs"
              disabled={bulkLoading}
              onClick={handleBulkFinalize}
            >
              {bulkLoading ? "Finalizando..." : `Finalizar (${selectedIds.size})`}
            </Button>
          )}
        </div>
      )}

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar nome, telefone ou mensagem..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Status Filters */}
      <div className="px-3 pb-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => { setStatusFilter(prev => prev === f.key ? "all" : f.key); setSelectedIds(new Set()); }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
              statusFilter === f.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {f.label}
            {f.count > 0 && (
              <span className={cn(
                "text-[10px] rounded-full px-1.5 min-w-[18px] text-center",
                f.key !== "finalizado"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground"
              )}>
                {f.key !== "finalizado" ? formatCount(f.count) : `(${formatCount(f.count)})`}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Pipeline (Conversion) Filter */}
      <div className="px-3 pb-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
                conversionFilter
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <Filter className="h-3 w-3" />
              {conversionFilter ? getConversionStep(conversionFilter).label : "Pipeline"}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuLabel className="text-[11px]">Pipeline de conversão</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setConversionFilter(null)}>
              <span className={cn("text-xs", !conversionFilter && "font-semibold")}>Todos</span>
            </DropdownMenuItem>
            {CONVERSION_STEPS.map((step) => {
              const StepIcon = step.icon;
              const count = contacts.filter((c) => (c.conversion_status || "novo_contato") === step.key).length;
              return (
                <DropdownMenuItem key={step.key} onClick={() => setConversionFilter(step.key)}>
                  <StepIcon className={cn("h-4 w-4 mr-2", step.color)} />
                  <span className={cn("text-xs flex-1", conversionFilter === step.key && "font-semibold")}>{step.label}</span>
                  {count > 0 && (
                    <span className="text-[10px] text-muted-foreground">{count}</span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>

        {conversionFilter && (
          <button
            onClick={() => setConversionFilter(null)}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
              getConversionStep(conversionFilter).bgColor,
              getConversionStep(conversionFilter).color
            )}
          >
            {getConversionStep(conversionFilter).label}
            <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>

      {/* Active tag filters display */}
      {tagFilters.length > 0 && (
        <div className="px-3 pb-1.5 flex items-center gap-1 flex-wrap">
          {tagFilters.map(name => {
            const tag = orgTags.find(t => t.name === name);
            const style = getTagColorStyle(tag?.color || "gray");
            return (
              <button
                key={name}
                onClick={() => toggleTagFilter(name)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                  style.bg, style.text, style.border
                )}
              >
                {name}
                <X className="h-2.5 w-2.5" />
              </button>
            );
          })}
        </div>
      )}

      {/* Divider */}
      <div className="border-b border-border" />

      {/* List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-24" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            Nenhuma conversa encontrada
          </div>
        ) : (
          <>
            {filtered.map((contact) => (
              <ConversationItem
                key={contact.id}
                contact={contact}
                isSelected={contact.id === selectedContactId}
                onClick={() => onSelectContact(contact.id)}
                teamMembers={teamMembers}
                orgTags={orgTags}
                onDelete={onDeleteConversation ? () => onDeleteConversation(contact.id) : undefined}
                onMarkUnread={onMarkUnread ? () => onMarkUnread(contact.id) : undefined}
                onFinalize={onFinalizeConversation ? () => onFinalizeConversation(contact.id) : undefined}
                selectionMode={selectionMode}
                isChecked={selectedIds.has(contact.id)}
                onToggleCheck={() => toggleCheck(contact.id)}
                hasScheduledMessage={scheduledContactIds.has(contact.id)}
              />
            ))}
            {loadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
