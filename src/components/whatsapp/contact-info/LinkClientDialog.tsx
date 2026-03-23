import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link2, UserPlus, Loader2, Search, CheckCircle2, Phone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkClientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  organizationId: string;
  onLinked: () => void;
}

function normalizePhone(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function getPhoneVariants(phone: string): string[] {
  const variants = [phone];
  if (phone.startsWith("55") && phone.length >= 12) {
    variants.push(phone.substring(2));
  }
  if (phone.length === 10 || phone.length === 11) {
    variants.push("55" + phone);
  }
  return variants;
}

function phoneMatches(clientPhone: string, variants: string[]): boolean {
  const clean = normalizePhone(clientPhone);
  if (clean.length < 8) return false;
  return variants.some(
    (v) => clean === v || clean.endsWith(v) || v.endsWith(clean)
  );
}

export function LinkClientDialog({ open, onOpenChange, contact, organizationId, onLinked }: LinkClientDialogProps) {
  const [allClients, setAllClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState("");
  const [creating, setCreating] = useState(false);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [dismissedSuggestion, setDismissedSuggestion] = useState(false);

  const contactPhone = normalizePhone(contact.phone || contact.normalized_phone || "");
  const phoneVariants = useMemo(() => getPhoneVariants(contactPhone), [contactPhone]);

  // Load all clients once when dialog opens
  useEffect(() => {
    if (!open) {
      setAllClients([]);
      setSearchQuery("");
      setShowCreate(false);
      setCreateName("");
      setDismissedSuggestion(false);
      return;
    }

    setCreateName(contact.name || "");
    const fetchClients = async () => {
      setLoading(true);
      const { data } = await supabase
        .from("clients")
        .select("id, name, phone, email, city, state, whatsapp, company_name, created_at")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("name")
        .limit(500);
      setAllClients(data || []);
      setLoading(false);
    };
    fetchClients();
  }, [open, organizationId, contact.name]);

  // Separate phone-matched clients (suggestion) from search results
  const { phoneSuggestions, searchResults } = useMemo(() => {
    const phoneSuggestions: any[] = [];
    const searchResults: any[] = [];

    if (allClients.length === 0) return { phoneSuggestions, searchResults };

    const term = searchQuery.trim().toLowerCase();

    for (const c of allClients) {
      const isPhoneMatch = contactPhone.length >= 8 && (
        phoneMatches(c.phone, phoneVariants) || phoneMatches(c.whatsapp || "", phoneVariants)
      );

      if (isPhoneMatch) {
        phoneSuggestions.push(c);
      }

      if (term) {
        const name = (c.name || "").toLowerCase();
        const phone = normalizePhone(c.phone);
        const email = (c.email || "").toLowerCase();
        if (name.includes(term) || phone.includes(term) || email.includes(term)) {
          // Avoid duplicates already in suggestions
          if (!isPhoneMatch) {
            searchResults.push(c);
          }
        }
      }
    }

    return { phoneSuggestions, searchResults };
  }, [allClients, contactPhone, phoneVariants, searchQuery]);

  const handleLink = async (clientId: string) => {
    setLinkingId(clientId);
    // Find client name to update contact display name
    const linkedClient = allClients.find(c => c.id === clientId);
    const updateData: any = { linked_client_id: clientId, linked_at: new Date().toISOString() };
    if (linkedClient?.name) {
      updateData.name = linkedClient.name;
      updateData.is_name_custom = true;
    }
    await supabase
      .from("whatsapp_contacts")
      .update(updateData)
      .eq("id", contact.id);
    toast.success("Cliente vinculado com sucesso!");
    setLinkingId(null);
    onOpenChange(false);
    onLinked();
  };

  const handleCreate = async () => {
    if (!createName.trim()) return;
    setCreating(true);
    const phone = contact.phone || contact.normalized_phone || "";
    const { data, error } = await supabase
      .from("clients")
      .insert({
        organization_id: organizationId,
        name: createName.trim(),
        phone,
        person_type: "pf",
        whatsapp: phone,
      })
      .select("id")
      .single();

    if (error) {
      toast.error("Erro ao criar cliente");
    } else if (data) {
      await supabase
        .from("whatsapp_contacts")
        .update({ linked_client_id: data.id, linked_at: new Date().toISOString(), name: createName.trim(), is_name_custom: true })
        .eq("id", contact.id);
      toast.success("Cliente criado e vinculado!");
      onOpenChange(false);
      onLinked();
    }
    setCreating(false);
  };

  const showSuggestion = phoneSuggestions.length > 0 && !dismissedSuggestion && !searchQuery;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-base">Vincular cliente</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 flex-1 overflow-hidden flex flex-col">
          {/* Auto-suggestion by phone */}
          {showSuggestion && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2.5">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <p className="text-sm font-medium text-foreground">
                  {phoneSuggestions.length === 1
                    ? "Encontramos um cliente com este telefone"
                    : `Encontramos ${phoneSuggestions.length} clientes com este telefone`}
                </p>
              </div>

              {phoneSuggestions.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center justify-between p-2.5 rounded-md bg-background border border-border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{client.name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      {client.phone}
                      {client.city ? ` · ${client.city}` : ""}
                    </div>
                    {client.company_name && (
                      <p className="text-[11px] text-muted-foreground">{client.company_name}</p>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs h-8 shrink-0 ml-2"
                    disabled={linkingId === client.id}
                    onClick={() => handleLink(client.id)}
                  >
                    {linkingId === client.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Link2 className="h-3 w-3" />
                    )}
                    Vincular
                  </Button>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground h-7"
                onClick={() => setDismissedSuggestion(true)}
              >
                Não é este cliente, continuar buscando
              </Button>
            </div>
          )}

          {/* Search - always visible */}
          {(!showSuggestion || dismissedSuggestion || searchQuery) && (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone ou email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                  autoFocus
                />
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto min-h-0 space-y-1.5 max-h-60">
                {loading ? (
                  <div className="flex items-center justify-center py-8 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </div>
                ) : searchQuery ? (
                  <>
                    {/* Show phone suggestions first even in search mode */}
                    {phoneSuggestions.length > 0 && (
                      <>
                        <p className="text-[11px] text-muted-foreground px-1 font-medium">
                          Sugestão por telefone
                        </p>
                        {phoneSuggestions.map((client) => (
                          <ClientRow key={client.id} client={client} linkingId={linkingId} onLink={handleLink} highlighted />
                        ))}
                      </>
                    )}

                    {searchResults.length > 0 && (
                      <>
                        <p className="text-[11px] text-muted-foreground px-1 font-medium mt-2">
                          {searchResults.length} resultado(s) da busca
                        </p>
                        {searchResults.map((client) => (
                          <ClientRow key={client.id} client={client} linkingId={linkingId} onLink={handleLink} />
                        ))}
                      </>
                    )}

                    {phoneSuggestions.length === 0 && searchResults.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-6">
                        Nenhum cliente encontrado
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    Digite para buscar clientes por nome, telefone ou email
                  </p>
                )}
              </div>
            </>
          )}

          {/* Create new */}
          <div className="border-t border-border pt-3 space-y-2">
            {showCreate ? (
              <>
                <div>
                  <Label className="text-xs">Nome do cliente</Label>
                  <Input
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    placeholder="Nome do cliente"
                    className="mt-1 text-sm"
                  />
                </div>
                <div>
                  <Label className="text-xs">Telefone</Label>
                  <Input value={contact.phone || ""} disabled className="mt-1 bg-muted text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleCreate}
                    disabled={!createName.trim() || creating}
                    className="flex-1 gap-1.5"
                    size="sm"
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                    {creating ? "Criando..." : "Criar e vincular"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowCreate(false)}>
                    Cancelar
                  </Button>
                </div>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                className="w-full gap-1.5 text-xs"
                onClick={() => setShowCreate(true)}
              >
                <UserPlus className="h-3.5 w-3.5" />
                Criar novo cliente
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ClientRow({ client, linkingId, onLink, highlighted }: {
  client: any;
  linkingId: string | null;
  onLink: (id: string) => void;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
        highlighted
          ? "border-primary/30 bg-primary/5 hover:border-primary/50"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground truncate">{client.name}</p>
        <p className="text-xs text-muted-foreground">
          {client.phone}
          {client.city ? ` · ${client.city}` : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant="outline"
        className="gap-1 text-xs h-7 shrink-0 ml-2"
        disabled={linkingId === client.id}
        onClick={() => onLink(client.id)}
      >
        {linkingId === client.id ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Link2 className="h-3 w-3" />
        )}
        Vincular
      </Button>
    </div>
  );
}
