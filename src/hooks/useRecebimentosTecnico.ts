import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";

export interface RecebimentoTecnico {
  id: string;
  service_id: string;
  amount: number;
  payment_method: string | null;
  completed_date: string | null;
  scheduled_date: string | null;
  client_name: string;
  quote_number: number;
  technician_id: string | null;
  technician_name: string | null;
  service_status: string;
  value: number | null;
  /** Source of the payment data: 'service_payments' (split) or 'services' (legacy fallback) */
  source: "service_payments" | "services";
}

export interface TechnicianSummary {
  technician_id: string;
  technician_name: string;
  total: number;
  byMethod: Record<string, number>;
}

export interface RecebimentosFilters {
  technicianId?: string;
  dateFrom?: string;
  dateTo?: string;
  paymentMethod?: string;
}

export function useRecebimentosTecnico(filters: RecebimentosFilters = {}) {
  const { organizationId } = useAuth();
  const { isDemoMode } = useDemoMode();
  const queryClient = useQueryClient();

  // Fetch all field workers for the technician filter dropdown
  const fieldWorkersQuery = useQuery({
    queryKey: ["field-workers-list", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, full_name, field_worker")
        .eq("organization_id", organizationId)
        .eq("field_worker", true as any);
      if (error) throw error;
      return (data ?? []).map((p) => ({
        id: p.user_id,
        name: (p as any).full_name ?? "Sem nome",
      }));
    },
    enabled: !!organizationId,
    staleTime: 1000 * 60 * 5,
  });

  const query = useQuery({
    queryKey: ["recebimentos-tecnico", organizationId, filters],
    queryFn: async () => {
      if (!organizationId) return [];

      // Step 1: Fetch completed services with filters
      let servicesQuery = supabase
        .from("services")
        .select("id, quote_number, assigned_to, client_id, scheduled_date, status, is_demo_data, completed_date, value, payment_method")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .in("status", ["completed"] as any);

      if (filters.technicianId) {
        servicesQuery = servicesQuery.eq("assigned_to", filters.technicianId);
      }
      if (filters.dateFrom) {
        servicesQuery = servicesQuery.gte("completed_date", filters.dateFrom);
      }
      if (filters.dateTo) {
        servicesQuery = servicesQuery.lte("completed_date", filters.dateTo + "T23:59:59");
      }

      const { data: services, error: servicesError } = await servicesQuery
        .order("completed_date", { ascending: false })
        .range(0, 999);
      if (servicesError) throw servicesError;

      // Filter demo data
      const filteredServices = isDemoMode
        ? services ?? []
        : (services ?? []).filter((s) => !s.is_demo_data);

      if (filteredServices.length === 0) return [];

      // Step 2: Fetch service_payments for these services (primary source)
      const serviceIds = filteredServices.map((s) => s.id);
      const { data: allServicePayments } = await supabase
        .from("service_payments")
        .select("*")
        .in("service_id", serviceIds);

      // Group service_payments by service_id
      const spByService = new Map<string, typeof allServicePayments>();
      for (const sp of allServicePayments ?? []) {
        const arr = spByService.get(sp.service_id) || [];
        arr.push(sp);
        spByService.set(sp.service_id, arr);
      }

      // Step 3: Fetch clients and technician profiles
      const clientIds = [...new Set(filteredServices.map((s) => s.client_id).filter(Boolean))];
      const techIds = [...new Set(filteredServices.map((s) => s.assigned_to).filter(Boolean))] as string[];

      const [clientsRes, profilesRes] = await Promise.all([
        clientIds.length > 0
          ? supabase.from("clients").select("id, name").in("id", clientIds)
          : { data: [], error: null },
        techIds.length > 0
          ? supabase.from("profiles").select("user_id, full_name").in("user_id", techIds)
          : { data: [], error: null },
      ]);

      const clientMap = new Map((clientsRes.data ?? []).map((c) => [c.id, c.name]));
      const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.user_id, p.full_name]));

      // Step 4: Build results — prefer service_payments (split), fallback to services
      const result: RecebimentoTecnico[] = [];

      for (const s of filteredServices) {
        const svcPayments = spByService.get(s.id);

        if (svcPayments && svcPayments.length > 0) {
          // Use service_payments as source (one row per parcela)
          for (const sp of svcPayments) {
            // Apply payment method filter if specified
            if (filters.paymentMethod && sp.payment_method !== filters.paymentMethod) continue;

            result.push({
              id: sp.id,
              service_id: s.id,
              amount: sp.amount,
              payment_method: sp.payment_method,
              completed_date: s.completed_date,
              scheduled_date: s.scheduled_date,
              client_name: clientMap.get(s.client_id) ?? "—",
              quote_number: s.quote_number,
              technician_id: s.assigned_to,
              technician_name: s.assigned_to ? (profileMap.get(s.assigned_to) ?? "Sem nome") : null,
              service_status: s.status,
              value: s.value,
              source: "service_payments",
            });
          }
        } else {
          // Fallback: use services table (legacy services without split)
          if (filters.paymentMethod && s.payment_method !== filters.paymentMethod) continue;

          result.push({
            id: s.id,
            service_id: s.id,
            amount: s.value ?? 0,
            payment_method: s.payment_method,
            completed_date: s.completed_date,
            scheduled_date: s.scheduled_date,
            client_name: clientMap.get(s.client_id) ?? "—",
            quote_number: s.quote_number,
            technician_id: s.assigned_to,
            technician_name: s.assigned_to ? (profileMap.get(s.assigned_to) ?? "Sem nome") : null,
            service_status: s.status,
            value: s.value,
            source: "services",
          });
        }
      }

      return result;
    },
    enabled: !!organizationId,
  });

  // Compute per-technician summaries
  const summaries: TechnicianSummary[] = (() => {
    const items = query.data ?? [];
    const map = new Map<string, TechnicianSummary>();
    for (const item of items) {
      const key = item.technician_id ?? "__unassigned";
      if (!map.has(key)) {
        map.set(key, {
          technician_id: key,
          technician_name: item.technician_name ?? "Não atribuído",
          total: 0,
          byMethod: {},
        });
      }
      const s = map.get(key)!;
      s.total += item.amount;
      const method = item.payment_method ?? "sem_forma";
      s.byMethod[method] = (s.byMethod[method] ?? 0) + item.amount;
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  })();

  const technicians = fieldWorkersQuery.data ?? [];

  return {
    recebimentos: query.data ?? [],
    summaries,
    technicians,
    isLoading: query.isLoading,
  };
}
