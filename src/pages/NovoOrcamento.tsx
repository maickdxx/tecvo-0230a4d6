import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { QuoteForm } from "@/components/services/QuoteForm";
import { useClients } from "@/hooks/useClients";
import { useServices, type ServiceFormData } from "@/hooks/useServices";
import { useSubscription } from "@/hooks/useSubscription";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ServiceItemLocal } from "@/components/services/ServiceCatalogSelector";
import { type ServiceEquipmentLocal } from "@/hooks/useServiceEquipment";
import { UpgradeModal } from "@/components/subscription";
import { useState } from "react";

export default function NovoOrcamento() {
  const navigate = useNavigate();
  const { clients, create: createClient, isCreating: isCreatingClient } = useClients();
  const { create, isCreating } = useServices({ documentType: "quote" });
  const { canCreateService, servicesUsed, refetch } = useSubscription();
  const { organization } = useOrganization();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (data: ServiceFormData, items?: ServiceItemLocal[], equipmentList?: ServiceEquipmentLocal[]) => {
    if (!canCreateService) {
      setShowUpgradeModal(true);
      return;
    }

    try {
      const newService = await create({ ...data, document_type: "quote" });
      refetch();

      // Save items to service_items table
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
      toast({
        title: "Orçamento criado",
        description: `Orçamento #${newService.quote_number} criado. Pronto para o próximo.`,
      });

      setFormKey(prev => prev + 1);
    } catch (error) {
      if ((error as Error).message === "LIMIT_REACHED") {
        setShowUpgradeModal(true);
      } else {
        toast({
          variant: "destructive",
          title: "Erro ao criar orçamento",
          description: (error as Error).message,
        });
      }
    }
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/orcamentos")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <div>
          <h1 className="text-2xl font-bold text-foreground">Novo Orçamento</h1>
          <p className="text-muted-foreground">
            Preencha os dados para criar um novo orçamento
          </p>
        </div>

        <QuoteForm
          key={formKey}
          clients={clients}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/orcamentos")}
          isSubmitting={isCreating}
          createClient={createClient}
          isCreatingClient={isCreatingClient}
        />
      </div>

      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        servicesUsed={servicesUsed}
      />
    </AppLayout>
  );
}
