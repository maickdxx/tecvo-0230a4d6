import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sparkles,
  Loader2,
  MapPin,
  DollarSign,
  Wrench,
  MessageSquareText,
  AlertTriangle,
  CheckCircle,
  Edit3,
  User,
  Calendar,
  Clock,
  FileText,
  ChevronDown,
  ChevronUp,
  Send,
  ExternalLink,
  Package,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useServices, type ServiceFormData } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useServicePDFSend } from "@/hooks/useServicePDFSend";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { PaymentMethodSelect } from "@/components/services/PaymentMethodSelect";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { buildTimestamp } from "@/lib/timezone";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";

interface AnalyzeConversationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  contact: any;
  linkedClient?: any;
  inline?: boolean;
}

interface ExtractionData {
  client_name?: string;
  client_phone?: string;
  service_street?: string;
  service_number?: string;
  service_complement?: string;
  service_neighborhood?: string;
  service_city?: string;
  service_state?: string;
  service_zip_code?: string;
  service_type?: string;
  catalog_service_id?: string;
  equipment_type?: string;
  equipment_capacity?: string;
  equipment_brand?: string;
  equipment_model?: string;
  description?: string;
  value?: number;
  discount?: number;
  discount_type?: "percentage" | "fixed";
  final_value?: number;
  notes?: string;
  scheduled_date?: string;
  scheduled_time?: string;
  exit_time?: string;
  payment_method?: string;
  payment_due_date?: string;
  assigned_to?: string;
  sources?: Record<string, string>;
  confidence?: {
    address?: string;
    value?: string;
    service?: string;
    cep?: string;
  };
}

const CONFIDENCE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
  alta: { label: "Alta", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: CheckCircle },
  media: { label: "Média", color: "bg-amber-500/10 text-amber-700 border-amber-500/20", icon: AlertTriangle },
  baixa: { label: "Baixa", color: "bg-destructive/10 text-destructive border-destructive/20", icon: AlertTriangle },
};

const SERVICE_TYPES = [
  { value: "instalacao", label: "Instalação" },
  { value: "manutencao", label: "Manutenção" },
  { value: "limpeza", label: "Limpeza" },
  { value: "contratos", label: "Contratos" },
  { value: "outros", label: "Outros" },
];

