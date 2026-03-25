import { useState, useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus } from "lucide-react";
import { ClientDialog } from "@/components/clients/ClientDialog";
import { ServiceCatalogSelector, type ServiceItemLocal } from "./ServiceCatalogSelector";
import { EquipmentEditor } from "./EquipmentEditor";
import { ClientCombobox } from "./ClientCombobox";
import { useServiceEquipment, type ServiceEquipmentLocal } from "@/hooks/useServiceEquipment";
import type { Client, ClientFormData } from "@/hooks/useClients";
import type { Service, ServiceFormData } from "@/hooks/useServices";
import { useAuth } from "@/hooks/useAuth";

const quoteSchema = z.object({
  client_id: z.string().min(1, "Selecione um cliente"),
  description: z.string().optional(),
  notes: z.string().optional(),
  value: z.coerce.number().min(0).optional(),
  quote_validity_days: z.coerce.number().min(1).optional(),
  payment_conditions: z.string().optional(),
});

type QuoteFormValues = z.infer<typeof quoteSchema>;

interface QuoteFormProps {
  service?: Service | null;
  clients: Client[];
  onSubmit: (data: ServiceFormData, items?: ServiceItemLocal[], equipmentList?: ServiceEquipmentLocal[]) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
  createClient?: (data: ClientFormData) => Promise<Client>;
  isCreatingClient?: boolean;
}

export function QuoteForm({
  service,
  clients,
  onSubmit,
  onCancel,
  isSubmitting,
  createClient,
  isCreatingClient,
}: QuoteFormProps) {
  const [showClientDialog, setShowClientDialog] = useState(false);
  const [newClientName, setNewClientName] = useState<string | undefined>();
  const [serviceItems, setServiceItems] = useState<ServiceItemLocal[]>([]);
  const { equipment, addEquipment, removeEquipment, updateEquipment } = useServiceEquipment(service?.id);
  const { organizationId } = useAuth();

  const isDataReady = !!organizationId;

  // Load existing service items when editing
  useEffect(() => {
    if (service?.id) {
      import("@/integrations/supabase/client").then(({ supabase }) => {
        supabase
          .from("service_items")
          .select("*")
          .eq("service_id", service.id)
          .order("created_at")
          .then(({ data }) => {
            if (data && data.length > 0) {
              setServiceItems(
                data.map((item) => ({
                  id: item.id,
                  name: item.name || item.description,
                  description: item.description,
                  quantity: item.quantity,
                  unit_price: item.unit_price,
                  discount: item.discount || 0,
                  discount_type:
                    (item.discount_type as "percentage" | "fixed") ||
                    "percentage",
                  catalog_service_id: item.catalog_service_id,
                  is_non_standard: item.is_non_standard,
                  category: item.category,
                  estimated_duration: item.estimated_duration,
                  standard_checklist: item.standard_checklist,
                }))
              );
            }
          });
      });
    }
  }, [service?.id]);

  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<QuoteFormValues>({
    resolver: zodResolver(quoteSchema),
    defaultValues: {
      client_id: service?.client_id ?? "",
      description: service?.description ?? "",
      notes: service?.notes ?? "",
      value: service?.value ?? undefined,
      quote_validity_days: service?.quote_validity_days ?? 7,
      payment_conditions: service?.payment_conditions ?? "",
    },
  });

  // Calculate total from items
  const calculateItemTotal = (item: ServiceItemLocal) => {
    const subtotal = item.quantity * item.unit_price;
    if (item.discount_type === "fixed") {
      return Math.max(0, subtotal - item.discount);
    }
    return subtotal - (subtotal * item.discount) / 100;
  };

  const itemsTotal = serviceItems.reduce(
    (acc, item) => acc + calculateItemTotal(item),
    0
  );

  // Update value field when items change
  useEffect(() => {
    if (serviceItems.length > 0) {
      setValue("value", itemsTotal);
    }
  }, [itemsTotal, serviceItems.length, setValue]);

  const handleFormSubmit = async (data: QuoteFormValues) => {
    const formData: ServiceFormData = {
      client_id: data.client_id,
      description: data.description,
      notes: data.notes,
      value: data.value,
      service_type: "outros",
      document_type: "quote",
    };

    // Pass quote-specific fields via the broader data object
    (formData as any).quote_validity_days = data.quote_validity_days;
    (formData as any).payment_conditions = data.payment_conditions;

    await onSubmit(formData, serviceItems.length > 0 ? serviceItems : undefined, equipment.length > 0 ? equipment : undefined);
  };

  const handleClientSubmit = async (data: ClientFormData) => {
    if (!createClient) return;
    const newClient = await createClient(data);
    setValue("client_id", newClient.id);
    setNewClientName(newClient.name);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

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
                    fallbackName={newClientName}
                  />
                )}
              />
              {createClient && (
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
              <p className="text-sm text-destructive">
                {errors.client_id.message}
              </p>
            )}
          </div>
        </div>

        {/* 2. EQUIPAMENTOS */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <EquipmentEditor
            equipment={equipment}
            onAdd={addEquipment}
            onRemove={removeEquipment}
            onUpdate={updateEquipment}
          />
        </div>

        {/* 3. ITENS DO ORÇAMENTO */}
        <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
          <ServiceCatalogSelector
            items={serviceItems}
            onItemsChange={setServiceItems}
          />
        </div>

        {/* 3. DESCRIÇÃO E OBSERVAÇÕES */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Detalhes</Label>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Serviço</Label>
            <Textarea
              id="description"
              placeholder="Descreva o serviço a ser orçado"
              rows={3}
              {...register("description")}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Condições, garantias, informações adicionais..."
              rows={3}
              {...register("notes")}
            />
          </div>
        </div>

        {/* 4. VALORES E CONDIÇÕES */}
        <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
          <Label className="text-base font-semibold">Valores e Condições</Label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="value">Valor Total (R$)</Label>
              <Input
                id="value"
                type="number"
                min="0"
                step="0.01"
                placeholder="0,00"
                {...register("value")}
              />
              {serviceItems.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Calculado automaticamente: {formatCurrency(itemsTotal)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quote_validity_days">Validade (dias)</Label>
              <Input
                id="quote_validity_days"
                type="number"
                min="1"
                placeholder="7"
                {...register("quote_validity_days")}
              />
              <p className="text-xs text-muted-foreground">
                Prazo de validade do orçamento
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment_conditions">Condições de Pagamento</Label>
            <Textarea
              id="payment_conditions"
              placeholder="Ex: 50% na aprovação, 50% na conclusão do serviço"
              rows={2}
              {...register("payment_conditions")}
            />
          </div>
        </div>

        {/* ACTIONS */}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {service ? "Salvar Alterações" : "Registrar Orçamento"}
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
