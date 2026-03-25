import { useState, useEffect, useMemo, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, AlertCircle, CalendarIcon, Clock, Info, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ServiceCatalogSelector, type ServiceItemLocal } from "./ServiceCatalogSelector";
import { EquipmentEditor } from "./EquipmentEditor";
import { ClientCombobox } from "./ClientCombobox";
import { PaymentMethodSelect } from "./PaymentMethodSelect";
import { useServiceEquipment, type ServiceEquipmentLocal } from "@/hooks/useServiceEquipment";
import type { Client, ClientFormData } from "@/hooks/useClients";
import type { Service, ServiceFormData, ServiceStatus } from "@/hooks/useServices";
import { SERVICE_STATUS_LABELS } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useUserRole } from "@/hooks/useUserRole";
import { usePaymentMethods } from "@/hooks/usePaymentMethods";
import { useAuth } from "@/hooks/useAuth";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { fetchAddressByCep, formatCep } from "@/lib/viaCep";
import { supabase } from "@/integrations/supabase/client";
import { formatDateInputInTz, formatTimeInputInTz, formatDateObjInTz } from "@/lib/timezone";

const BRAZILIAN_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

// PAYMENT_METHODS static array removed - now using dynamic usePaymentMethods hook

const serviceSchema = z.object({
  client_id: z.string().min(1, "Selecione um cliente"),
  service_type: z.string().optional().default("outros"),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]).optional(),
  value: z.coerce.number().min(0).optional(),
  scheduled_date: z.string().optional(),
  description: z.string().optional(),
  notes: z.string().optional(),
  assigned_to: z.string().optional(),
  service_zip_code: z.string().optional(),
  service_street: z.string().optional(),
  service_number: z.string().optional(),
  service_complement: z.string().optional(),
  service_neighborhood: z.string().optional(),
  service_city: z.string().optional(),
  service_state: z.string().optional(),
  // OS fields
  equipment_type: z.string().optional(),
  equipment_brand: z.string().optional(),
  equipment_model: z.string().optional(),
  solution: z.string().optional(),
  payment_method: z.string().optional(),
  payment_due_date: z.string().min(1, "Informe a data de vencimento"),
  payment_notes: z.string().optional(),
  entry_date: z.string().optional(),
  exit_date: z.string().optional(),
});

