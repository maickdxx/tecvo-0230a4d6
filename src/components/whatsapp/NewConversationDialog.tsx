import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { Loader2, Search, MessageSquarePlus, UserPlus, Radio } from "lucide-react";

interface ChannelOption {
  id: string;
  name: string;
  phone_number: string | null;
  is_connected: boolean;
}

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channels: ChannelOption[];
  onSelected: (contactId: string) => void;
  prefillPhone?: string;
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

export function NewConversationDialog({ open, onOpenChange, channels, onSelected, prefillPhone }: NewConversationDialogProps) {
  const { organization } = useOrganization();
  const [contacts, setContacts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPhone, setCreatePhone] = useState(prefillPhone || "");
  const [creating, setCreating] = useState(false);

  // Channel selection — only relevant when 2+ connected channels
  const connectedChannels = useMemo(() => channels.filter(c => c.is_connected), [channels]);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null);

  // Auto-select if only 1 connected channel
  useEffect(() => {
    if (connectedChannels.length === 1) {
      setSelectedChannelId(connectedChannels[0].id);
    } else if (connectedChannels.length === 0) {
      setSelectedChannelId(null);
    }
  }, [connectedChannels]);

  useEffect(() => {
    if (!open) {
      setContacts([]);
      setSearchQuery("");
      setShowCreate(false);
      setCreateName("");
      setCreatePhone(prefillPhone || "");
      if (connectedChannels.length > 1) setSelectedChannelId(null);
      return;
    }
    if (prefillPhone) {
      setShowCreate(true);
      setCreatePhone(prefillPhone);
    }
    if (!organization?.id) return;

    const fetch = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("whatsapp_contacts")
        .select("id, name, phone, normalized_phone, profile_picture_url, last_message_at, conversation_status")
        .eq("organization_id", organization.id)
        .eq("is_group", false)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(300);
      setContacts(data || []);
      setLoading(false);
    };
    fetch();
  }, [open, organization?.id]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return contacts;
    const term = searchQuery.toLowerCase();
    const termDigits = normalizePhone(searchQuery);
    return contacts.filter((c) => {
      const name = (c.name || "").toLowerCase();
      const linkedName = (c.linked_client?.name || "").toLowerCase();
      const phone = normalizePhone(c.phone);
      return name.includes(term) || linkedName.includes(term) || (termDigits.length >= 3 && phone.includes(termDigits));
    });
  }, [contacts, searchQuery]);

  const resolvedChannelId = selectedChannelId || (connectedChannels.length === 1 ? connectedChannels[0].id : null);

  const handleCreateContact = async () => {
    if (!createPhone.trim() || !organization?.id || !resolvedChannelId) return;
    const digits = normalizePhone(createPhone);
    const normalized = (digits.length === 10 || digits.length === 11) ? "55" + digits : digits;
    if (normalized.length < 10) {
      toast.error("Número de telefone inválido");
      return;
    }

    setCreating(true);
    try {
      const { data: existing } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id")
        .eq("organization_id", organization.id)
        .eq("normalized_phone", normalized)
        .maybeSingle();

      if (existing) {
        const channelMsg = existing.channel_id === resolvedChannelId
          ? "Já existe uma conversa deste número neste canal, abrindo"
          : "Este contato já existe em outro canal, abrindo histórico anterior";
        toast.info(channelMsg);
        onSelected(existing.id);
        onOpenChange(false);
        return;
      }

      const { data, error } = await supabase
        .from("whatsapp_contacts")
        .insert({
          organization_id: organization.id,
          channel_id: resolvedChannelId,
          name: createName.trim() || null,
          phone: "+" + normalized,
          normalized_phone: normalized,
          whatsapp_id: normalized + "@s.whatsapp.net",
          is_group: false,
          conversation_status: "atendendo",
          source: "whatsapp",
          has_conversation: true,
        })
        .select("id")
        .single();

      if (error) throw error;
      toast.success("Contato criado");
      onSelected(data.id);
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro ao criar contato: " + (err.message || ""));
    } finally {
      setCreating(false);
    }
  };

  const needsChannelSelection = connectedChannels.length > 1 && !selectedChannelId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MessageSquarePlus className="h-4 w-4" />
            Nova conversa
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* Step 1: Channel selection (only when 2+ connected channels) */}
          {connectedChannels.length > 1 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Canal de envio</label>
              <div className="space-y-1.5">
                {connectedChannels.map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChannelId(ch.id)}
                    className={`w-full flex items-center gap-3 p-2.5 rounded-lg border transition-colors text-left ${
                      selectedChannelId === ch.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <Radio className={`h-4 w-4 shrink-0 ${selectedChannelId === ch.id ? "text-primary" : "text-muted-foreground"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{ch.name}</p>
                      {ch.phone_number && (
                        <p className="text-xs text-muted-foreground">{ch.phone_number}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Contact search/create (only after channel is selected) */}
          {!needsChannelSelection && !showCreate ? (
            <>
              {/* Search existing contacts */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar contato por nome ou telefone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  autoFocus
                />
              </div>

              {/* Contact list */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-0.5 max-h-72">
                {loading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </div>
                ) : filtered.length > 0 ? (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={async () => {
                        // Ensure has_conversation is set when starting a conversation
                        await supabase
                          .from("whatsapp_contacts")
                          .update({ has_conversation: true })
                          .eq("id", c.id)
                          .eq("has_conversation", false);
                        onSelected(c.id);
                        onOpenChange(false);
                      }}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left"
                    >
                      {c.profile_picture_url ? (
                        <img src={c.profile_picture_url} alt="" className="h-9 w-9 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {(c.name || c.phone || "?").charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{c.name || c.phone}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    {searchQuery ? "Nenhum contato encontrado" : "Nenhum contato disponível"}
                  </p>
                )}
              </div>

              {/* Create new contact */}
              <div className="border-t border-border pt-3">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full gap-1.5 text-xs"
                  onClick={() => setShowCreate(true)}
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Criar novo contato
                </Button>
              </div>
            </>
          ) : !needsChannelSelection && showCreate ? (
            /* Create contact form */
            <div className="space-y-4 pt-1">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Telefone *</label>
                <Input
                  placeholder="(11) 99999-9999"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground">Nome (opcional)</label>
                <Input
                  placeholder="Nome do contato"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  className="text-sm"
                />
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={() => setShowCreate(false)} className="flex-1">
                  Voltar
                </Button>
                <Button size="sm" onClick={handleCreateContact} disabled={creating || !createPhone.trim()} className="flex-1 gap-1.5">
                  {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Criar e conversar
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
