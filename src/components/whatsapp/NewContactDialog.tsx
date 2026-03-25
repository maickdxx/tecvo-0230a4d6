import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface NewContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  channelId: string | null;
  onCreated: (contactId: string) => void;
}

export function NewContactDialog({ open, onOpenChange, channelId, onCreated }: NewContactDialogProps) {
  const { organization } = useOrganization();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  const normalizePhone = (raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 10 || digits.length === 11) return "55" + digits;
    return digits;
  };

  const handleSubmit = async () => {
    if (!phone.trim() || !organization?.id) return;

    const normalized = normalizePhone(phone);
    if (normalized.length < 10) {
      toast.error("Número de telefone inválido");
      return;
    }

    setSaving(true);
    try {
      // Check if contact already exists in THIS organization (across any channel)
      const { data: existing } = await supabase
        .from("whatsapp_contacts")
        .select("id, channel_id")
        .eq("organization_id", organization.id)
        .eq("normalized_phone", normalized)
        .maybeSingle();

      if (existing) {
        const channelMsg = existing.channel_id === channelId 
          ? "Já existe uma conversa deste número neste canal"
          : "Este contato já existe em outro canal da organização, abrindo conversa anterior";
        toast.info(channelMsg);
        onCreated(existing.id);
        onOpenChange(false);
        resetForm();
        return;
      }

      const whatsappId = normalized + "@s.whatsapp.net";
      const displayPhone = "+" + normalized;

      const { data, error } = await supabase
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
          source: "whatsapp",
          has_conversation: true,
        })
        .select("id")
        .single();

      if (error) throw error;

      toast.success("Contato adicionado");
      onCreated(data.id);
      onOpenChange(false);
      resetForm();
    } catch (err: any) {
      toast.error("Erro ao criar contato: " + (err.message || ""));
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName("");
    setPhone("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo contato</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="nc-phone">Telefone *</Label>
            <Input
              id="nc-phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nc-name">Nome (opcional)</Label>
            <Input
              id="nc-name"
              placeholder="Nome do contato"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving || !phone.trim()}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Adicionar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
