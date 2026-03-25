import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useWhatsAppTags, getTagColorStyle, AVAILABLE_TAG_COLORS, WhatsAppTag } from "@/hooks/useWhatsAppTags";
import { cn } from "@/lib/utils";

interface ContactEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
  contact?: any; // null for create mode
  onSaved: () => void;
}

export function ContactEditDialog({ open, onOpenChange, channelId, contact, onSaved }: ContactEditDialogProps) {
  const { organization } = useOrganization();
  const { tags: orgTags, createTag } = useWhatsAppTags();
  const isEdit = !!contact;

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && contact) {
      setName(contact.name || "");
      setPhone(contact.phone || "");
      setEmail(contact.visitor_metadata?.email || "");
      setCompany(contact.visitor_metadata?.company || "");
      setNotes(contact.internal_note || "");
      setSelectedTags(contact.tags || []);
    } else if (open && !contact) {
      setName("");
      setPhone("");
      setEmail("");
      setCompany("");
      setNotes("");
      setSelectedTags([]);
    }
  }, [open, contact]);

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
  };

  const handleSubmit = async () => {
    if (!organization?.id) return;

    if (!isEdit && !phone.trim()) {
      toast.error("Telefone é obrigatório");
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        const metadata = {
          ...(contact.visitor_metadata || {}),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
        };

        const { error } = await supabase
          .from("whatsapp_contacts")
          .update({
            name: name.trim() || null,
            is_name_custom: !!name.trim(),
            internal_note: notes.trim() || null,
            tags: selectedTags,
            visitor_metadata: metadata,
          })
          .eq("id", contact.id);

        if (error) throw error;
        toast.success("Contato atualizado");
      } else {
        const normalized = normalizePhone(phone);
        if (normalized.length < 10) {
          toast.error("Número de telefone inválido");
          setSaving(false);
          return;
        }

        // Check duplicate
        const { data: existing } = await supabase
          .from("whatsapp_contacts")
          .select("id")
          .eq("organization_id", organization.id)
          .eq("normalized_phone", normalized)
          .maybeSingle();

        if (existing) {
          toast.error("Já existe um contato com esse número");
          setSaving(false);
          return;
        }

        const whatsappId = normalized + "@s.whatsapp.net";
        const displayPhone = "+" + normalized;

        const metadata: Record<string, any> = {};
        if (email.trim()) metadata.email = email.trim();
        if (company.trim()) metadata.company = company.trim();

        const { error } = await supabase
          .from("whatsapp_contacts")
          .insert({
            organization_id: organization.id,
            channel_id: channelId,
            name: name.trim() || null,
            phone: displayPhone,
            normalized_phone: normalized,
            whatsapp_id: whatsappId,
            is_group: false,
            conversation_status: "novo",
            conversion_status: "novo_contato",
            source: "whatsapp",
            internal_note: notes.trim() || null,
            tags: selectedTags.length > 0 ? selectedTags : null,
            visitor_metadata: Object.keys(metadata).length > 0 ? metadata : null,
          });

        if (error) throw error;
        toast.success("Contato criado");
      }

      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error("Erro: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tagName: string) => {
    setSelectedTags(prev =>
      prev.includes(tagName) ? prev.filter(t => t !== tagName) : [...prev, tagName]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar contato" : "Novo contato"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {!isEdit && (
            <div className="space-y-2">
              <Label>Telefone *</Label>
              <Input
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              placeholder="Nome do contato"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Email (opcional)</Label>
            <Input
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Empresa (opcional)</Label>
            <Input
              placeholder="Nome da empresa"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Notas internas sobre o contato..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1.5">
              {orgTags.map(tag => {
                const selected = selectedTags.includes(tag.name);
                const style = getTagColorStyle(tag.color);
                return (
                  <button
                    key={tag.id}
                    onClick={() => toggleTag(tag.name)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all",
                      selected
                        ? cn(style.bg, style.text, style.border, "ring-1 ring-primary/30")
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span className={cn("w-2 h-2 rounded-full", style.bg, "border", style.border)} />
                    {tag.name}
                  </button>
                );
              })}
              {orgTags.length === 0 && (
                <span className="text-xs text-muted-foreground">Nenhuma etiqueta criada</span>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || (!isEdit && !phone.trim())}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEdit ? "Salvar" : "Adicionar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
