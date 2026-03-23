import { useState } from "react";
import { ExternalLink, MapPin, Mail, Phone, CalendarDays, Building2, Pencil, Save, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinkedClientCardProps {
  client: {
    id: string;
    name: string;
    phone?: string;
    email?: string;
    city?: string;
    state?: string;
    company_name?: string;
    street?: string;
    number?: string;
    neighborhood?: string;
    zip_code?: string;
    created_at?: string;
    complement?: string;
    internal_notes?: string;
  };
  onClientUpdate?: () => void;
}

export function LinkedClientCard({ client, onClientUpdate }: LinkedClientCardProps) {
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState(client.email || "");
  const [companyName, setCompanyName] = useState(client.company_name || "");
  const [street, setStreet] = useState(client.street || "");
  const [number, setNumber] = useState(client.number || "");
  const [neighborhood, setNeighborhood] = useState(client.neighborhood || "");
  const [complement, setComplement] = useState(client.complement || "");
  const [city, setCity] = useState(client.city || "");
  const [state, setState] = useState(client.state || "");
  const [zipCode, setZipCode] = useState(client.zip_code || "");
  const [internalNotes, setInternalNotes] = useState(client.internal_notes || "");

  const startEdit = () => {
    setEmail(client.email || "");
    setCompanyName(client.company_name || "");
    setStreet(client.street || "");
    setNumber(client.number || "");
    setNeighborhood(client.neighborhood || "");
    setComplement(client.complement || "");
    setCity(client.city || "");
    setState(client.state || "");
    setZipCode(client.zip_code || "");
    setInternalNotes(client.internal_notes || "");
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase.from("clients").update({
      email: email.trim() || null,
      company_name: companyName.trim() || null,
      street: street.trim() || null,
      number: number.trim() || null,
      neighborhood: neighborhood.trim() || null,
      complement: complement.trim() || null,
      city: city.trim() || null,
      state: state.trim() || null,
      zip_code: zipCode.trim() || null,
      internal_notes: internalNotes.trim() || null,
    }).eq("id", client.id);
    setSaving(false);

    if (error) {
      toast.error("Erro ao salvar");
      return;
    }
    toast.success("Dados atualizados");
    setEditing(false);
    onClientUpdate?.();
  };

  const address = [client.street, client.number, client.neighborhood]
    .filter(Boolean)
    .join(", ");
  const cityState = [client.city, client.state].filter(Boolean).join(" - ");

  if (editing) {
    return (
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-foreground">Editar dados</h4>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">E-mail</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Empresa</label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Empresa" className="h-7 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="text-[10px] text-muted-foreground">Rua</label>
              <Input value={street} onChange={(e) => setStreet(e.target.value)} placeholder="Rua" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Nº</label>
              <Input value={number} onChange={(e) => setNumber(e.target.value)} placeholder="Nº" className="h-7 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Bairro</label>
              <Input value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} placeholder="Bairro" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Complemento</label>
              <Input value={complement} onChange={(e) => setComplement(e.target.value)} placeholder="Complemento" className="h-7 text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground">Cidade</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Estado</label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="UF" className="h-7 text-xs" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">CEP</label>
              <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="CEP" className="h-7 text-xs" />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground">Observações do cliente</label>
            <Textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              placeholder="Observações internas sobre o cliente..."
              className="min-h-[60px] text-xs"
            />
          </div>

          <Button size="sm" className="w-full gap-1 text-xs h-7" onClick={handleSave} disabled={saving}>
            <Save className="h-3 w-3" /> Salvar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-foreground">{client.name}</h4>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={startEdit}
            title="Editar dados"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-[10px] gap-1 text-primary"
            onClick={() => navigate(`/clientes/editar/${client.id}`)}
          >
            Ver ficha <ExternalLink className="h-2.5 w-2.5" />
          </Button>
        </div>
      </div>

      {client.company_name && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground -mt-1">
          <Building2 className="h-3 w-3 shrink-0" />
          <span>{client.company_name}</span>
        </div>
      )}

      <div className="space-y-1.5">
        {client.phone && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3 shrink-0" />
            <span>{client.phone}</span>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Mail className="h-3 w-3 shrink-0" />
            <span className="truncate">{client.email}</span>
          </div>
        )}
        {(address || cityState) && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <div className="min-w-0">
              {address && <p className="truncate">{address}</p>}
              {client.complement && <p className="truncate">{client.complement}</p>}
              {cityState && <p>{cityState}{client.zip_code ? ` - ${client.zip_code}` : ""}</p>}
            </div>
          </div>
        )}
        {client.internal_notes && (
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <FileText className="h-3 w-3 shrink-0 mt-0.5" />
            <p className="whitespace-pre-wrap line-clamp-3">{client.internal_notes}</p>
          </div>
        )}
        {client.created_at && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>Cliente desde {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
          </div>
        )}
      </div>
    </div>
  );
}