export function AnalyzeConversationModal({
  open,
  onOpenChange,
  contactId,
  contact,
  linkedClient,
  inline,
}: AnalyzeConversationModalProps) {
  const navigate = useNavigate();
  const tz = useOrgTimezone();
  const { organization } = useOrganization();
  const { messages } = useWhatsAppMessages(contactId);
  const { create, isCreating } = useServices({ documentType: "service_order" });
  const { create: createClient, isCreating: isCreatingClient } = useClients();
  const { sendOSViaWhatsApp, sending: sendingPDF } = useServicePDFSend();
  const { paymentMethods, isLoading: isLoadingPaymentMethods, formatFee } = usePaymentMethods();
  const { fieldWorkers, isLoading: isLoadingTeam } = useTeamMembers();

  const [loading, setLoading] = useState(false);
  const [extraction, setExtraction] = useState<ExtractionData | null>(null);
  const [matchedCatalog, setMatchedCatalog] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<ExtractionData>({});
  const [showSources, setShowSources] = useState(false);
  const [step, setStep] = useState<"review" | "completing">("review");
  const [missingRequiredFields, setMissingRequiredFields] = useState<string[]>([]);
  const [requiredCompletion, setRequiredCompletion] = useState<Pick<ExtractionData, "exit_time" | "payment_method" | "payment_due_date" | "assigned_to">>({
    exit_time: "",
    payment_method: "",
    payment_due_date: "",
    assigned_to: "",
  });

  // Created OS state
  const [createdService, setCreatedService] = useState<any>(null);

  const findMissingRequiredFields = (data: Partial<ExtractionData>) => {
    const missing: string[] = [];
    const hasPaymentMethod = !!data.payment_method?.trim() && data.payment_method !== "none";
    const hasPaymentDueDate = !!data.payment_due_date?.trim();

    if (!hasPaymentMethod) missing.push("Forma de pagamento");
    if (!hasPaymentDueDate) missing.push("Data de vencimento");

    return missing;
  };

  const resetState = () => {
    setExtraction(null);
    setEditData({});
    setMatchedCatalog(null);
    setCreatedService(null);
    setEditMode(false);
    setShowSources(false);
    setStep("review");
    setMissingRequiredFields([]);
    setRequiredCompletion({ exit_time: "", payment_method: "", payment_due_date: "", assigned_to: "" });
  };

  const analyze = async () => {
    if (!organization?.id) return;
    setLoading(true);
    setExtraction(null);
    setCreatedService(null);
    setStep("review");
    setMissingRequiredFields([]);
    setRequiredCompletion({ exit_time: "", payment_method: "", payment_due_date: "", assigned_to: "" });
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-conversation`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            contactId,
            organizationId: organization.id,
            conversationMessages: messages.map((m: any) => ({
              content: m.content,
              is_from_me: m.is_from_me,
              created_at: m.created_at || m.timestamp,
            })),
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao analisar conversa");
      }

      const data = await resp.json();
      const extracted = data.extraction || {};
      setExtraction(extracted);
      setEditData(extracted);
      setRequiredCompletion({
        exit_time: extracted.exit_time || "",
        payment_method: extracted.payment_method || "",
        payment_due_date: extracted.payment_due_date || "",
        assigned_to: "",
      });
      setMatchedCatalog(data.matchedCatalogService || null);
    } catch (e: any) {
      toast.error(e.message || "Erro ao analisar");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOS = async () => {
    const baseData = editMode ? editData : extraction;
    if (!baseData) return;

    const data: ExtractionData = {
      ...baseData,
      ...requiredCompletion,
    };

    try {
      // Resolve client
      let clientId = linkedClient?.id || contact?.linked_client_id;
      
      if (!clientId && contact) {
        const newClient = await createClient({
          name: data.client_name || contact.name || "Sem nome",
          phone: data.client_phone || contact.phone || "",
          zip_code: data.service_zip_code || undefined,
          street: data.service_street || undefined,
          number: data.service_number || undefined,
          complement: data.service_complement || undefined,
          neighborhood: data.service_neighborhood || undefined,
          city: data.service_city || undefined,
          state: data.service_state || undefined,
        });
        clientId = newClient.id;

        // Auto-link contact to client
        await supabase
          .from("whatsapp_contacts")
          .update({
            linked_client_id: clientId,
            linked_at: new Date().toISOString(),
            name: data.client_name || contact.name || "Sem nome",
            is_name_custom: true,
          })
          .eq("id", contact.id);
      } else if (clientId) {
        // Update existing client with address data from AI if available
        const addressUpdate: Record<string, string> = {};
        if (data.service_zip_code) addressUpdate.zip_code = data.service_zip_code;
        if (data.service_street) addressUpdate.street = data.service_street;
        if (data.service_number) addressUpdate.number = data.service_number;
        if (data.service_complement) addressUpdate.complement = data.service_complement;
        if (data.service_neighborhood) addressUpdate.neighborhood = data.service_neighborhood;
        if (data.service_city) addressUpdate.city = data.service_city;
        if (data.service_state) addressUpdate.state = data.service_state;
        
        if (Object.keys(addressUpdate).length > 0) {
          await supabase
            .from("clients")
            .update(addressUpdate)
            .eq("id", clientId);
        }
      }

      const formData: ServiceFormData = {
        client_id: clientId,
        document_type: "service_order",
        service_type: (data.service_type as any) || "outros",
        description: data.description || "",
        value: data.value ?? data.final_value ?? 0,
        notes: data.notes || "",
        assigned_to: data.assigned_to || undefined,
        service_street: data.service_street || "",
        service_number: data.service_number || "",
        service_complement: data.service_complement || "",
        service_neighborhood: data.service_neighborhood || "",
        service_city: data.service_city || "",
        service_state: data.service_state || "",
        service_zip_code: data.service_zip_code || "",
        equipment_type: data.equipment_type ? `${data.equipment_type}${data.equipment_capacity ? ` ${data.equipment_capacity} BTUs` : ""}` : "",
        equipment_brand: data.equipment_brand || "",
        equipment_model: data.equipment_model || "",
        payment_method: data.payment_method && data.payment_method !== "none" ? data.payment_method : undefined,
        payment_due_date: data.payment_due_date || undefined,
        entry_date: data.scheduled_time || undefined,
        exit_date: data.exit_time || undefined,
      };

      if (data.scheduled_date) {
        const time = data.scheduled_time || "09:00";
        formData.scheduled_date = buildTimestamp(data.scheduled_date, `${time}:00`, tz);
      }

      const newService = await create(formData);

      // Save catalog items if matched (with discount support)
      if (matchedCatalog && organization?.id) {
        const itemPrice = data.value ?? matchedCatalog.unit_price ?? 0;
        const itemDiscount = data.discount ?? 0;
        const itemDiscountType = data.discount_type === "percentage" ? "percentage" : "fixed";

        await supabase.from("service_items").insert({
          service_id: newService.id,
          organization_id: organization.id,
          name: matchedCatalog.name,
          description: matchedCatalog.description || matchedCatalog.name,
          quantity: 1,
          unit_price: itemPrice,
          discount: itemDiscount > 0 ? itemDiscount : null,
          discount_type: itemDiscount > 0 ? itemDiscountType : null,
        });
      }

      // Save equipment if present
      if (data.equipment_type && organization?.id) {
        await supabase.from("service_equipment").insert({
          service_id: newService.id,
          organization_id: organization.id,
          name: data.equipment_type || "Equipamento",
          brand: data.equipment_brand || null,
          model: data.equipment_model || null,
        });
      }

      // Link service to WhatsApp contact for conversion tracking
      if (contact?.id) {
        await supabase
          .from("whatsapp_contacts")
          .update({ linked_service_id: newService.id })
          .eq("id", contact.id);
      }

      setCreatedService(newService);
      toast.success("OS criada com sucesso!");
    } catch (err: any) {
      if (err.message !== "LIMIT_REACHED") {
        toast.error("Erro ao criar OS: " + (err.message || "Tente novamente"));
      }
    }
  };

  const handleConfirmCreate = async () => {
    const baseData = editMode ? editData : extraction;
    if (!baseData) return;

    const missing = findMissingRequiredFields({
      ...baseData,
      ...requiredCompletion,
    });

    if (missing.length > 0) {
      setMissingRequiredFields(missing);
      setStep("completing");
      return;
    }

    await handleCreateOS();
  };

  const handleCompleteAndCreate = async () => {
    const baseData = editMode ? editData : extraction;
    if (!baseData) return;

    const missing = findMissingRequiredFields({
      ...baseData,
      ...requiredCompletion,
    });

    if (missing.length > 0) {
      setMissingRequiredFields(missing);
      toast.error("Preencha os campos obrigatórios para continuar.");
      return;
    }

    await handleCreateOS();
  };

  const handleSendViaWhatsApp = async () => {
    if (!createdService?.id) return;
    await sendOSViaWhatsApp(
      createdService.id,
      contact?.phone,
      contact?.id,
      contact?.channel_id || undefined,
    );
  };

  const updateField = (key: keyof ExtractionData, value: any) => {
    setEditData((prev) => ({ ...prev, [key]: value }));
  };

  const d: ExtractionData = {
    ...((editMode ? editData : extraction) || {}),
    ...requiredCompletion,
  };
  const conf = d?.confidence;

  const ConfidenceBadge = ({ level }: { level?: string }) => {
    if (!level) return null;
    const c = CONFIDENCE_LABELS[level] || CONFIDENCE_LABELS.baixa;
    const Icon = c.icon;
    return (
      <Badge variant="outline" className={`text-[10px] gap-1 ${c.color}`}>
        <Icon className="h-3 w-3" />
        {c.label}
      </Badge>
    );
  };

  const SourceHint = ({ field }: { field: string }) => {
    const source = d?.sources?.[field];
    if (!source || !showSources) return null;
    return (
      <p className="text-[10px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
        <MessageSquareText className="h-3 w-3" />
        {source}
      </p>
    );
  };

  // Success state after OS creation
  if (createdService) {
    const finalData: ExtractionData = {
      ...((editMode ? editData : extraction) || {}),
      ...requiredCompletion,
    };
    const successContent = (
      <div className="flex flex-col items-center gap-4 py-8">
        <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
          <CheckCircle className="h-7 w-7 text-emerald-600" />
        </div>
        <div className="text-center space-y-1">
          <h3 className="text-lg font-semibold text-foreground">OS criada com sucesso!</h3>
          <p className="text-sm text-muted-foreground">
            OS #{createdService.quote_number?.toString().padStart(4, "0")}
          </p>
        </div>

        {/* Summary card */}
        <div className="w-full rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3 text-sm">
          {finalData?.description && (
            <div className="flex items-start gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-foreground">{finalData.description}</span>
            </div>
          )}
          {matchedCatalog && (
            <div className="flex items-start gap-2">
              <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-foreground">{matchedCatalog.name}</span>
            </div>
          )}
          {(finalData?.final_value ?? finalData?.value) != null && (
            <div className="flex items-start gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="font-medium text-foreground">
                R$ {Number(finalData?.final_value ?? finalData?.value).toFixed(2)}
                {finalData?.discount ? ` (desconto ${finalData.discount_type === "percentage" ? `${finalData.discount}%` : `R$ ${Number(finalData.discount).toFixed(2)}`})` : ""}
              </span>
            </div>
          )}
          {finalData?.service_street && (
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-foreground">
                {[finalData.service_street, finalData.service_number, finalData.service_neighborhood, finalData.service_city, finalData.service_state].filter(Boolean).join(", ")}
                {finalData.service_zip_code ? ` - ${finalData.service_zip_code}` : ""}
              </span>
            </div>
          )}
          {finalData?.scheduled_date && (
            <div className="flex items-start gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-foreground">
                {new Date(finalData.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR")}
                {finalData.scheduled_time ? ` às ${finalData.scheduled_time}` : ""}
              </span>
            </div>
          )}
          {finalData?.notes && (
            <div className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-muted-foreground">{finalData.notes}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 w-full">
          <Button className="w-full gap-1.5" variant="default" onClick={handleSendViaWhatsApp} disabled={sendingPDF}>
            {sendingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar confirmação para o cliente
          </Button>
          <Button variant="outline" className="w-full gap-1.5" onClick={() => { onOpenChange(false); resetState(); navigate(`/ordens-servico/${createdService.id}`); }}>
            <ExternalLink className="h-3.5 w-3.5" /> Ver OS completa
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => { resetState(); onOpenChange(false); }}>
            Voltar ao chat
          </Button>
        </div>
      </div>
    );

    if (inline) {
      return (
        <div className="flex flex-col h-full overflow-y-auto p-4 bg-card">
          {successContent}
        </div>
      );
    }

    return (
      <Sheet open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }} modal={false}>
        <SheetContent side="right" hideOverlay className="sm:max-w-md">
          {successContent}
        </SheetContent>
      </Sheet>
    );
  }

  const mainContent = (
    <div className={cn("flex flex-col", inline ? "h-full" : "overflow-hidden h-full")}>
      <div className="px-6 pt-6 pb-4 shrink-0 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-base font-semibold text-foreground">
          <Sparkles className="h-5 w-5 text-primary" />
          Analisar Conversa
        </h3>
        <Button variant="ghost" size="icon" onClick={() => { resetState(); onOpenChange(false); }} className="h-7 w-7">
          <X className="h-4 w-4" />
        </Button>
      </div>

        <ScrollArea className="flex-1 min-h-0 px-6">
          {/* Initial state */}
          {!extraction && !loading && (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
              <div className="h-16 w-16 rounded-full bg-primary/5 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-primary/40" />
              </div>
              <div className="space-y-1.5 max-w-[260px]">
                <p className="text-sm font-medium text-foreground">
                  Analisar conversa com IA
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A IA vai analisar as {messages.length} mensagens desta conversa e extrair
                  informações para criar uma Ordem de Serviço automaticamente.
                </p>
              </div>
              <Button onClick={analyze} className="gap-2" disabled={messages.length === 0}>
                <Sparkles className="h-4 w-4" />
                Analisar {messages.length} mensagens
              </Button>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
              <div className="text-center space-y-1">
                <p className="text-sm font-medium text-foreground">Analisando conversa...</p>
                <p className="text-xs text-muted-foreground">
                  Extraindo endereço, serviço, valores e observações
                </p>
              </div>
            </div>
          )}

          {/* Results */}
          {extraction && !loading && step === "review" && (
            <div className="space-y-5 pb-6">
              {/* Edit mode toggle + sources toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  className="gap-1.5 h-8 text-xs"
                  onClick={() => setEditMode(!editMode)}
                >
                  <Edit3 className="h-3 w-3" />
                  {editMode ? "Editando" : "Editar"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8 text-xs text-muted-foreground"
                  onClick={() => setShowSources(!showSources)}
                >
                  <MessageSquareText className="h-3 w-3" />
                  Fontes {showSources ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                </Button>
              </div>

              {/* Matched catalog service */}
              {matchedCatalog && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
                  <Package className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-primary">Serviço do catálogo identificado</p>
                    <p className="text-sm text-foreground">{matchedCatalog.name} — R$ {Number(matchedCatalog.unit_price).toFixed(2)}</p>
                  </div>
                </div>
              )}

              {/* Client Section */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Cliente</h3>
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Nome</Label>
                      {editMode ? (
                        <Input
                          value={editData.client_name || ""}
                          onChange={(e) => updateField("client_name", e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      ) : (
                        <p className="text-sm text-foreground">{d?.client_name || contact?.name || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Telefone</Label>
                      {editMode ? (
                        <Input
                          value={editData.client_phone || ""}
                          onChange={(e) => updateField("client_phone", e.target.value)}
                          className="h-8 text-sm mt-0.5"
                        />
                      ) : (
                        <p className="text-sm text-foreground">{d?.client_phone || contact?.phone || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Address Section */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Endereço do Serviço</h3>
                  <ConfidenceBadge level={conf?.address} />
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div className="col-span-2">
                      <Label className="text-[11px] text-muted-foreground">Rua</Label>
                      {editMode ? (
                        <Input value={editData.service_street || ""} onChange={(e) => updateField("service_street", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <>
                          <p className="text-sm text-foreground">{d?.service_street || "—"}</p>
                          <SourceHint field="service_street" />
                        </>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Número</Label>
                      {editMode ? (
                        <Input value={editData.service_number || ""} onChange={(e) => updateField("service_number", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.service_number || "—"}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Complemento</Label>
                      {editMode ? (
                        <Input value={editData.service_complement || ""} onChange={(e) => updateField("service_complement", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.service_complement || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Bairro</Label>
                      {editMode ? (
                        <Input value={editData.service_neighborhood || ""} onChange={(e) => updateField("service_neighborhood", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.service_neighborhood || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">CEP</Label>
                      <ConfidenceBadge level={conf?.cep} />
                      {editMode ? (
                        <Input value={editData.service_zip_code || ""} onChange={(e) => updateField("service_zip_code", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.service_zip_code || "—"}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Cidade</Label>
                      {editMode ? (
                        <Input value={editData.service_city || ""} onChange={(e) => updateField("service_city", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.service_city || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Estado</Label>
                      {editMode ? (
                        <Input value={editData.service_state || ""} onChange={(e) => updateField("service_state", e.target.value)} className="h-8 text-sm mt-0.5" maxLength={2} />
                      ) : (
                        <p className="text-sm text-foreground">{d?.service_state || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Service Section */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <Wrench className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Serviço</h3>
                  <ConfidenceBadge level={conf?.service} />
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Tipo</Label>
                      {editMode ? (
                        <Select value={editData.service_type || "outros"} onValueChange={(v) => updateField("service_type", v)}>
                          <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {SERVICE_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <>
                          <p className="text-sm text-foreground">
                            {SERVICE_TYPES.find((t) => t.value === d?.service_type)?.label || d?.service_type || "—"}
                          </p>
                          <SourceHint field="service_type" />
                        </>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Equipamento</Label>
                      {editMode ? (
                        <Input value={editData.equipment_type || ""} onChange={(e) => updateField("equipment_type", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.equipment_type || "—"}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Capacidade</Label>
                      {editMode ? (
                        <Input value={editData.equipment_capacity || ""} onChange={(e) => updateField("equipment_capacity", e.target.value)} className="h-8 text-sm mt-0.5" placeholder="BTUs" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.equipment_capacity ? `${d.equipment_capacity} BTUs` : "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Marca</Label>
                      {editMode ? (
                        <Input value={editData.equipment_brand || ""} onChange={(e) => updateField("equipment_brand", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.equipment_brand || "—"}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Modelo</Label>
                      {editMode ? (
                        <Input value={editData.equipment_model || ""} onChange={(e) => updateField("equipment_model", e.target.value)} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">{d?.equipment_model || "—"}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-muted-foreground">Descrição</Label>
                    {editMode ? (
                      <Textarea value={editData.description || ""} onChange={(e) => updateField("description", e.target.value)} className="text-sm mt-0.5 min-h-[60px]" />
                    ) : (
                      <>
                        <p className="text-sm text-foreground">{d?.description || "—"}</p>
                        <SourceHint field="description" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Value Section */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">Valores</h3>
                  <ConfidenceBadge level={conf?.value} />
                </div>
                <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Valor</Label>
                      {editMode ? (
                        <Input type="number" value={editData.value ?? ""} onChange={(e) => updateField("value", Number(e.target.value))} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <>
                          <p className="text-sm font-medium text-foreground">
                            {d?.value != null ? `R$ ${Number(d.value).toFixed(2)}` : "—"}
                          </p>
                          <SourceHint field="value" />
                        </>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Desconto</Label>
                      {editMode ? (
                        <Input type="number" value={editData.discount ?? ""} onChange={(e) => updateField("discount", Number(e.target.value))} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm text-foreground">
                          {d?.discount ? (d?.discount_type === "percentage" ? `${d.discount}%` : `R$ ${Number(d.discount).toFixed(2)}`) : "—"}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-[11px] text-muted-foreground">Valor Final</Label>
                      {editMode ? (
                        <Input type="number" value={editData.final_value ?? ""} onChange={(e) => updateField("final_value", Number(e.target.value))} className="h-8 text-sm mt-0.5" />
                      ) : (
                        <p className="text-sm font-bold text-primary">
                          {d?.final_value != null ? `R$ ${Number(d.final_value).toFixed(2)}` : d?.value != null ? `R$ ${Number(d.value).toFixed(2)}` : "—"}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Section */}
              {(d?.scheduled_date || editMode) && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Agendamento</h3>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Data</Label>
                        {editMode ? (
                          <Input type="date" value={editData.scheduled_date || ""} onChange={(e) => updateField("scheduled_date", e.target.value)} className="h-8 text-sm mt-0.5" />
                        ) : (
                          <p className="text-sm text-foreground">
                            {d?.scheduled_date ? new Date(d.scheduled_date + "T12:00:00").toLocaleDateString("pt-BR") : "—"}
                          </p>
                        )}
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">Horário</Label>
                        {editMode ? (
                          <Input type="time" value={editData.scheduled_time || ""} onChange={(e) => updateField("scheduled_time", e.target.value)} className="h-8 text-sm mt-0.5" />
                        ) : (
                          <p className="text-sm text-foreground">{d?.scheduled_time || "—"}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {(d?.notes || editMode) && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-semibold text-foreground">Observações</h3>
                  </div>
                  <div className="rounded-xl border border-border/60 bg-muted/20 p-3">
                    {editMode ? (
                      <Textarea value={editData.notes || ""} onChange={(e) => updateField("notes", e.target.value)} className="text-sm min-h-[60px]" />
                    ) : (
                      <>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{d?.notes || "—"}</p>
                        <SourceHint field="notes" />
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Re-analyze */}
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={analyze}
                disabled={loading}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Analisar novamente
              </Button>
            </div>
          )}

          {extraction && !loading && step === "completing" && (
            <div className="space-y-4 pb-6">
              <div className="rounded-xl border border-warning/40 bg-warning/10 p-3 space-y-2">
                <p className="text-sm font-medium text-foreground">Faltam campos obrigatórios para criar a OS</p>
                <div className="flex flex-wrap gap-2">
                  {missingRequiredFields.map((field) => (
                    <Badge key={field} variant="destructive" className="text-[11px]">
                      {field}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 text-sm">
                <p className="font-medium text-foreground">Resumo do que a IA já preencheu</p>
                <p className="text-muted-foreground">Cliente: {d?.client_name || contact?.name || "—"}</p>
                <p className="text-muted-foreground">Serviço: {d?.description || matchedCatalog?.name || "—"}</p>
                <p className="text-muted-foreground">
                  Endereço: {[d?.service_street, d?.service_number, d?.service_city, d?.service_state, d?.service_zip_code].filter(Boolean).join(", ") || "—"}
                </p>
                <p className="text-muted-foreground">
                  Entrada: {d?.scheduled_date ? new Date(`${d.scheduled_date}T12:00:00`).toLocaleDateString("pt-BR") : "—"}
                  {d?.scheduled_time ? ` às ${d.scheduled_time}` : ""}
                </p>
              </div>

              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Data de vencimento *</Label>
                  <Input
                    type="date"
                    value={requiredCompletion.payment_due_date || ""}
                    onChange={(e) => {
                      setRequiredCompletion((prev) => ({ ...prev, payment_due_date: e.target.value }));
                      setMissingRequiredFields((prev) => prev.filter((f) => f !== "Data de vencimento"));
                    }}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Forma de pagamento *</Label>
                  <PaymentMethodSelect
                    value={requiredCompletion.payment_method || ""}
                    onChange={(slug) => {
                      setRequiredCompletion((prev) => ({ ...prev, payment_method: slug }));
                      setMissingRequiredFields((prev) => prev.filter((f) => f !== "Forma de pagamento"));
                    }}
                    disabled={isLoadingPaymentMethods}
                    paymentMethods={paymentMethods}
                    formatFee={formatFee}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Técnico responsável (opcional)</Label>
                  <Select
                    value={requiredCompletion.assigned_to || "none"}
                    onValueChange={(v) => {
                      setRequiredCompletion((prev) => ({ ...prev, assigned_to: v === "none" ? "" : v }));
                    }}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Selecionar técnico" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Nenhum</SelectItem>
                      {fieldWorkers.map((fw) => (
                        <SelectItem key={fw.user_id} value={fw.user_id}>
                          {fw.full_name || "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Horário de saída (opcional)</Label>
                  <Input
                    type="time"
                    value={requiredCompletion.exit_time || ""}
                    onChange={(e) => {
                      setRequiredCompletion((prev) => ({ ...prev, exit_time: e.target.value }));
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer actions */}
        {extraction && !loading && step === "review" && (
          <div className="border-t border-border/60 p-4 shrink-0 space-y-2">
            <Button className="w-full gap-2" onClick={handleConfirmCreate} disabled={isCreating || isCreatingClient}>
              {(isCreating || isCreatingClient) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              {editMode ? "Confirmar e validar obrigatórios" : "Confirmar e criar OS"}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { resetState(); onOpenChange(false); }}>
              Cancelar
            </Button>
          </div>
        )}

        {extraction && !loading && step === "completing" && (
          <div className="border-t border-border/60 p-4 shrink-0 space-y-2">
            <Button className="w-full gap-2" onClick={handleCompleteAndCreate} disabled={isCreating || isCreatingClient || isLoadingPaymentMethods}>
              {(isCreating || isCreatingClient) ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Concluir complemento e criar OS
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setStep("review")}>
              Voltar para revisão
            </Button>
          </div>
        )}
    </div>
  );

  if (inline) {
    return (
      <div className="flex flex-col h-full bg-card">
        {mainContent}
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) resetState(); onOpenChange(o); }} modal={false}>
      <SheetContent side="right" hideOverlay className="sm:max-w-lg overflow-hidden flex flex-col p-0">
        {mainContent}
      </SheetContent>
    </Sheet>
  );
}
