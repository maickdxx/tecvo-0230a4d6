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
import { WhatsAppTag } from "@/hooks/useWhatsAppTags";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useOrganization } from "@/hooks/useOrganization";
import { CONVERSION_STEPS, getConversionStep } from "./ConversionStatusSelector";
import {
  ConversationAdvancedFilters,
  ActiveFilterChips,
  applyAdvancedFilters,
  loadFiltersFromStorage,
  saveFiltersToStorage,
  hasActiveFilters,
  type AdvancedFilters,
  EMPTY_FILTERS,
} from "./ConversationAdvancedFilters";

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
  channels?: { id: string; name: string; phone_number: string }[];
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

type StatusFilter = "novas" | "atendendo" | "agendados" | "aguardando" | "finalizado";
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
  channels = [],
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
  
  // Persist status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(() => {
    const saved = localStorage.getItem("tecvo_whatsapp_status_filter");
    if (saved === "novas" || saved === "atendendo" || saved === "agendados" || saved === "aguardando" || saved === "finalizado") {
      return saved as StatusFilter;
    }
    return "atendendo";
  });

  // Effect to ensure status is always valid and persisted
  useEffect(() => {
    if (!statusFilter || !["novas", "atendendo", "agendados", "aguardando", "finalizado"].includes(statusFilter)) {
      setStatusFilter("atendendo");
      localStorage.setItem("tecvo_whatsapp_status_filter", "atendendo");
    } else {
      localStorage.setItem("tecvo_whatsapp_status_filter", statusFilter);
    }
  }, [statusFilter]);

  const [conversionFilter, setConversionFilter] = useState<ConversionFilter>(null);
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedFilters>(loadFiltersFromStorage);
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

  // ── Canonical tab precedence (highest → lowest) ──
  // 1. Finalizados: conversation resolved OR pipeline terminal
  // 2. Agendados: active service pipeline (agendado/em_execucao/pos_atendimento)
  // 3. Aguardando: unread from client OR pipeline aguardando_* stages
  // 4. Novas: conversation_status = novo
  // 5. Em atendimento: everything else active

  const isFinalizado = (c: any) => {
    const s = c.conversation_status || "novo";
    const cs = c.conversion_status || "novo_contato";
    return s === "resolvido" || cs === "concluido" || cs === "nao_convertido";
  };

  const isAgendado = (c: any) => {
    if (isFinalizado(c)) return false;
    const cs = c.conversion_status || "novo_contato";
    return cs === "agendado" || cs === "em_execucao" || cs === "pos_atendimento";
  };

  const AGUARDANDO_PIPELINE = ["aguardando_cliente", "aguardando_aprovacao", "aguardando_pagamento"];

  const isAguardando = (c: any) => {
    if (isFinalizado(c)) return false;
    if (isAgendado(c)) return false;
    const cs = c.conversion_status || "novo_contato";
    const hasUnreadFromClient = (c.unread_count > 0 || c.is_unread) && c.last_message_is_from_me !== true;
    return hasUnreadFromClient || AGUARDANDO_PIPELINE.includes(cs);
  };

  const isNova = (c: any) => {
    if (isFinalizado(c)) return false;
    if (isAgendado(c)) return false;
    if (isAguardando(c)) return false;
    return (c.conversation_status || "novo") === "novo";
  };

  const isAtendendo = (c: any) => {
    if (isFinalizado(c)) return false;
    if (isAgendado(c)) return false;
    if (isAguardando(c)) return false;
    if (isNova(c)) return false;
    return true;
  };

  const hasUnread = (c: any) => (c.unread_count > 0 || c.is_unread);

  // Apply advanced filters first (before counting per status)
  const advancedFiltered = useMemo(
    () => applyAdvancedFilters(contacts, advancedFilters),
    [contacts, advancedFilters]
  );

  const novasCount = advancedFiltered.filter(c => isNova(c)).length;
  const atendendoCount = advancedFiltered.filter(c => isAtendendo(c) && hasUnread(c)).length;
  const agendadosCount = advancedFiltered.filter(c => isAgendado(c)).length;
  const aguardandoCount = advancedFiltered.filter(c => isAguardando(c)).length;
  const finalizadoCount = advancedFiltered.filter(c => isFinalizado(c) && hasUnread(c)).length;

  const filtered = advancedFiltered.filter((c) => {
    // When searching, ignore status filter to show results across all tabs
    if (!searchTerm.trim()) {
      if (statusFilter === "novas" && !isNova(c)) return false;
      if (statusFilter === "atendendo" && !isAtendendo(c)) return false;
      if (statusFilter === "agendados" && !isAgendado(c)) return false;
      if (statusFilter === "aguardando" && !isAguardando(c)) return false;
      if (statusFilter === "finalizado" && !isFinalizado(c)) return false;
    }
    // Conversion pipeline filter
    if (conversionFilter) {
      if ((c.conversion_status || "novo_contato") !== conversionFilter) return false;
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
    { key: "agendados", label: "Agendados", count: agendadosCount },
    { key: "aguardando", label: "Aguardando", count: aguardandoCount },
    { key: "finalizado", label: "Finalizados", count: finalizadoCount },
  ];

  const allSelected = filtered.length > 0 && selectedIds.size === filtered.length;

  const handleAdvancedFilterChange = useCallback((f: AdvancedFilters) => {
    setAdvancedFilters(f);
    setSelectedIds(new Set());
  }, []);

  return (
    <>
      {/* Header */}
      <div className="px-4 pt-4 pb-3 flex items-center justify-between">
        <h2 className="text-[13px] font-bold text-foreground tracking-tight uppercase bg-gradient-to-r from-foreground to-foreground/60 bg-clip-text">Conversas</h2>
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
      <div className="px-3 pb-2.5">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
          <Input
            placeholder="Buscar nome, telefone ou mensagem..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-10 text-sm bg-muted/20 border-border/20 focus:bg-background focus:border-primary/30 focus:shadow-sm transition-all rounded-xl"
          />
        </div>
      </div>

      {/* Status Filters — Carousel with active tab always centered */}
      {(() => {
        const activeIdx = filters.findIndex(f => f.key === statusFilter);
        const leftIdx = activeIdx - 1;
        const rightIdx = activeIdx + 1;
        const leftTab = leftIdx >= 0 ? filters[leftIdx] : null;
        const rightTab = rightIdx < filters.length ? filters[rightIdx] : null;
        const centerTab = filters[activeIdx];

        const handleTabClick = (key: StatusFilter) => {
          if (statusFilter !== key) {
            setStatusFilter(key);
            setSelectedIds(new Set());
          }
        };

        const renderTab = (tab: typeof filters[0] | null, position: "left" | "center" | "right") => {
          if (!tab) return <div className="flex-1" />;
          const isCenter = position === "center";
          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(tab.key)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[11px] font-medium whitespace-nowrap relative transition-all duration-300 ease-in-out",
                isCenter
                  ? "flex-[1.4] bg-primary text-primary-foreground shadow-md scale-100"
                  : "flex-1 text-muted-foreground/70 hover:text-muted-foreground hover:bg-muted/40 scale-95"
              )}
            >
              <span className={cn("transition-opacity duration-300", isCenter ? "opacity-100" : "opacity-70")}>
                {tab.label}
              </span>
              {tab.count > 0 && (
                <span className={cn(
                  "text-[10px] rounded-full px-1.5 min-w-[16px] text-center font-semibold transition-opacity duration-300",
                  isCenter
                    ? "bg-primary-foreground/20 text-primary-foreground opacity-100"
                    : tab.key !== "finalizado"
                      ? "bg-primary/10 text-primary opacity-60"
                      : "text-muted-foreground opacity-50"
                )}>
                  {tab.key !== "finalizado" ? formatCount(tab.count) : `(${formatCount(tab.count)})`}
                </span>
              )}
            </button>
          );
        };

        return (
          <div className="px-3 pb-2.5 flex items-center gap-1">
            {renderTab(leftTab, "left")}
            {renderTab(centerTab, "center")}
            {renderTab(rightTab, "right")}
          </div>
        );
      })()}

      {/* Pipeline + Advanced Filters */}
      <div className="px-3 pb-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar">
        {/* Pipeline filter */}
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
              const count = advancedFiltered.filter((c) => (c.conversion_status || "novo_contato") === step.key).length;
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

        {/* Advanced filters button */}
        <ConversationAdvancedFilters
          filters={advancedFilters}
          onChange={handleAdvancedFilterChange}
          channels={channels}
          teamMembers={teamMembers}
          orgTags={orgTags}
        />
      </div>

      {/* Active advanced filter chips */}
      <ActiveFilterChips
        filters={advancedFilters}
        onChange={handleAdvancedFilterChange}
        channels={channels}
        teamMembers={teamMembers}
        orgTags={orgTags}
      />

      {/* Divider */}
      <div className="border-b border-border/15" />

      {/* List */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading && filtered.length === 0 ? (
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
            {hasActiveFilters(advancedFilters) ? (
              <div className="space-y-2">
                <p>Nenhuma conversa encontrada com os filtros aplicados</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => handleAdvancedFilterChange({ ...EMPTY_FILTERS })}
                >
                  Limpar filtros
                </Button>
              </div>
            ) : (
              "Nenhuma conversa encontrada"
            )}
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
