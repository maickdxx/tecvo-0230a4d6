import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Wrench, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServiceForm } from "@/components/services/ServiceForm";
import { useClients } from "@/hooks/useClients";
import { useServices, type ServiceFormData } from "@/hooks/useServices";
import { useSubscription } from "@/hooks/useSubscription";
import { useOrganization } from "@/hooks/useOrganization";
import { useGuidedOnboarding } from "@/hooks/useGuidedOnboarding";
import { useOrgTimezone } from "@/hooks/useOrgTimezone";
import { getTodayInTz, buildTimestamp } from "@/lib/timezone";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { type ServiceItemLocal } from "@/components/services/ServiceCatalogSelector";
import { type ServiceEquipmentLocal } from "@/hooks/useServiceEquipment";
import { UpgradeModal } from "@/components/subscription";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useActivationStep } from "@/hooks/useActivationStep";

function getSmartScheduledDate(tz: string): string {
  const todayStr = getTodayInTz(tz);
  const now = new Date();
  const currentHour = parseInt(
    now.toLocaleTimeString("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }),
    10
  );

  // If before 15:00, schedule today at 09:00; otherwise tomorrow at 09:00
  if (currentHour < 15) {
    return buildTimestamp(todayStr, "09:00:00", tz);
  }

  // Tomorrow
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toLocaleDateString("en-CA", { timeZone: tz });
  return buildTimestamp(tomorrowStr, "09:00:00", tz);
}

function QuickServiceForm({
  clients,
  onSubmit,
  isSubmitting,
}: {
  clients: { id: string; name: string }[];
  onSubmit: (data: ServiceFormData) => Promise<void>;
  isSubmitting: boolean;
}) {
  const tz = useOrgTimezone();
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [serviceType, setServiceType] = useState("cleaning");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");

  const SERVICE_TYPES = [
    { value: "cleaning", label: "Limpeza" },
    { value: "installation", label: "Instalação" },
    { value: "maintenance", label: "Manutenção" },
    { value: "repair", label: "Reparo" },
    { value: "other", label: "Outros" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      toast({ variant: "destructive", title: "Selecione um cliente" });
      return;
    }
    const numValue = parseFloat(value);
    if (!value || isNaN(numValue) || numValue <= 0) {
      toast({ variant: "destructive", title: "Informe o valor do serviço" });
      return;
    }
    onSubmit({
      client_id: clientId,
      service_type: serviceType,
      value: numValue,
      description: description || undefined,
      status: "scheduled",
      scheduled_date: getSmartScheduledDate(tz),
      document_type: "service_order",
    } as ServiceFormData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-0 shadow-none">
        <CardContent className="p-0 space-y-6">
          <div className="text-center mb-2">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Wrench className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Vamos cadastrar seu primeiro serviço
            </h2>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              Comece com o básico. Você pode ajustar os detalhes depois.
            </p>
          </div>

          <div className="space-y-4 max-w-md mx-auto">
            <div>
              <Label>Cliente</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Tipo de Serviço</Label>
              <Select value={serviceType} onValueChange={setServiceType}>
                <SelectTrigger className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Ex: 350,00"
                className="text-base h-12"
                autoFocus
              />
            </div>

            <div>
              <Label>Descrição <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Limpeza de split 12000 BTUs"
                className="text-base h-12"
              />
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[240px] gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isSubmitting ? "Salvando..." : "Salvar e continuar"}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export default function NovaOrdemServico() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clients, create: createClient, isCreating: isCreatingClient } = useClients();
  const { create, isCreating } = useServices({ documentType: "service_order" });
  const { canCreateService, servicesUsed, refetch } = useSubscription();
  const { organization } = useOrganization();
  const { showGuide, steps } = useGuidedOnboarding();
  const queryClient = useQueryClient();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);

  const isActivationMode = showGuide && !steps[1]?.completed;
  const fromChecklist = searchParams.get("from") === "checklist";
  const useQuickForm = isActivationMode || fromChecklist;

  // Filter out demo clients for quick form
  const realClients = (clients || []).filter((c: any) => !c.is_demo_data && !c.deleted_at);

  const handleQuickSubmit = async (data: ServiceFormData) => {
    if (!canCreateService) {
      setShowUpgradeModal(true);
      return;
    }
    try {
      await create({ ...data, document_type: "service_order" });
      refetch();
      await queryClient.invalidateQueries({ queryKey: ["guided-onboarding"] });
      setShowSuccess(true);
      setTimeout(() => {
        navigate("/agenda?from=checklist");
      }, 1500);
    } catch (error) {
      if ((error as Error).message === "LIMIT_REACHED") {
        setShowUpgradeModal(true);
      } else {
        toast({ variant: "destructive", title: "Erro ao criar serviço", description: (error as Error).message });
      }
    }
  };

  const handleFullSubmit = async (data: ServiceFormData, items?: ServiceItemLocal[], equipmentList?: ServiceEquipmentLocal[]) => {
    if (!canCreateService) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      const newService = await create({ ...data, document_type: "service_order" });
      refetch();

      if (items && items.length > 0 && organization?.id) {
        await supabase
          .from("service_items")
          .insert(items.map(item => ({
            service_id: newService.id,
            organization_id: organization.id,
            name: item.name,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            discount: item.discount,
            discount_type: item.discount_type,
            catalog_service_id: item.catalog_service_id,
            is_non_standard: item.is_non_standard,
            category: item.category,
            estimated_duration: item.estimated_duration,
            standard_checklist: item.standard_checklist,
          })));
      }

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
      toast({
        title: "OS criada",
        description: `OS #${newService.quote_number} criada com sucesso.`,
      });
      navigate("/ordens-servico");
    } catch (error) {
      if ((error as Error).message === "LIMIT_REACHED") {
        setShowUpgradeModal(true);
      } else {
        toast({ variant: "destructive", title: "Erro ao criar OS", description: (error as Error).message });
      }
    }
  };

  if (showSuccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-in fade-in duration-300">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h2 className="text-lg font-bold text-foreground">Serviço criado com sucesso!</h2>
            <p className="text-sm text-muted-foreground">
              Agora vamos colocar esse atendimento na agenda.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (useQuickForm) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-8">
          <QuickServiceForm
            clients={realClients}
            onSubmit={handleQuickSubmit}
            isSubmitting={isCreating}
          />
        </div>
        <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} servicesUsed={servicesUsed} />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/ordens-servico")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Nova Ordem de Serviço</h1>
          <p className="text-muted-foreground">Preencha os dados para criar uma nova OS</p>
        </div>

        <ServiceForm
          key={formKey}
          clients={clients}
          onSubmit={handleFullSubmit}
          onCancel={() => navigate("/ordens-servico")}
          isSubmitting={isCreating}
          createClient={createClient}
          isCreatingClient={isCreatingClient}
        />
      </div>

      <UpgradeModal open={showUpgradeModal} onOpenChange={setShowUpgradeModal} servicesUsed={servicesUsed} />
    </AppLayout>
  );
}
