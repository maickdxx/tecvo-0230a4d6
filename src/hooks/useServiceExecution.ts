import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";
import { useOffline } from "@/contexts/OfflineContext";
import { queueOfflineOperationalStatus } from "./useOfflineActions";

export type OperationalStatus =
  | "en_route"
  | "in_attendance"
  | "waiting_client"
  | "waiting_part"
  | "warranty_return"
  | "completed"
  | "problem";

export const OPERATIONAL_STATUS_LABELS: Record<OperationalStatus, string> = {
  en_route: "A Caminho",
  in_attendance: "Em Atendimento",
  waiting_client: "Aguardando Cliente",
  waiting_part: "Aguardando Peça",
  warranty_return: "Retorno / Garantia",
  completed: "Concluído",
  problem: "Problema",
};

export type ServicePriority = "urgent" | "premium_client" | "warranty";

export const PRIORITY_LABELS: Record<ServicePriority, string> = {
  urgent: "Urgente",
  premium_client: "Cliente Premium",
  warranty: "Garantia",
};

export function useServiceExecution() {
  const { user, organizationId } = useAuth();
  const queryClient = useQueryClient();
  const { refreshPendingCount } = useOffline();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["services"] });
  };

  const startTravel = useMutation({
    mutationFn: async (serviceId: string) => {
      // Check if there is already an open service for this technician
      const { data: openServices, error: checkError } = await supabase
        .from("services")
        .select("id, quote_number")
        .eq("assigned_to", user!.id)
        .in("status", ["in_progress"])
        .neq("id", serviceId);

      if (checkError) throw checkError;
      if (openServices && openServices.length > 0) {
        throw new Error(`Você já possui um atendimento em aberto (OS #${openServices[0].quote_number}). Finalize-o antes de iniciar outro.`);
      }

      const now = new Date().toISOString();
      // Update service
      const { error } = await supabase
        .from("services")
        .update({
          operational_status: "en_route",
          travel_started_at: now,
        } as any)
        .eq("id", serviceId);
      if (error) throw error;

      // Log event
      await supabase.from("service_execution_logs" as any).insert({
        service_id: serviceId,
        organization_id: organizationId,
        user_id: user!.id,
        event_type: "travel_start",
        recorded_at: now,
      });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Deslocamento iniciado 🚗" });
    },
    onError: async (e, serviceId) => {
      const isNetworkError = !navigator.onLine || e.message?.includes("Failed to fetch") || e.message?.includes("NetworkError");
      if (isNetworkError) {
        await queueOfflineOperationalStatus({ serviceId, operationalStatus: "en_route", refreshPendingCount });
        return;
      }
      toast({ variant: "destructive", title: "Erro", description: e.message });
    },
  });

  const startAttendance = useMutation({
    mutationFn: async (serviceId: string) => {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("services")
        .update({
          operational_status: "in_attendance",
          attendance_started_at: now,
          status: "in_progress",
        } as any)
        .eq("id", serviceId);
      if (error) throw error;

      await supabase.from("service_execution_logs" as any).insert({
        service_id: serviceId,
        organization_id: organizationId,
        user_id: user!.id,
        event_type: "attendance_start",
        recorded_at: now,
      });
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Atendimento iniciado 🔧" });
    },
    onError: async (e, serviceId) => {
      const isNetworkError = !navigator.onLine || e.message?.includes("Failed to fetch") || e.message?.includes("NetworkError");
      if (isNetworkError) {
        await queueOfflineOperationalStatus({ serviceId, operationalStatus: "in_attendance", refreshPendingCount });
        return;
      }
      toast({ variant: "destructive", title: "Erro", description: e.message });
    },
  });

  const updateOperationalStatus = useMutation({
    mutationFn: async ({ serviceId, status }: { serviceId: string; status: OperationalStatus }) => {
      const { error } = await supabase
        .from("services")
        .update({ operational_status: status } as any)
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Status atualizado" });
    },
    onError: async (e, vars) => {
      const isNetworkError = !navigator.onLine || e.message?.includes("Failed to fetch") || e.message?.includes("NetworkError");
      if (isNetworkError) {
        await queueOfflineOperationalStatus({ serviceId: vars.serviceId, operationalStatus: vars.status, refreshPendingCount });
        return;
      }
      toast({ variant: "destructive", title: "Erro", description: e.message });
    },
  });

  const updatePriority = useMutation({
    mutationFn: async ({ serviceId, priority }: { serviceId: string; priority: string | null }) => {
      const { error } = await supabase
        .from("services")
        .update({ priority } as any)
        .eq("id", serviceId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Prioridade atualizada" });
    },
    onError: (e) => toast({ variant: "destructive", title: "Erro", description: e.message }),
  });

  return {
    startTravel: startTravel.mutateAsync,
    startAttendance: startAttendance.mutateAsync,
    updateOperationalStatus: updateOperationalStatus.mutateAsync,
    updatePriority: updatePriority.mutateAsync,
    isLoading: startTravel.isPending || startAttendance.isPending || updateOperationalStatus.isPending,
  };
}
