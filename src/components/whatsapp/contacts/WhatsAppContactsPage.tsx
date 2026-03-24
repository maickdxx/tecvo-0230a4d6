import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppTags, getTagColorStyle, WhatsAppTag } from "@/hooks/useWhatsAppTags";
import { useWhatsAppChannel } from "@/hooks/useWhatsAppChannel";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import { ContactEditDialog } from "./ContactEditDialog";
import { ExportContactsDialog } from "./ExportContactsDialog";
import { ImportContactsDialog } from "./ImportContactsDialog";
import { getContactDisplayName } from "@/lib/whatsappContactName";
import { TagBadge } from "../TagBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search, Plus, MoreVertical, MessageSquare, Pencil, Trash2, Tag, X, Users,
  ArrowUpDown, Filter, Phone, Mail, Building2, Download, Upload, CheckSquare,
  Square, Ban, ShieldOff, ClipboardList, UserCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";

type SortOption = "name" | "recent" | "last_interaction";
type ConversationFilter = "all" | "with_conversation" | "without_conversation";

export function WhatsAppContactsPage() {
  const { organization } = useOrganization();
  const { channel } = useWhatsAppChannel();
  const { tags: orgTags } = useWhatsAppTags();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const [contacts, setContacts] = useState<any[]>([]);
  const [hasMoreContacts, setHasMoreContacts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [contactsTotalCount, setContactsTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");

  const [editDialog, setEditDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [exportDialog, setExportDialog] = useState(false);
  const [importDialog, setImportDialog] = useState(false);
  const [deletingContact, setDeletingContact] = useState<any>(null);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialog, setBulkDeleteDialog] = useState(false);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState("");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const CONTACTS_PAGE_SIZE = 50;

  const fetchContacts = useCallback(async (append = false, offset = 0) => {
    if (!organization?.id) return;
    if (!append) setLoading(true);
    else setLoadingMore(true);

    const { data: channels } = await supabase
      .from("whatsapp_channels").select("id").eq("organization_id", organization.id)
      .in("channel_type", ["CUSTOMER_INBOX", "WEBCHAT"]);
    const channelIds = (channels || []).map((c: any) => c.id);
    if (channelIds.length === 0) { setContacts([]); setLoading(false); setLoadingMore(false); return; }

    const { data, count } = await supabase
      .from("whatsapp_contacts").select("*, linked_client:linked_client_id(name)", { count: "exact" })
      .eq("organization_id", organization.id).in("channel_id", channelIds)
      .eq("is_group", false).order("created_at", { ascending: false })
      .range(offset, offset + CONTACTS_PAGE_SIZE - 1);

    const newData = data || [];
    if (append) {
      setContacts(prev => [...prev, ...newData]);
    } else {
      setContacts(newData);
    }
    setContactsTotalCount(count ?? 0);
    setHasMoreContacts(newData.length === CONTACTS_PAGE_SIZE);
    setLoading(false);
    setLoadingMore(false);
  }, [organization?.id]);

  const loadMoreContacts = useCallback(() => {
    fetchContacts(true, contacts.length);
  }, [fetchContacts, contacts.length]);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const normalizeDigits = (s: string) => (s || "").replace(/\D/g, "");

  const filteredContacts = useMemo(() => {
    let list = [...contacts];
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      const termDigits = normalizeDigits(searchTerm);
      list = list.filter(c => {
        const nameMatch = (c.name || "").toLowerCase().includes(term);
        const linkedNameMatch = (c.linked_client?.name || "").toLowerCase().includes(term);
        const phoneMatch = termDigits.length >= 3 && normalizeDigits(c.phone).includes(termDigits);
        return nameMatch || linkedNameMatch || phoneMatch;
      });
    }
    if (tagFilter.length > 0) {
      list = list.filter(c => { const cTags: string[] = c.tags || []; return tagFilter.some(tf => cTags.includes(tf)); });
    }
    if (conversationFilter === "with_conversation") list = list.filter(c => !!c.last_message_at);
    else if (conversationFilter === "without_conversation") list = list.filter(c => !c.last_message_at);
    list.sort((a, b) => {
      if (sortBy === "name") return (a.name || a.phone || "").localeCompare(b.name || b.phone || "");
      if (sortBy === "last_interaction") {
        const aT = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const bT = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return bT - aT;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return list;
  }, [contacts, searchTerm, tagFilter, conversationFilter, sortBy]);

  const handleOpenChat = (contact: any) => navigate(`/whatsapp?contact=${contact.id}`);
  const handleEdit = (contact: any) => { setEditingContact(contact); setEditDialog(true); };
  const handleCreate = () => { setEditingContact(null); setEditDialog(true); };
  const handleDelete = async () => {
    if (!deletingContact) return;
    // Soft-delete: hide contact but preserve all messages
    const { error } = await supabase
      .from("whatsapp_contacts")
      .update({ has_conversation: false, conversation_status: "resolvido" })
      .eq("id", deletingContact.id);
    if (error) toast.error("Erro ao excluir contato");
    else { toast.success("Contato removido da listagem"); fetchContacts(); }
    setDeleteDialog(false); setDeletingContact(null);
  };
  const toggleTagFilter = (tagName: string) => {
    setTagFilter(prev => prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]);
  };
  const getTagColor = (name: string) => orgTags.find(t => t.name === name)?.color || "gray";
  const displayName = (c: any) => getContactDisplayName(c);

  const toggleCheck = useCallback((id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }, []);
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredContacts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredContacts.map(c => c.id)));
  }, [filteredContacts, selectedIds.size]);
  const exitSelectionMode = useCallback(() => { setSelectionMode(false); setSelectedIds(new Set()); }, []);
  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    setBulkDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      for (let i = 0; i < ids.length; i += 50) {
        const batch = ids.slice(i, i + 50);
        // Soft-delete: hide contacts but preserve all messages
        const { error } = await supabase
          .from("whatsapp_contacts")
          .update({ has_conversation: false, conversation_status: "resolvido" })
          .in("id", batch);
        if (error) throw error;
      }
      toast.success(`${ids.length} contato(s) removido(s) da listagem`);
      exitSelectionMode(); setBulkDeleteDialog(false); setBulkDeleteConfirmText(""); fetchContacts();
    } catch { toast.error("Erro ao remover contatos"); } finally { setBulkDeleting(false); }
  }, [selectedIds, exitSelectionMode, fetchContacts]);

  const handleToggleBlock = useCallback(async (contact: any) => {
    const newBlocked = !contact.is_blocked;
    const { error } = await supabase.from("whatsapp_contacts").update({ is_blocked: newBlocked }).eq("id", contact.id);
    if (error) { toast.error("Erro ao atualizar bloqueio"); return; }
    toast.success(newBlocked ? "Contato bloqueado" : "Contato desbloqueado"); fetchContacts();
  }, [fetchContacts]);

  function nameToAvatarColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-amber-500", "bg-cyan-500", "bg-fuchsia-500"];
    return colors[Math.abs(hash) % colors.length];
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-4 md:px-6 py-4 border-b border-border bg-card shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-foreground">Contatos</h1>
              <p className="text-xs text-muted-foreground">{filteredContacts.length} contatos</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!selectionMode ? (
              <>
                <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setSelectionMode(true)} title="Selecionar">
                  <CheckSquare className="h-4 w-4" />
                </Button>
                <Button onClick={handleCreate} size="sm" className="gap-1.5">
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline">Novo contato</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9"><MoreVertical className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setExportDialog(true)}>
                      <Download className="h-4 w-4 mr-2" /> Exportar contatos
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setImportDialog(true)}>
                      <Upload className="h-4 w-4 mr-2" /> Importar contatos
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={toggleSelectAll}>
                  {selectedIds.size === filteredContacts.length && filteredContacts.length > 0
                    ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
                  {selectedIds.size === filteredContacts.length && filteredContacts.length > 0 ? "Desmarcar" : "Selecionar todas"}
                </Button>
                {selectedIds.size > 0 && (
                  <Button variant="destructive" size="sm" className="h-8 text-xs" onClick={() => { setBulkDeleteConfirmText(""); setBulkDeleteDialog(true); }}>
                    <Trash2 className="h-3.5 w-3.5 mr-1" /> Excluir ({selectedIds.size})
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={exitSelectionMode}>Cancelar</Button>
              </>
            )}
          </div>
        </div>

        {/* Search & Filters */}
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou telefone..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex gap-2">
            <Select value={conversationFilter} onValueChange={(v) => setConversationFilter(v as ConversationFilter)}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <Filter className="h-3.5 w-3.5 mr-1.5 shrink-0" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="with_conversation">Com conversa</SelectItem>
                <SelectItem value="without_conversation">Sem conversa</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
              <SelectTrigger className="h-9 w-[160px] text-xs">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" /><SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Mais recentes</SelectItem>
                <SelectItem value="name">Nome A-Z</SelectItem>
                <SelectItem value="last_interaction">Última interação</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tag filters */}
        {orgTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {orgTags.map(tag => {
              const selected = tagFilter.includes(tag.name);
              const style = getTagColorStyle(tag.color);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTagFilter(tag.name)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
                    selected
                      ? cn(style.bg, style.text, style.border, "ring-1 ring-primary/20")
                      : "border-border/50 text-muted-foreground hover:bg-muted/50"
                  )}
                >
                  {tag.name}
                  {selected && <X className="h-2.5 w-2.5" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4 bg-card rounded-xl border border-border/50">
                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredContacts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <Users className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum contato encontrado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              {searchTerm || tagFilter.length > 0 ? "Tente ajustar os filtros" : "Adicione seu primeiro contato"}
            </p>
            {!searchTerm && tagFilter.length === 0 && (
              <Button onClick={handleCreate} variant="outline" size="sm" className="mt-4 gap-1.5">
                <Plus className="h-4 w-4" /> Novo contato
              </Button>
            )}
          </div>
        ) : (
          <div className="p-2 md:p-4 space-y-2">
            {filteredContacts.map((contact) => {
              const name = displayName(contact);
              const initial = name.charAt(0).toUpperCase();
              const avatarBg = nameToAvatarColor(name);
              const tags: string[] = contact.tags || [];
              const hasConversation = !!contact.last_message_at;
              const meta = contact.visitor_metadata || {};

              return (
                <div
                  key={contact.id}
                  className={cn(
                    "group flex items-center gap-3 px-4 py-3 rounded-xl border border-border/40 bg-card hover:border-border hover:shadow-sm transition-all",
                    selectionMode && selectedIds.has(contact.id) && "border-primary/30 bg-primary/[0.04]"
                  )}
                >
                  {selectionMode && (
                    <div className="shrink-0">
                      <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleCheck(contact.id)} className="h-4 w-4 rounded border-border accent-primary cursor-pointer" />
                    </div>
                  )}
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    {contact.profile_picture_url ? (
                      <img src={contact.profile_picture_url} alt="" className="h-11 w-11 rounded-full object-cover ring-2 ring-background"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }} />
                    ) : null}
                    <div className={cn("h-11 w-11 rounded-full flex items-center justify-center text-white shadow-sm", avatarBg, contact.profile_picture_url && "hidden")}>
                      <span className="text-sm font-bold">{initial}</span>
                    </div>
                    {hasConversation && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center">
                        <MessageSquare className="h-2 w-2 text-white" />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpenChat(contact)}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{name}</span>
                      {contact.is_blocked && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 text-destructive text-[10px] font-medium px-1.5 py-0.5">
                          <Ban className="h-2.5 w-2.5" /> Bloqueado
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {contact.phone && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {contact.phone}
                        </span>
                      )}
                      {meta.email && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 hidden sm:flex">
                          <Mail className="h-3 w-3" /> {meta.email}
                        </span>
                      )}
                      {meta.company && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1 hidden md:flex">
                          <Building2 className="h-3 w-3" /> {meta.company}
                        </span>
                      )}
                    </div>
                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-1.5">
                        {tags.slice(0, 3).map(tag => (
                          <TagBadge key={tag} tag={tag} color={getTagColor(tag)} size="xs" />
                        ))}
                        {tags.length > 3 && <span className="text-[9px] text-muted-foreground/60">+{tags.length - 3}</span>}
                      </div>
                    )}
                  </div>

                  {/* Time & assigned */}
                  <div className="hidden sm:flex flex-col items-end gap-1 shrink-0">
                    {contact.last_message_at && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(contact.last_message_at), { addSuffix: true, locale: ptBR })}
                      </span>
                    )}
                    {contact.assigned_to && (
                      <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                        <UserCircle className="h-3 w-3" /> Atribuído
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleOpenChat(contact)}>
                        <MessageSquare className="h-4 w-4 mr-2" /> {hasConversation ? "Abrir conversa" : "Iniciar conversa"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleEdit(contact)}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar contato
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/whatsapp?contact=${contact.id}&action=tag`)}>
                        <Tag className="h-4 w-4 mr-2" /> Adicionar etiqueta
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => navigate(`/whatsapp?contact=${contact.id}&action=os`)}>
                        <ClipboardList className="h-4 w-4 mr-2" /> Criar ordem de serviço
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => handleToggleBlock(contact)}>
                        {contact.is_blocked ? <ShieldOff className="h-4 w-4 mr-2" /> : <Ban className="h-4 w-4 mr-2" />}
                        {contact.is_blocked ? "Desbloquear" : "Bloquear contato"}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => { setDeletingContact(contact); setDeleteDialog(true); }} className="text-destructive focus:text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" /> Excluir contato
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}

            {/* Load More */}
            {hasMoreContacts && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  onClick={loadMoreContacts}
                  disabled={loadingMore}
                  className="gap-2"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</>
                  ) : (
                    <>Carregar mais <span className="text-muted-foreground">({contacts.length} de {contactsTotalCount})</span></>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <ContactEditDialog open={editDialog} onOpenChange={setEditDialog} channelId={channel?.id || null} contact={editingContact} onSaved={fetchContacts} />

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{displayName(deletingContact)}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteDialog} onOpenChange={(v) => { setBulkDeleteDialog(v); if (!v) setBulkDeleteConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} contato(s)</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span>Você está prestes a excluir <strong>{selectedIds.size}</strong> contato(s). Esta ação não pode ser desfeita.</span>
              <span className="block">Para confirmar, digite o número <strong>{selectedIds.size}</strong> abaixo:</span>
              <Input value={bulkDeleteConfirmText} onChange={(e) => setBulkDeleteConfirmText(e.target.value)} placeholder={`Digite ${selectedIds.size}`} className="mt-2" autoFocus />
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} disabled={bulkDeleteConfirmText !== String(selectedIds.size) || bulkDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {bulkDeleting ? "Excluindo..." : "Confirmar exclusão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ExportContactsDialog open={exportDialog} onOpenChange={setExportDialog} allContacts={contacts} filteredContacts={filteredContacts} hasActiveFilters={!!searchTerm.trim() || tagFilter.length > 0 || conversationFilter !== "all"} />
      <ImportContactsDialog open={importDialog} onOpenChange={setImportDialog} organizationId={organization?.id || ""} channelId={channel?.id || null} existingPhones={contacts.map((c: any) => c.normalized_phone || "").filter(Boolean)} onImported={fetchContacts} />
    </div>
  );
}