interface ServiceFormProps {
  service?: Service | null;
  clients: Client[];
  onSubmit: (data: ServiceFormData, items?: ServiceItemLocal[], equipmentList?: ServiceEquipmentLocal[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  defaultDate?: Date | null;
  defaultClientId?: string;
  onClientCreated?: (client: Client) => void;
  createClient?: (data: ClientFormData) => Promise<Client>;
  isCreatingClient?: boolean;
}

export function ServiceForm({
  service,
  clients,
  onSubmit,
  onCancel,
  isSubmitting,
  defaultDate,
  defaultClientId,
  onClientCreated,
  createClient,
  isCreatingClient,
}: ServiceFormProps) {
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState<string | undefined>();
  const [isSearchingCep, setIsSearchingCep] = useState(false);
  const [serviceItems, setServiceItems] = useState<ServiceItemLocal[]>([]);
  const { equipment, addEquipment, removeEquipment, updateEquipment } = useServiceEquipment(service?.id);
  const { fieldWorkers, isLoading: isLoadingMembers } = useTeamMembers();
  const { isAdmin } = useUserRole();
  const { paymentMethods, isLoading: isLoadingPaymentMethods, formatFee } = usePaymentMethods();
  const { serviceTypes, isLoading: isLoadingServiceTypes } = useServiceTypes();
  const { organizationId } = useAuth();
  const tz = useOrgTimezone();
  const [detectedServiceType, setDetectedServiceType] = useState<string | null>(null);

  const SERVICE_TYPE_OPTIONS = useMemo(() => {
    if (serviceTypes && serviceTypes.length > 0) {
      return serviceTypes.map(t => ({ slug: t.slug, label: t.name }));
    }
    return [];
  }, [serviceTypes]);

  const getServiceTypeLabel = (slug: string) =>
    SERVICE_TYPE_OPTIONS.find(o => o.slug === slug)?.label || slug;

  // Prevent rendering form before async data is ready (avoids React DOM removeChild crash)
  const isDataReady = !!organizationId && !isLoadingPaymentMethods && !isLoadingServiceTypes;

  const isCompleted = service?.status === "completed";

  const hasItemsFromCatalog = serviceItems.some(i => !!i.catalog_service_type);

  // Load existing service items when editing
  useEffect(() => {
    if (service?.id) {
      supabase
        .from("service_items")
        .select("*")
        .eq("service_id", service.id)
        .order("created_at")
        .then(({ data }) => {
          if (data && data.length > 0) {
            setServiceItems(data.map(item => ({
              id: item.id,
              name: item.name || item.description,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              discount: item.discount || 0,
              discount_type: (item.discount_type as "percentage" | "fixed") || "percentage",
              catalog_service_id: item.catalog_service_id,
              is_non_standard: item.is_non_standard,
              category: item.category,
              estimated_duration: item.estimated_duration,
              standard_checklist: item.standard_checklist,
            })));
          }
        });
    }
  }, [service?.id]);

  const formDefaults = useMemo(() => ({
    client_id: service?.client_id ?? defaultClientId ?? "",
    service_type: service?.service_type ?? "outros",
    status: service?.status ?? "scheduled",
    value: service?.value ?? undefined,
    scheduled_date: service?.scheduled_date
      ? formatDateInputInTz(service.scheduled_date, tz)
      : defaultDate && !service
        ? formatDateObjInTz(defaultDate, tz)
        : "",
    description: service?.description ?? "",
    notes: service?.notes ?? "",
    assigned_to: (service as any)?.assigned_to ?? "",
    service_zip_code: service?.service_zip_code ?? "",
    service_street: service?.service_street ?? "",
    service_number: service?.service_number ?? "",
    service_complement: service?.service_complement ?? "",
    service_neighborhood: service?.service_neighborhood ?? "",
    service_city: service?.service_city ?? "",
    service_state: service?.service_state ?? "",
    equipment_type: service?.equipment_type ?? "",
    equipment_brand: service?.equipment_brand ?? "",
    equipment_model: service?.equipment_model ?? "",
    solution: service?.solution ?? "",
    payment_method: service?.payment_method ?? "",
    payment_due_date: service?.payment_due_date
      ? formatDateInputInTz(service.payment_due_date, tz)
      : "",
    payment_notes: service?.payment_notes ?? "",
    entry_date: formatTimeInputInTz(service?.entry_date || service?.scheduled_date, tz),
    exit_date: formatTimeInputInTz(service?.exit_date, tz),
  }), [defaultClientId, defaultDate, service, tz]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ServiceFormData & { assigned_to?: string }>({
    resolver: zodResolver(serviceSchema),
    defaultValues: formDefaults,
  });

  useEffect(() => {
    reset(formDefaults);
  }, [formDefaults, reset]);

  const handleServiceTypeDetected = useCallback((type: string) => {
    setDetectedServiceType(type);
    setValue("service_type", type);
  }, [setValue]);

  // Re-detect service type from loaded items (editing)
  useEffect(() => {
    if (serviceItems.length > 0) {
      const catalogItem = serviceItems.find(i => !!i.catalog_service_type);
      if (catalogItem?.catalog_service_type) {
        setDetectedServiceType(catalogItem.catalog_service_type);
        setValue("service_type", catalogItem.catalog_service_type);
      } else {
        setDetectedServiceType(null);
      }
    } else {
      setDetectedServiceType(null);
    }
  }, [serviceItems, setValue]);

  const serviceZipCode = watch("service_zip_code");
  const selectedClientId = watch("client_id");
  const currentServiceType = watch("service_type");

  // Auto-fill address from client when selecting a client (only for new services)
  useEffect(() => {
    if (selectedClientId && !service) {
      const selectedClient = clients.find(c => c.id === selectedClientId);
      if (selectedClient) {
        // Always fill address fields from client
        setValue("service_zip_code", selectedClient.zip_code || "");
        setValue("service_street", selectedClient.street || "");
        setValue("service_number", selectedClient.number || "");
        setValue("service_complement", selectedClient.complement || "");
        setValue("service_neighborhood", selectedClient.neighborhood || "");
        setValue("service_city", selectedClient.city || "");
        setValue("service_state", selectedClient.state || "");
      }
    }
  }, [selectedClientId, clients, service, setValue]);

  // Auto-fetch address when CEP has 8 digits
  useEffect(() => {
    const cleanCep = serviceZipCode?.replace(/\D/g, '') || '';
    if (cleanCep.length === 8) {
      setIsSearchingCep(true);
      fetchAddressByCep(cleanCep).then(data => {
        if (data) {
          setValue("service_street", data.logradouro);
          setValue("service_neighborhood", data.bairro);
          setValue("service_city", data.localidade);
          setValue("service_state", data.uf);
        }
        setIsSearchingCep(false);
      }).catch(() => setIsSearchingCep(false));
    }
  }, [serviceZipCode, setValue]);

  // Calculate total from items
  const calculateItemTotal = (item: ServiceItemLocal) => {
    const subtotal = item.quantity * item.unit_price;
    if (item.discount_type === "fixed") {
      return Math.max(0, subtotal - item.discount);
    }
    return subtotal - (subtotal * item.discount) / 100;
  };

  const itemsTotal = serviceItems.reduce((acc, item) => acc + calculateItemTotal(item), 0);

  // Update value field when items change
  useEffect(() => {
    if (serviceItems.length > 0) {
      setValue("value", itemsTotal);
    }
  }, [itemsTotal, serviceItems.length, setValue]);

  const handleFormSubmit = async (data: ServiceFormData & { assigned_to?: string }) => {
    await onSubmit(data, serviceItems.length > 0 ? serviceItems : undefined, equipment.length > 0 ? equipment : undefined);
  };

  const handleClientSubmit = async (data: ClientFormData) => {
    if (!createClient) return;
    
    const newClient = await createClient(data);
    setValue("client_id", newClient.id);
    setNewClientName(newClient.name);
    onClientCreated?.(newClient);
  };

  const handleCepChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCep(e.target.value);
    setValue("service_zip_code", formatted);
  };

  const serviceStatuses: ServiceStatus[] = ["scheduled", "in_progress", "completed", "cancelled"];

  if (!isDataReady) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
        {isCompleted && (
          <Alert variant="default" className="border-warning/50 bg-warning/10">
            <AlertCircle className="h-4 w-4 text-warning" />
            <AlertDescription className="text-warning-foreground">
              Esta OS está concluída. Para editar os campos, altere o status primeiro.
            </AlertDescription>
          </Alert>
        )}

        {/* 1. CLIENTE */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Dados do Cliente</Label>
          <div className="space-y-2">
            <Label htmlFor="client_id">Cliente *</Label>
            <div className="flex gap-2">
              <Controller
                name="client_id"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <ClientCombobox
                    clients={clients}
                    value={value}
                    onChange={(val) => {
                      onChange(val);
                      setNewClientName(undefined);
                    }}
                    disabled={isCompleted}
                    fallbackName={newClientName}
                  />
                )}
              />
              {createClient && !isCompleted && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowClientDialog(true)}
                  title="Novo Cliente"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            {errors.client_id && (
              <p className="text-sm text-destructive">{errors.client_id.message}</p>
            )}
          </div>
        </div>

        {/* 2. TÉCNICO RESPONSÁVEL */}
        {isAdmin && fieldWorkers.length > 0 && (
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <Label className="text-base font-semibold">Responsável</Label>
            <div className="space-y-2">
              <Label htmlFor="assigned_to">Técnico</Label>
              <Controller
                name="assigned_to"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Select 
                    onValueChange={(val) => onChange(val === "none" ? "" : val)} 
                    value={value || "none"} 
                    disabled={isLoadingMembers || isCompleted}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um responsável (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem responsável</SelectItem>
                      {fieldWorkers.map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>
                          {member.full_name || "Sem nome"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Funcionários verão apenas os serviços atribuídos a eles
              </p>
            </div>
          </div>
        )}

        {/* 3. EQUIPAMENTOS */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <EquipmentEditor
            equipment={equipment}
            onAdd={addEquipment}
            onRemove={removeEquipment}
            onUpdate={updateEquipment}
            disabled={isCompleted}
          />
        </div>

        {/* 4. SERVIÇOS DO CATÁLOGO */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <ServiceCatalogSelector
            items={serviceItems}
            onItemsChange={setServiceItems}
            disabled={isCompleted}
            onServiceTypeDetected={handleServiceTypeDetected}
          />
        </div>

        {/* 5. TIPO DE SERVIÇO */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold flex items-center gap-2">
            Tipo de Serviço
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-[240px]">
                  <p>O tipo de serviço é usado para classificar a OS e alimentar a recorrência automaticamente.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>

          {detectedServiceType ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 p-3 rounded-md border bg-muted/50">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Tipo detectado:</span>
                <Badge variant="secondary" className="font-medium">
                  {getServiceTypeLabel(detectedServiceType)}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Definido automaticamente pelo serviço do catálogo selecionado.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="service_type">Selecione o tipo de serviço *</Label>
              <Controller
                name="service_type"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Select onValueChange={onChange} value={value || "outros"} disabled={isCompleted}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {SERVICE_TYPE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.slug} value={opt.slug}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">
                Nenhum serviço do catálogo selecionado. Informe o tipo manualmente.
              </p>
            </div>
          )}
        </div>

        {/* 5. DESCRIÇÃO E OBSERVAÇÕES */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Descrição</Label>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Serviço</Label>
            <Textarea
              id="description"
              placeholder="Descreva o serviço a ser realizado"
              rows={3}
              disabled={isCompleted}
              {...register("description")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="solution">Solução / Descrição Técnica</Label>
            <Textarea
              id="solution"
              placeholder="Descreva o que será/foi realizado no serviço..."
              rows={3}
              disabled={isCompleted}
              {...register("solution")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Observações visíveis no documento do cliente"
              rows={2}
              disabled={isCompleted}
              {...register("notes")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="internal_notes" className="flex items-center gap-2">
              Observações Internas
              <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Somente equipe</span>
            </Label>
            <Textarea
              id="internal_notes"
              placeholder="Informações para o técnico (não aparece na OS do cliente)"
              rows={2}
              disabled={isCompleted}
              {...register("internal_notes")}
            />
          </div>
        </div>

        {/* 6. ENDEREÇO DO SERVIÇO (sempre visível, pré-preenchido do cliente) */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Endereço do Serviço</Label>
          <p className="text-xs text-muted-foreground -mt-2">
            Preenchido automaticamente a partir do cadastro do cliente. Edite se necessário.
          </p>
          
          <div className="space-y-2">
            <Label htmlFor="service_zip_code">CEP</Label>
            <div className="relative">
              <Input
                id="service_zip_code"
                placeholder="00000-000"
                maxLength={9}
                disabled={isCompleted}
                {...register("service_zip_code")}
                onChange={handleCepChange}
              />
              {isSearchingCep && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="service_street">Rua</Label>
              <Input
                id="service_street"
                placeholder="Nome da rua"
                disabled={isCompleted}
                {...register("service_street")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_number">Nº</Label>
              <Input
                id="service_number"
                placeholder="123"
                disabled={isCompleted}
                {...register("service_number")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_complement">Complemento</Label>
              <Input
                id="service_complement"
                placeholder="Apt, Sala, etc."
                disabled={isCompleted}
                {...register("service_complement")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_neighborhood">Bairro</Label>
              <Input
                id="service_neighborhood"
                placeholder="Bairro"
                disabled={isCompleted}
                {...register("service_neighborhood")}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="service_city">Cidade</Label>
              <Input
                id="service_city"
                placeholder="Cidade"
                disabled={isCompleted}
                {...register("service_city")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service_state">Estado</Label>
              <Controller
                name="service_state"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Select onValueChange={onChange} value={value || undefined} disabled={isCompleted}>
                    <SelectTrigger>
                      <SelectValue placeholder="UF" />
                    </SelectTrigger>
                    <SelectContent>
                      {BRAZILIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        </div>

        {/* 7. PAGAMENTO */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Dados do Pagamento</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Valor Total (R$)</Label>
              <Input
                id="value"
                type="number"
                step="0.01"
                placeholder="0,00"
                disabled={isCompleted}
                {...register("value")}
              />
              {serviceItems.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Calculado a partir dos serviços adicionados
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <PaymentMethodSelect
                value={watch("payment_method") || ""}
                onChange={(slug) => setValue("payment_method", slug)}
                disabled={isCompleted || isLoadingPaymentMethods}
                paymentMethods={paymentMethods}
                formatFee={formatFee}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vencimento *</Label>
              <Controller
                name="payment_due_date"
                control={control}
                render={({ field }) => {
                  const dateValue = field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={isCompleted}
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value && dateValue ? format(dateValue, "dd/MM/yyyy") : <span>Selecione a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateValue}
                          onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  );
                }}
              />
              {errors.payment_due_date && (
                <p className="text-sm text-destructive">{errors.payment_due_date.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observação do Pagamento</Label>
              <Input
                placeholder="Opcional"
                disabled={isCompleted}
                {...register("payment_notes")}
              />
            </div>
          </div>
        </div>

        {/* 8. STATUS E AGENDAMENTO */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Status e Agendamento</Label>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field: { onChange, value } }) => (
                  <Select onValueChange={onChange} value={value}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {serviceStatuses.filter(s => s !== "cancelled").map((status) => (
                        <SelectItem key={status} value={status}>
                          {SERVICE_STATUS_LABELS[status]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Data Agendada</Label>
              <Controller
                name="scheduled_date"
                control={control}
                render={({ field }) => {
                  const dateValue = field.value ? parse(field.value, "yyyy-MM-dd", new Date()) : undefined;
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={isCompleted}
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value && dateValue ? format(dateValue, "dd/MM/yyyy") : <span>Selecione a data</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={dateValue}
                          onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                          initialFocus
                          locale={ptBR}
                          className="p-3 pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  );
                }}
              />
            </div>
          </div>
          
          {/* Período de Execução */}
          <p className="text-sm font-medium text-foreground pt-2">Período de Execução</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="entry_date">Horário de Entrada</Label>
              <Controller
                name="entry_date"
                control={control}
                render={({ field }) => {
                  const [h, m] = (field.value || "").split(":");
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={isCompleted}
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          {field.value || <span>Selecione</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3 pointer-events-auto" align="start">
                        <div className="flex items-center gap-2">
                          <Select value={h || ""} onValueChange={(val) => field.onChange(`${val}:${m || "00"}`)}>
                            <SelectTrigger className="w-20"><SelectValue placeholder="HH" /></SelectTrigger>
                            <SelectContent>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                          <span className="text-lg font-bold">:</span>
                          <Select value={m || ""} onValueChange={(val) => field.onChange(`${h || "00"}:${val}`)}>
                            <SelectTrigger className="w-20"><SelectValue placeholder="MM" /></SelectTrigger>
                            <SelectContent>{Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="exit_date">Horário de Saída</Label>
              <Controller
                name="exit_date"
                control={control}
                render={({ field }) => {
                  const [h, m] = (field.value || "").split(":");
                  return (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          disabled={isCompleted}
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          <Clock className="mr-2 h-4 w-4" />
                          {field.value || <span>Selecione</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-3 pointer-events-auto" align="start">
                        <div className="flex items-center gap-2">
                          <Select value={h || ""} onValueChange={(val) => field.onChange(`${val}:${m || "00"}`)}>
                            <SelectTrigger className="w-20"><SelectValue placeholder="HH" /></SelectTrigger>
                            <SelectContent>{Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                          <span className="text-lg font-bold">:</span>
                          <Select value={m || ""} onValueChange={(val) => field.onChange(`${h || "00"}:${val}`)}>
                            <SelectTrigger className="w-20"><SelectValue placeholder="MM" /></SelectTrigger>
                            <SelectContent>{Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </PopoverContent>
                    </Popover>
                  );
                }}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="flex-1">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {service ? "Salvar" : "Registrar"}
          </Button>
        </div>
      </form>

      {createClient && (
        <ClientDialog
          open={showClientDialog}
          onOpenChange={setShowClientDialog}
          onSubmit={handleClientSubmit}
          isSubmitting={isCreatingClient}
        />
      )}
    </>
  );
}
