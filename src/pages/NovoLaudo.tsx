import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { TechnicalReportForm } from "@/components/laudos/TechnicalReportForm";
import { useTechnicalReportMutations, type TechnicalReportFormData } from "@/hooks/useTechnicalReports";
import { useClients } from "@/hooks/useClients";

export default function NovoLaudo() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const serviceId = searchParams.get("service_id");
  const quoteServiceId = searchParams.get("quote_service_id");
  const { create, isCreating } = useTechnicalReportMutations();
  const { clients } = useClients();

  const prefillId = serviceId || quoteServiceId;
  const { data: prefillService, isLoading: prefillLoading } = useQuery({
    queryKey: ["prefill-service", prefillId],
    queryFn: async () => {
      if (!prefillId) return null;
      const { data } = await supabase
        .from("services")
        .select(`
          *,
          client:clients!client_id(name, phone, email, address, city, state, zip_code),
          assigned_profile:profiles!assigned_to(full_name)
        `)
        .eq("id", prefillId)
        .maybeSingle();
      return data;
    },
    enabled: !!prefillId,
  });

  const handleSubmit = async (data: TechnicalReportFormData) => {
    const result = await create(data);
    navigate(`/laudos/${result.id}`);
  };

  if (prefillLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold text-foreground">Novo Laudo Técnico</h1>
        </div>
      </div>

      <TechnicalReportForm
        clients={clients}
        onSubmit={handleSubmit}
        onCancel={() => navigate(-1)}
        isSubmitting={isCreating}
        defaultServiceId={serviceId}
        defaultQuoteServiceId={quoteServiceId}
        defaultClientId={prefillService?.client_id || ""}
      />
    </AppLayout>
  );
}
