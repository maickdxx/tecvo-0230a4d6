import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { QuoteForm } from "@/components/services/QuoteForm";
import { useClients } from "@/hooks/useClients";
import { useServices, type ServiceFormData } from "@/hooks/useServices";
import { useOrganization } from "@/hooks/useOrganization";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import type { ServiceItemLocal } from "@/components/services/ServiceCatalogSelector";
import { type ServiceEquipmentLocal } from "@/hooks/useServiceEquipment";

export default function EditarOrcamento() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, create: createClient, isCreating: isCreatingClient } = useClients();
  const { services, update, isUpdating, isLoading } = useServices({ documentType: "quote" });
  const { organization } = useOrganization();

  const service = services.find(s => s.id === id);

  const handleSubmit = async (data: ServiceFormData, items?: ServiceItemLocal[], equipmentList?: ServiceEquipmentLocal[]) => {
    if (!id) return;

    try {
      await update({ id, data: { ...data, document_type: "quote" } });

      // Delete existing items and insert new ones
      if (organization?.id) {
        await supabase
          .from("service_items")
          .delete()
          .eq("service_id", id);

        if (items && items.length > 0) {
          await supabase
            .from("service_items")
            .insert(items.map(item => ({
              service_id: id,
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

        // Save equipment
        await supabase
          .from("service_equipment")
          .delete()
          .eq("service_id", id);

        if (equipmentList && equipmentList.length > 0) {
          await supabase
            .from("service_equipment")
            .insert(equipmentList.map(eq => ({
              service_id: id,
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
      }
      toast({
        title: "Orçamento atualizado",
        description: "Os dados foram salvos com sucesso.",
      });

      navigate("/orcamentos");
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar orçamento",
        description: (error as Error).message,
      });
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!service) {
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
          <div className="text-center py-12">
            <p className="text-muted-foreground">Orçamento não encontrado.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

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
          <h1 className="text-2xl font-bold text-foreground">
            Editar Orçamento #{service.quote_number?.toString().padStart(4, "0")}
          </h1>
          <p className="text-muted-foreground">
            Atualize os dados do orçamento
          </p>
        </div>

        <QuoteForm
          service={service}
          clients={clients}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/orcamentos")}
          isSubmitting={isUpdating}
          createClient={createClient}
          isCreatingClient={isCreatingClient}
        />
      </div>
    </AppLayout>
  );
}
