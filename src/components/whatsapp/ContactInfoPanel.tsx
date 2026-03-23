import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  X, Pencil, Save, StickyNote, Plus, MapPin, Building2, FileText,
} from "lucide-react";
import { TagBadge } from "./TagBadge";
import { TagSelector } from "./TagSelector";
import { useWhatsAppTags } from "@/hooks/useWhatsAppTags";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { ClientLinkStatus } from "./contact-info/ClientLinkStatus";
import { LinkedClientCard } from "./contact-info/LinkedClientCard";
import { ServiceHistory } from "./contact-info/ServiceHistory";
import { LinkClientDialog } from "./contact-info/LinkClientDialog";

interface ContactInfoPanelProps {
  contact: any;
  onClose: () => void;
  onContactUpdate: () => void;
  onRegisterClient?: () => void;
  onShowCreateOS?: () => void;
}

interface ServiceRecord {
  id: string;
  quote_number: number;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  value: number | null;
  description: string | null;
}

export function ContactInfoPanel({ contact, onClose, onContactUpdate, onRegisterClient, onShowCreateOS }: ContactInfoPanelProps) {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { getTagByName } = useWhatsAppTags();
  const [note, setNote] = useState(contact.internal_note || "");
  const [editingNote, setEditingNote] = useState(false);
  const [linkedClient, setLinkedClient] = useState<any>(null);
  const [serviceStats, setServiceStats] = useState<{ count: number; firstDate: string | null; lastDate: string | null; lastServiceType: string | null } | null>(null);
  const [recentServices, setRecentServices] = useState<ServiceRecord[]>([]);
  const [openServices, setOpenServices] = useState<ServiceRecord[]>([]);
  const [autoLinking, setAutoLinking] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [savingDetails, setSavingDetails] = useState(false);
  const [contactDetails, setContactDetails] = useState({
    address: "",
    city: "",
    neighborhood: "",
    observations: "",
    additionalInfo: "",
  });
  const tags: string[] = contact.tags || [];

  // Load client data + auto-link by phone
  useEffect(() => {
    setNote(contact.internal_note || "");
    setLinkedClient(null);
    setServiceStats(null);
    setRecentServices([]);
    setOpenServices([]);

    const loadClientData = async () => {
      let clientId = contact.linked_client_id;

      // Auto-link: try to find client by phone if not linked
      if (!clientId && contact.normalized_phone && organization?.id) {
        setAutoLinking(true);
        const phone = contact.normalized_phone;
        const variants = [phone];
        if (phone.startsWith("55") && phone.length >= 12) {
          variants.push(phone.substring(2));
        } else if (phone.length === 10 || phone.length === 11) {
          variants.push("55" + phone);
        }

        const { data: clients } = await supabase
          .from("clients")
          .select("id, name, phone, email, city, state, company_name, street, number, neighborhood, zip_code, created_at, complement, internal_notes")
          .eq("organization_id", organization.id)
          .is("deleted_at", null)
          .limit(500);

        if (clients) {
          const matchedClient = clients.find((c) => {
            const cleanPhone = (c.phone || "").replace(/\D/g, "");
            return variants.some((v) => cleanPhone === v || cleanPhone.endsWith(v) || v.endsWith(cleanPhone));
          });

          if (matchedClient) {
            clientId = matchedClient.id;
            await supabase
              .from("whatsapp_contacts")
              .update({
                linked_client_id: matchedClient.id,
                linked_at: new Date().toISOString(),
                name: matchedClient.name,
                is_name_custom: true,
              })
              .eq("id", contact.id);
            setLinkedClient(matchedClient);
          }
        }
        setAutoLinking(false);
      }

      if (clientId && !linkedClient) {
        const { data } = await supabase
          .from("clients")
          .select("id, name, phone, email, city, state, company_name, street, number, neighborhood, zip_code, created_at, complement, internal_notes")
          .eq("id", clientId)
          .single();
        if (data) setLinkedClient(data);
      }

      // Fetch services for linked client
      if (clientId) {
        const { data: services } = await supabase
          .from("services")
          .select("id, quote_number, service_type, status, scheduled_date, completed_date, value, description")
          .eq("client_id", clientId)
          .is("deleted_at", null)
          .order("scheduled_date", { ascending: false })
          .limit(50);

        if (services && services.length > 0) {
          setServiceStats({
            count: services.length,
            firstDate: services[services.length - 1].scheduled_date,
            lastDate: services[0].scheduled_date,
            lastServiceType: services[0].service_type,
          });

          setOpenServices(
            services.filter((s) => !["completed", "cancelled"].includes(s.status)).slice(0, 5)
          );
          setRecentServices(services.slice(0, 8));
        } else {
          setServiceStats({ count: 0, firstDate: null, lastDate: null, lastServiceType: null });
        }
      }
    };

    loadClientData();
  }, [contact.id, contact.linked_client_id, contact.internal_note, contact.normalized_phone, organization?.id]);

  useEffect(() => {
    const visitorData = (contact.visitor_metadata as Record<string, any> | null) || {};
    setContactDetails({
      address: linkedClient?.street || visitorData.address || "",
      city: linkedClient?.city || visitorData.city || "",
      neighborhood: linkedClient?.neighborhood || visitorData.neighborhood || "",
      observations: linkedClient?.internal_notes || visitorData.observations || "",
      additionalInfo: linkedClient?.notes || visitorData.additionalInfo || "",
    });
  }, [
    contact.id,
    contact.visitor_metadata,
    linkedClient?.id,
    linkedClient?.street,
    linkedClient?.city,
    linkedClient?.neighborhood,
    linkedClient?.internal_notes,
    linkedClient?.notes,
  ]);

  const handleSaveDetails = async () => {
    setSavingDetails(true);

    const visitorData = (contact.visitor_metadata as Record<string, any> | null) || {};
    const mergedVisitorData = {
      ...visitorData,
      address: contactDetails.address.trim() || null,
      city: contactDetails.city.trim() || null,
      neighborhood: contactDetails.neighborhood.trim() || null,
      observations: contactDetails.observations.trim() || null,
      additionalInfo: contactDetails.additionalInfo.trim() || null,
    };

    const updates = [
      supabase
        .from("whatsapp_contacts")
        .update({ visitor_metadata: mergedVisitorData })
        .eq("id", contact.id),
      ...(linkedClient?.id
        ? [
            supabase
              .from("clients")
              .update({
                street: contactDetails.address.trim() || null,
                city: contactDetails.city.trim() || null,
                neighborhood: contactDetails.neighborhood.trim() || null,
                internal_notes: contactDetails.observations.trim() || null,
                notes: contactDetails.additionalInfo.trim() || null,
              })
              .eq("id", linkedClient.id),
          ]
        : []),
    ];

    const results = await Promise.all(updates);
    const hasError = results.some((r) => r.error);

    setSavingDetails(false);

    if (hasError) {
      toast.error("Erro ao salvar dados do contato");
      return;
    }

    setEditingDetails(false);
    toast.success("Dados do contato atualizados");
  };

  const handleToggleTag = async (tag: string) => {
    const updated = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    await supabase.from("whatsapp_contacts").update({ tags: updated }).eq("id", contact.id);
  };

  const handleSaveNote = async () => {
    await supabase.from("whatsapp_contacts").update({ internal_note: note.trim() || null }).eq("id", contact.id);
    setEditingNote(false);
    toast.success("Nota salva");
  };

  const handleClientLinked = () => {
    // Reload client data
    setLinkedClient(null);
  };

  const handleUnlink = async () => {
    setShowLinkDialog(true);
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold text-foreground">Perfil do contato</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Avatar & basic info */}
        <div className="text-center space-y-2">
          {contact.profile_picture_url ? (
            <img
              src={contact.profile_picture_url}
              alt=""
              className="mx-auto h-16 w-16 rounded-full object-cover ring-2 ring-background"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
              }}
            />
          ) : null}
          <div
            className={`mx-auto h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center ${
              contact.profile_picture_url ? "hidden" : ""
            }`}
          >
            <span className="text-xl font-bold text-primary">
              {(linkedClient?.name || contact.linked_client?.name || contact.name || contact.phone || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{linkedClient?.name || contact.linked_client?.name || contact.name || "Sem nome"}</p>
            <p className="text-xs text-muted-foreground">{contact.phone}</p>
          </div>
        </div>

        {/* Link status badge */}
        <ClientLinkStatus
          isLinked={!!linkedClient}
          isAutoLinking={autoLinking}
          onLinkClient={() => setShowLinkDialog(true)}
          onChangeLink={handleUnlink}
          onRegisterClient={!linkedClient ? onRegisterClient : undefined}
        />

        {/* Linked client info */}
        {linkedClient && <LinkedClientCard client={linkedClient} onClientUpdate={handleClientLinked} />}

        {/* Mini cadastro do contato */}
        <div className="rounded-lg border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Dados do contato
            </h4>
            {!editingDetails ? (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingDetails(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-7 text-xs gap-1"
                onClick={handleSaveDetails}
                disabled={savingDetails}
              >
                <Save className="h-3 w-3" /> Salvar
              </Button>
            )}
          </div>

          {editingDetails ? (
            <div className="space-y-2">
              <div>
                <label className="text-[10px] text-muted-foreground">Endereço</label>
                <Input
                  value={contactDetails.address}
                  onChange={(e) => setContactDetails((prev) => ({ ...prev, address: e.target.value }))}
                  className="h-8 text-xs"
                  placeholder="Rua, número, complemento"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-muted-foreground">Cidade</label>
                  <Input
                    value={contactDetails.city}
                    onChange={(e) => setContactDetails((prev) => ({ ...prev, city: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Cidade"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Bairro</label>
                  <Input
                    value={contactDetails.neighborhood}
                    onChange={(e) => setContactDetails((prev) => ({ ...prev, neighborhood: e.target.value }))}
                    className="h-8 text-xs"
                    placeholder="Bairro"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Observações do cliente</label>
                <Textarea
                  value={contactDetails.observations}
                  onChange={(e) => setContactDetails((prev) => ({ ...prev, observations: e.target.value }))}
                  className="min-h-[64px] text-xs"
                  placeholder="Preferências, contexto e detalhes importantes"
                />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground">Informações adicionais</label>
                <Textarea
                  value={contactDetails.additionalInfo}
                  onChange={(e) => setContactDetails((prev) => ({ ...prev, additionalInfo: e.target.value }))}
                  className="min-h-[56px] text-xs"
                  placeholder="Outras informações úteis para atendimento"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs w-full"
                onClick={() => setEditingDetails(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2 text-muted-foreground">
                <Building2 className="h-3 w-3 mt-0.5" />
                <span>{contactDetails.address || "Endereço não informado"}</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="h-3 w-3 mt-0.5" />
                <span>
                  {[contactDetails.city, contactDetails.neighborhood].filter(Boolean).join(" • ") || "Cidade/Bairro não informados"}
                </span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <FileText className="h-3 w-3 mt-0.5" />
                <span className="whitespace-pre-wrap">
                  {contactDetails.observations || contactDetails.additionalInfo || "Sem observações adicionais"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Service history (only when linked) */}
        {linkedClient && (
          <ServiceHistory
            stats={serviceStats}
            openServices={openServices}
            recentServices={recentServices}
            clientId={linkedClient.id}
            onShowCreateOS={onShowCreateOS}
          />
        )}

        {/* Quick action: Create OS when not linked */}
        {!linkedClient && !autoLinking && onShowCreateOS && (
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-1.5 text-xs h-8"
            onClick={onShowCreateOS}
          >
            <Plus className="h-3 w-3" /> Criar OS
          </Button>
        )}

        {/* Tags */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Etiquetas</h4>
            <TagSelector currentTags={tags} onToggle={handleToggleTag} />
          </div>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {tags.map((tag) => (
                <TagBadge key={tag} tag={tag} color={getTagByName(tag)?.color || "gray"} onRemove={() => handleToggleTag(tag)} />
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Nenhuma etiqueta</p>
          )}
        </div>

        {/* Internal notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
              <StickyNote className="h-3 w-3" /> Notas internas
            </h4>
            {!editingNote && (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditingNote(true)}>
                <Pencil className="h-3 w-3" />
              </Button>
            )}
          </div>
          {editingNote ? (
            <div className="space-y-2">
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex: Cliente pediu orçamento para 2 splits"
                className="min-h-[80px] text-xs"
              />
              <div className="flex gap-2">
                <Button size="sm" className="gap-1 text-xs h-7 flex-1" onClick={handleSaveNote}>
                  <Save className="h-3 w-3" /> Salvar
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-7"
                  onClick={() => {
                    setEditingNote(false);
                    setNote(contact.internal_note || "");
                  }}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
              {contact.internal_note || "Nenhuma nota registrada"}
            </p>
          )}
        </div>

        {/* Conversation status */}
        <div>
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Status da conversa</h4>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Status</span>
            <span className="font-medium text-foreground capitalize">
              {contact.conversation_status === "resolvido" ? "Finalizado" : contact.conversation_status === "atendendo" ? "Em atendimento" : "Entrada"}
            </span>
          </div>
        </div>
      </div>

      {/* Link Client Dialog */}
      {organization?.id && (
        <LinkClientDialog
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          contact={contact}
          organizationId={organization.id}
          onLinked={handleClientLinked}
        />
      )}
    </div>
  );
}
