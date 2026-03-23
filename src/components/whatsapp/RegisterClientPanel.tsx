import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useOrganization } from "@/hooks/useOrganization";
import { ClientFullForm } from "@/components/clients/ClientFullForm";
import type { ClientFormData } from "@/hooks/useClients";
import { ScrollArea } from "@/components/ui/scroll-area";

interface RegisterClientPanelProps {
  contact: any;
  onClose: () => void;
  onClientRegistered: () => void;
}

export function RegisterClientPanel({ contact, onClose, onClientRegistered }: RegisterClientPanelProps) {
  const { organization } = useOrganization();
  const [saving, setSaving] = useState(false);

  // Pre-fill from contact data
  const prefillClient = {
    name: contact.name || "",
    phone: contact.phone || contact.normalized_phone || "",
    whatsapp: contact.phone || contact.normalized_phone || "",
    email: contact.email || "",
    street: contact.street || "",
    number: contact.number || "",
    neighborhood: contact.neighborhood || "",
    city: contact.city || "",
    state: contact.state || "",
    zip_code: contact.zip_code || "",
    complement: contact.complement || "",
    notes: contact.notes || "",
    internal_notes: contact.internal_notes || "",
    person_type: "pf" as const,
  };

  const handleSubmit = async (data: ClientFormData) => {
    if (!organization?.id) {
      toast.error("Organização não encontrada");
      return;
    }

    setSaving(true);
    try {
      const { data: client, error } = await supabase
        .from("clients")
        .insert({
          ...data,
          organization_id: organization.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Link the WhatsApp contact to the new client
      if (client) {
        await supabase
          .from("whatsapp_contacts")
          .update({
            linked_client_id: client.id,
            linked_at: new Date().toISOString(),
            name: data.name,
            is_name_custom: true,
          })
          .eq("id", contact.id);
      }

      toast.success("Cliente cadastrado e vinculado!");
      onClientRegistered();
      onClose();
    } catch (err) {
      toast.error("Erro ao cadastrar cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Cadastrar como cliente</h3>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Full client form - scrollable */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <ClientFullForm
            client={prefillClient as any}
            onSubmit={handleSubmit}
            isSubmitting={saving}
            onCancel={onClose}
            inline
          />
        </div>
      </ScrollArea>
    </div>
  );
}
