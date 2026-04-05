import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, CalendarPlus, CheckCircle, ExternalLink, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useServices, type ServiceFormData } from "@/hooks/useServices";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useClients } from "@/hooks/useClients";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildTimestamp } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

interface ScheduleVisitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: any;
  linkedClient?: any;
  inline?: boolean;
}

export function ScheduleVisitModal({ open, onOpenChange, contact, linkedClient, inline }: ScheduleVisitModalProps) {
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const { create, isCreating } = useServices({ documentType: "service_order" });
  const { members } = useTeamMembers();
  const { create: createClient } = useClients();
  const { serviceTypes } = useServiceTypes();

  const fieldWorkers = members.filter((m) => m.field_worker);

  // Resolve the best service type slug for a "visit" from the org's registered types
  const resolvedServiceType = (() => {
    if (!serviceTypes.length) return null;
    // Try to find a visit-like type first
    const visitLike = serviceTypes.find((t) =>
      ["visita", "visita_tecnica", "visit"].includes(t.slug)
    );
    if (visitLike) return visitLike.slug;
    // Fallback: use "outros" if it exists
    const outros = serviceTypes.find((t) => t.slug === "outros");
    if (outros) return outros.slug;
    // Last resort: use the first available type
    return serviceTypes[0].slug;
  })();

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [updateContact, setUpdateContact] = useState(false);
  const [createdServiceId, setCreatedServiceId] = useState<string | null>(null);
  const [createdQuoteNumber, setCreatedQuoteNumber] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setCreatedServiceId(null);
    setCreatedQuoteNumber(null);
    setUpdateContact(false);

    if (linkedClient) {
      setClientName(linkedClient.name || "");
      setPhone(linkedClient.phone || contact.phone || "");
      setStreet(linkedClient.street || "");
      setCity(linkedClient.city || "");
      setState(linkedClient.state || "");
      setCompanyName(linkedClient.company_name || "");
    } else {
      setClientName(contact.name || "");
      setPhone(contact.phone || "");
      setStreet("");
      setCity("");
      setState("");
      setCompanyName("");
    }
    setDescription("");
    setNotes("");
    setAssignedTo("");
    setDate("");
    setTime("");
  }, [open, contact, linkedClient]);

  const handleSubmit = async () => {
    if (!clientName.trim() || !phone.trim()) {
      toast.error("Nome e telefone são obrigatórios");
      return;
    }
    if (!date) {
      toast.error("Selecione uma data para a visita");
      return;
    }

    try {
      let clientId = linkedClient?.id || contact.linked_client_id;

      if (!clientId) {
        const newClient = await createClient({
          name: clientName.trim(),
          phone: phone.trim(),
          street: street.trim() || undefined,
          city: city.trim() || undefined,
          state: state.trim() || undefined,
          company_name: companyName.trim() || undefined,
        } as any);
        clientId = newClient.id;

        await supabase
          .from("whatsapp_contacts")
          .update({
            linked_client_id: clientId,
            linked_at: new Date().toISOString(),
            name: clientName.trim(),
            is_name_custom: true,
          })
          .eq("id", contact.id);
      }

      if (updateContact && clientId) {
        const updates: Record<string, string | null> = {};
        if (street.trim()) updates.street = street.trim();
        if (city.trim()) updates.city = city.trim();
        if (state.trim()) updates.state = state.trim();
        if (companyName.trim()) updates.company_name = companyName.trim();
        if (Object.keys(updates).length > 0) {
          await supabase.from("clients").update(updates).eq("id", clientId);
        }
      }

      // Build scheduled_date with proper timezone offset
      const timeStr = time || "08:00";
      let scheduledDate = buildTimestamp(date, `${timeStr}:00`, tz);

      if (!resolvedServiceType) {
        toast.error("Nenhum tipo de serviço cadastrado. Configure os tipos de serviço nas configurações.");
        return;
      }

      const formData: ServiceFormData = {
        client_id: clientId,
        service_type: resolvedServiceType,
        document_type: "service_order",
        status: "scheduled",
        scheduled_date: scheduledDate,
        description: description.trim() || "Visita técnica",
        notes: notes.trim() || undefined,
        assigned_to: assignedTo || undefined,
        service_street: street.trim() || undefined,
        service_city: city.trim() || undefined,
        service_state: state.trim() || undefined,
      };

      const newService = await create(formData);

      // Link service to WhatsApp contact for conversion tracking
      if (contact?.id) {
        await supabase
          .from("whatsapp_contacts")
          .update({ linked_service_id: newService.id })
          .eq("id", contact.id);
      }

      // Materialize official PDF
      if (newService.organization_id) {
        try {
          const { materializeServicePDF } = await import("@/lib/materializePDF");
          await materializeServicePDF(newService.id, newService.organization_id);
        } catch (e) {
          console.warn("[ScheduleVisitModal] PDF materialization failed:", e);
        }
      }

      setCreatedServiceId(newService.id);
      setCreatedQuoteNumber(newService.quote_number);
    } catch (err: any) {
      if (err.message !== "LIMIT_REACHED") {
        toast.error("Erro ao agendar: " + (err.message || "Tente novamente"));
      }
    }
  };

  const successContent = (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
        <CheckCircle className="h-7 w-7 text-emerald-600" />
      </div>
      <div className="text-center space-y-1">
        <h3 className="text-lg font-semibold text-foreground">Visita agendada!</h3>
        <p className="text-sm text-muted-foreground">
          Visita #{createdQuoteNumber?.toString().padStart(4, "0")} foi registrada na agenda.
        </p>
      </div>
      <div className="flex gap-2 w-full">
        <Button variant="outline" className="flex-1 gap-1.5" onClick={() => onOpenChange(false)}>
          Voltar ao chat
        </Button>
        <Button
          className="flex-1 gap-1.5"
          onClick={() => {
            onOpenChange(false);
            navigate(`/ordens-servico/${createdServiceId}`);
          }}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Ver agendamento
        </Button>
      </div>
    </div>
  );

  const formContent = (
    <>
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarPlus className="h-5 w-5 text-primary" />
          Agendar Visita
        </h3>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="space-y-4 pt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome do cliente *</Label>
            <Input value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Nome" className="h-9 text-sm" disabled={!!linkedClient} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Telefone *</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Telefone" className="h-9 text-sm" disabled={!!linkedClient} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Empresa" className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Cidade</Label>
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="h-9 text-sm" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Endereço</Label>
          <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua, número" className="h-9 text-sm" />
        </div>

        <div className="border-t border-border pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Data *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Horário</Label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 text-sm" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição da visita</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Motivo ou objetivo da visita..." className="min-h-[70px] text-sm" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Informações adicionais..." className="min-h-[50px] text-sm" />
          </div>

          {fieldWorkers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs">Técnico responsável</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar técnico" />
                </SelectTrigger>
                <SelectContent>
                  {fieldWorkers.map((fw) => (
                    <SelectItem key={fw.user_id} value={fw.user_id}>
                      {fw.full_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {linkedClient && (street || city || companyName) && (
          <div className="flex items-center space-x-2 pt-1">
            <Checkbox id="update-contact-visit" checked={updateContact} onCheckedChange={(v) => setUpdateContact(!!v)} />
            <label htmlFor="update-contact-visit" className="text-xs text-muted-foreground cursor-pointer">
              Atualizar informações no cadastro do cliente
            </label>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button className="flex-1 gap-1.5" onClick={handleSubmit} disabled={isCreating || !clientName.trim() || !phone.trim() || !date}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
            Agendar visita
          </Button>
        </div>
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
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {content}
      </SheetContent>
    </Sheet>
  );
}
