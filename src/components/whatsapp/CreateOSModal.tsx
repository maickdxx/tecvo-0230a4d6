import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2, CheckCircle, ExternalLink, Send, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceForm } from "@/components/services/ServiceForm";
import { useClients, type Client, type ClientFormData } from "@/hooks/useClients";
import { useServices, type ServiceFormData } from "@/hooks/useServices";
import { useOrganization } from "@/hooks/useOrganization";
import { useServicePDFSend } from "@/hooks/useServicePDFSend";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { type ServiceItemLocal } from "@/components/services/ServiceCatalogSelector";
import { type ServiceEquipmentLocal } from "@/hooks/useServiceEquipment";

interface CreateOSModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  linkedClient?: any;
  prefill?: any;
  inline?: boolean;
}

export function CreateOSModal({ open, onOpenChange, contact, linkedClient, prefill, inline }: CreateOSModalProps) {
  const navigate = useNavigate();
  const { organization } = useOrganization();
  const { create, isCreating } = useServices({ documentType: "service_order" });
  const { create: createClient, isCreating: isCreatingClient, clients } = useClients();
  const { sendOSViaWhatsApp, sending: sendingPDF } = useServicePDFSend();

  const [expanded, setExpanded] = useState(false);
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);
  const [createdQuoteNumber, setCreatedQuoteNumber] = useState<number | null>(null);

  // Reset on open/close
  useEffect(() => {
    if (!open) {
      setCreatedServiceId(null);
      setCreatedQuoteNumber(null);
    }
  }, [open]);

  // Auto-create or find client from contact when opening
  useEffect(() => {
    if (!open || linkedClient) return;

    // If contact has linked_client_id, the client should already exist in the list
    if (contact?.linked_client_id) return;

    // We'll let the user select/create through the form
  }, [open, contact, linkedClient]);

  const handleSubmit = async (data: ServiceFormData, items?: ServiceItemLocal[], equipmentList?: ServiceEquipmentLocal[]) => {
    try {
      // If no client_id yet, create one from contact info
      let clientId = data.client_id;

      if (!clientId && contact) {
        const newClient = await createClient({
          name: contact.name || "Sem nome",
          phone: contact.phone || "",
        } as any);
        clientId = newClient.id;

        // Auto-link contact to client
        await supabase
          .from("whatsapp_contacts")
          .update({
            linked_client_id: clientId,
            linked_at: new Date().toISOString(),
            name: contact.name || "Sem nome",
            is_name_custom: true,
          })
          .eq("id", contact.id);
      }

      const formData: ServiceFormData = {
        ...data,
        client_id: clientId,
        document_type: "service_order",
      };

      const newService = await create(formData);

      // Link service to WhatsApp contact for conversion tracking
      if (contact?.id) {
        await supabase
          .from("whatsapp_contacts")
          .update({ linked_service_id: newService.id })
          .eq("id", contact.id);
      }

      // Save service items
      if (items && items.length > 0 && organization?.id) {
        await supabase
          .from("service_items")
          .insert(items.map(item => ({
            service_id: newService.id,
            organization_id: organization.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            discount_type: item.discount_type,
          })));
      }

      // Save equipment
      if (equipmentList && equipmentList.length > 0 && organization?.id) {
        await supabase
          .from("service_equipment")
          .insert(equipmentList.map(eq => ({
            service_id: newService.id,
            organization_id: organization.id,
            name: eq.name,
            brand: eq.brand,
            model: eq.model,
            serial_number: eq.serial_number,
            conditions: eq.conditions,
            defects: eq.defects,
            solution: eq.solution,
            technical_report: eq.technical_report,
            warranty_terms: eq.warranty_terms,
          })));
      }

      setCreatedServiceId(newService.id);
      setCreatedQuoteNumber(newService.quote_number);
    } catch (err: any) {
      if (err.message !== "LIMIT_REACHED") {
        toast.error("Erro ao criar OS: " + (err.message || "Tente novamente"));
      }
    }
  };

  const handleSendViaWhatsApp = async () => {
    if (!createdServiceId) return;
    await sendOSViaWhatsApp(
      createdServiceId,
      contact?.phone,
      contact?.id,
      contact?.channel_id || undefined,
    );
  };

  const preSelectedClientId = linkedClient?.id || contact?.linked_client_id;

  // Success state content
  const successContent = (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <CheckCircle className="h-7 w-7 text-emerald-600" />
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-foreground">OS criada com sucesso!</h3>
        <p className="text-sm text-muted-foreground">
          OS #{createdQuoteNumber?.toString().padStart(4, "0")} foi registrada no sistema.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        <Button
          className="w-full gap-1.5"
          variant="default"
          onClick={handleSendViaWhatsApp}
          disabled={sendingPDF}
        >
          {sendingPDF ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          Enviar OS via WhatsApp
        </Button>
        <Button
          variant="outline"
          className="w-full gap-1.5"
          onClick={() => {
            onOpenChange(false);
            navigate(`/ordens-servico/${createdServiceId}`);
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ver OS completa
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => onOpenChange(false)}
        >
          Voltar ao chat
        </Button>
      </div>
    </div>
  );

  // Form content
  const formContent = (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">Nova Ordem de Serviço</h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          className="h-7 w-7"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="mt-4">
        <ServiceForm
          service={prefill ? prefill as any : undefined}
          clients={clients}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isSubmitting={isCreating}
          createClient={createClient}
          isCreatingClient={isCreatingClient}
          defaultClientId={preSelectedClientId || undefined}
        />
      </div>
    </>
  );

  const content = createdServiceId ? successContent : formContent;

  if (inline) {
    return (
      <div className="flex flex-col h-full overflow-y-auto p-4 bg-card">
        {content}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        className={cn(
          "w-full overflow-y-auto transition-all duration-200",
          expanded ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        {content}
      </SheetContent>
    </Sheet>
  );
}
