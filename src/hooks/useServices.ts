import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useOrganization } from "./useOrganization";
import { toast } from "./use-toast";
import { useDemoMode } from "./useDemoMode";
import type { Client } from "./useClients";
import { format } from "date-fns";
import { getTodayInTz, buildTimestamp, toTimestampWithTz, DEFAULT_TIMEZONE } from "@/lib/timezone";
import { trackFBCustomEvent } from "@/lib/fbPixel";
export type ServiceType = string;

const serviceTypeSlugToEnum: Record<string, string> = {
  // Portuguese slugs (frontend)
  instalacao: "installation",
  manutencao: "maintenance",
  limpeza: "cleaning",
  contratos: "maintenance_contract",
  reparo: "repair",
  pmoc: "pmoc",
  visita: "visit",
  orcamento: "quote",
  desinstalacao: "uninstallation",
  outros: "other",
  // English slugs / DB enum values (for compatibility)
  installation: "installation",
  maintenance: "maintenance",
  cleaning: "cleaning",
  repair: "repair",
  maintenance_contract: "maintenance_contract",
  visit: "visit",
  quote: "quote",
  uninstallation: "uninstallation",
  other: "other",
};
export type ServiceStatus = "scheduled" | "in_progress" | "completed" | "cancelled";

export type DocumentType = "quote" | "service_order";

export interface Service {
  id: string;
  organization_id: string;
  client_id: string;
  service_type: ServiceType;
  status: ServiceStatus;
  document_type: DocumentType;
  value: number | null;
  scheduled_date: string | null;
  completed_date: string | null;
  description: string | null;
  notes: string | null;
  internal_notes?: string | null;
  payment_conditions: string | null;
  quote_validity_days: number | null;
  quote_number: number | null;
  assigned_to: string | null;
  service_zip_code: string | null;
  service_street: string | null;
  service_number: string | null;
  service_complement: string | null;
  service_neighborhood: string | null;
  service_city: string | null;
  service_state: string | null;
  // OS fields
  equipment_type: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  solution: string | null;
  payment_method: string | null;
  payment_due_date: string | null;
  payment_notes: string | null;
  entry_date: string | null;
  exit_date: string | null;
  estimated_duration?: string | null;
  created_at: string;
  updated_at: string;
  client?: Client;
  assigned_profile?: { full_name: string | null } | null;
}

export interface ServiceFormData {
  client_id: string;
  service_type?: ServiceType;
  status?: ServiceStatus;
  document_type?: DocumentType;
  value?: number;
  scheduled_date?: string;
  completed_date?: string;
  description?: string;
  notes?: string;
  internal_notes?: string;
  assigned_to?: string;
  service_zip_code?: string;
  service_street?: string;
  service_number?: string;
  service_complement?: string;
  service_neighborhood?: string;
  service_city?: string;
  service_state?: string;
  // OS fields
  equipment_type?: string;
  equipment_brand?: string;
  equipment_model?: string;
  solution?: string;
  payment_method?: string;
  payment_due_date?: string;
  payment_notes?: string;
  entry_date?: string;
  exit_date?: string;
}

export interface UseServicesOptions {
  clientId?: string;
  documentType?: DocumentType;
  assignedTo?: string;
  /** When true, skips the data query (use when you only need mutations) */
  skipQuery?: boolean;
}

/** @deprecated Use useServiceTypes().typeLabels instead for dynamic labels */
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  // Portuguese slugs
  instalacao: "Instalação",
  limpeza: "Limpeza",
  manutencao: "Manutenção",
  contratos: "Contratos",
  reparo: "Reparo",
  pmoc: "PMOC",
  visita: "Visita Técnica",
  orcamento: "Orçamento",
  desinstalacao: "Desinstalação",
  outros: "Outros",
  // English slugs / DB enum values
  installation: "Instalação",
  cleaning: "Limpeza",
  maintenance: "Manutenção",
  repair: "Reparo",
  maintenance_contract: "Contratos",
  pmoc_db: "PMOC", // if needed
  visit: "Visita Técnica",
  quote: "Orçamento",
  uninstallation: "Desinstalação",
  other: "Outros",
};

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  scheduled: "Agendado",
  in_progress: "Em Andamento",
  completed: "Concluído",
  cancelled: "Cancelado",
};

/**
 * Converts time-only "HH:mm" strings to full ISO timestamps by combining
 * with a reference date. Already-complete timestamps pass through unchanged.
 */
function toTimestamp(
  timeStr: string | undefined | null,
  dateStr: string | undefined | null,
  tz: string = DEFAULT_TIMEZONE
): string | null {
  return toTimestampWithTz(timeStr, dateStr, tz);
}

/**
 * Ensures a scheduled_date value is a proper timestamptz-safe string.
 * Date-only strings ("2026-03-16") are converted to noon in the org's
 * timezone so Postgres doesn't shift them to the previous day.
 * Full ISO timestamps pass through unchanged.
 */
function ensureDateTimestamp(
  dateStr: string | undefined | null,
  tz: string = DEFAULT_TIMEZONE
): string | null {
  if (!dateStr) return null;
  // Already a full timestamp (contains "T") — pass through
  if (dateStr.includes("T")) return dateStr;
  // Date-only: attach noon + org offset to avoid UTC midnight shift
  return buildTimestamp(dateStr, "12:00:00", tz);
}
/**
 * Helper: creates service_payments + transactions for each payment parcela (split support).
 * - service_payments = operational record (gross, what the technician registered)
 * - transactions = financial record (net after fees, pending confirmation)
 */
async function createSplitPaymentTransactions(params: {
  serviceId: string;
  organizationId: string;
  clientId: string;
  serviceType: string;
  clientName: string;
  serviceValue: number;
  paymentMethod?: string | null;
  dueDate?: string | null;
  payments?: Array<{ payment_method: string; amount: number; financial_account_id: string }>;
}) {
  const { serviceId, organizationId, clientId, serviceType, clientName, serviceValue, paymentMethod, dueDate, payments } = params;

  if (serviceValue <= 0) return;

  // Get user for registered_by
  const { data: { user } } = await supabase.auth.getUser();
  const userId = user?.id ?? null;

  // Resolve description
  const { data: serviceTypeData } = await supabase
    .from("service_types")
    .select("name")
    .eq("slug", serviceType)
    .single();
  const typeName = serviceTypeData?.name || SERVICE_TYPE_LABELS[serviceType as ServiceType] || serviceType;
  const description = `${typeName} - ${clientName}`;
  const todayStr = getTodayInTz(DEFAULT_TIMEZONE);

  // Build parcelas: use payments[] if provided, otherwise single payment from paymentMethod
  const parcelas = (payments && payments.length > 0)
    ? payments
    : (paymentMethod
      ? [{ payment_method: paymentMethod, amount: serviceValue, financial_account_id: "" }]
      : [{ payment_method: "", amount: serviceValue, financial_account_id: "" }]);

  // Fetch all unique payment method details in one batch
  const uniqueSlugs = [...new Set(parcelas.map(p => p.payment_method).filter(Boolean))];
  const pmMap = new Map<string, { fee_type: string; fee_value: number; name: string; default_financial_account_id: string | null }>();

  if (uniqueSlugs.length > 0) {
    const { data: pms } = await supabase
      .from("payment_methods")
      .select("slug, fee_type, fee_value, name, default_financial_account_id")
      .in("slug", uniqueSlugs)
      .eq("organization_id", organizationId);
    for (const pm of pms ?? []) {
      pmMap.set(pm.slug, pm);
    }
  }

  // Insert service_payments rows (operational records)
  const servicePaymentRows = parcelas.map(p => ({
    organization_id: organizationId,
    service_id: serviceId,
    payment_method: p.payment_method || "other",
    amount: p.amount,
    financial_account_id: p.financial_account_id || pmMap.get(p.payment_method)?.default_financial_account_id || null,
    registered_by: userId,
    is_confirmed: false,
  }));

  // Filter out rows with no valid financial_account_id (set it from payment method default)
  for (const row of servicePaymentRows) {
    if (!row.financial_account_id) {
      const pm = pmMap.get(row.payment_method);
      if (pm?.default_financial_account_id) {
        row.financial_account_id = pm.default_financial_account_id;
      }
    }
  }

  if (servicePaymentRows.length > 0) {
    await supabase.from("service_payments").insert(servicePaymentRows as any);
  }

  // Create income transactions (one per parcela, net after fees)
  for (const parcela of parcelas) {
    const pm = pmMap.get(parcela.payment_method);
    let netAmount = parcela.amount;
    let feeAmount = 0;

    if (pm && pm.fee_value && pm.fee_value > 0) {
      feeAmount = pm.fee_type === "percentage"
        ? parcela.amount * (pm.fee_value / 100)
        : pm.fee_value;
      feeAmount = Math.round(feeAmount * 100) / 100;
      netAmount = parcela.amount - feeAmount;
    }

    const accountId = parcela.financial_account_id || pm?.default_financial_account_id || null;

    if (netAmount > 0) {
      await supabase.from("transactions").insert({
        organization_id: organizationId,
        service_id: serviceId,
        client_id: clientId,
        type: "income" as any,
        category: "service",
        amount: netAmount,
        description,
        date: todayStr,
        due_date: dueDate,
        status: "pending",
        payment_date: null,
        payment_method: parcela.payment_method || null,
        financial_account_id: accountId,
      });
    }

    // Create fee expense transaction per parcela if fee > 0
    if (feeAmount > 0) {
      const pmName = pm?.name || parcela.payment_method;
      await supabase.from("transactions").insert({
        organization_id: organizationId,
        service_id: serviceId,
        type: "expense" as any,
        category: "taxa_pagamento",
        amount: feeAmount,
        description: `Taxa ${pmName} - ${clientName}`,
        date: todayStr,
        status: "paid",
        payment_date: todayStr,
        financial_account_id: null,
      });
    }
  }
}

export function useServices(options?: UseServicesOptions | string) {
  // Support legacy string parameter (clientId) for backwards compatibility
  const clientId = typeof options === "string" ? options : options?.clientId;
  const documentType = typeof options === "string" ? undefined : options?.documentType;
  const assignedTo = typeof options === "string" ? undefined : options?.assignedTo;
  const skipQuery = typeof options === "string" ? false : options?.skipQuery ?? false;
  
  const { organizationId } = useAuth();
  const { organization } = useOrganization();
  const orgTz = organization?.timezone || DEFAULT_TIMEZONE;
  const { isDemoMode } = useDemoMode();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["services", organizationId, clientId, documentType, assignedTo, isDemoMode],
    queryFn: async () => {
      if (!organizationId) return [];

      let queryBuilder = supabase
        .from("services")
        .select("*, client:clients(*)")
        .is("deleted_at", null)
        .order("created_at", { ascending: false });

      // Filter demo data based on demo mode
      if (!isDemoMode) {
        queryBuilder = queryBuilder.eq("is_demo_data", false);
      }

      if (clientId) {
        queryBuilder = queryBuilder.eq("client_id", clientId);
      }

      if (documentType) {
        queryBuilder = queryBuilder.eq("document_type", documentType);
      }

      if (assignedTo) {
        queryBuilder = queryBuilder.eq("assigned_to", assignedTo);
      }

      const { data, error } = await queryBuilder.range(0, 999);
      if (error) throw error;

      // Fetch assigned technician names
      const assignedIds = [...new Set((data || []).map(s => s.assigned_to).filter(Boolean))] as string[];
      let profilesMap: Record<string, string> = {};
      
      if (assignedIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", assignedIds);
        
        if (profiles) {
          profilesMap = Object.fromEntries(
            profiles.map(p => [p.user_id, p.full_name || ""])
          );
        }
      }

      return (data || []).map(s => ({
        ...s,
        assigned_profile: s.assigned_to && profilesMap[s.assigned_to]
          ? { full_name: profilesMap[s.assigned_to] }
          : null,
      })) as Service[];
    },
    enabled: !!organizationId && !skipQuery,
  });

  const createMutation = useMutation({
    mutationFn: async (data: ServiceFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      // Check subscription limit based on active plan
      const currentMonth = format(new Date(), "yyyy-MM");
      
      // Get organization plan
      const { data: org } = await supabase
        .from("organizations")
        .select("plan, plan_expires_at")
        .eq("id", organizationId)
        .single();

      const rawPlan = org?.plan || "free";
      const isPlanActive = !org?.plan_expires_at || new Date(org.plan_expires_at) > new Date();
      const effectivePlan = (rawPlan !== "free" && !isPlanActive) ? "free" : rawPlan;

      const planLimits: Record<string, number> = { free: 10, starter: 15, essential: 50 };
      const limit = planLimits[effectivePlan];

      // Pro plan (or any plan without a defined limit) = unlimited
      if (limit !== undefined) {
        const { data: usage } = await supabase
          .from("organization_usage")
          .select("services_created")
          .eq("organization_id", organizationId)
          .eq("month_year", currentMonth)
          .single();

        const servicesCreated = usage?.services_created || 0;
        if (servicesCreated >= limit) {
          throw new Error("LIMIT_REACHED");
        }
      }

      const sanitizedData = {
        ...data,
        assigned_to: data.assigned_to || null,
        // Convert date-only strings to proper timestamptz with org offset
        scheduled_date: ensureDateTimestamp(data.scheduled_date, orgTz),
        payment_due_date: ensureDateTimestamp(data.payment_due_date, orgTz),
        entry_date: toTimestamp(data.entry_date, data.scheduled_date, orgTz) || null,
        exit_date: toTimestamp(data.exit_date, data.scheduled_date, orgTz) || null,
        completed_date: data.completed_date ? data.completed_date : null,
        service_type: data.service_type ?? "outros",
        organization_id: organizationId,
      };

      console.log("[CREATE-OS] sanitizedData:", JSON.stringify(sanitizedData, null, 2));
      const { data: service, error } = await supabase
        .from("services")
        .insert(sanitizedData as any)
        .select("*, client:clients(*)")
        .single();

      if (error) {
        console.error("[CREATE-OS] Supabase error:", error.message, error.details, error.hint, error.code);
        throw error;
      }

      // Track activity event
      try {
        await supabase.from("user_activity_events").insert({
          user_id: (await supabase.auth.getUser()).data.user?.id,
          organization_id: organizationId,
          event_type: "service_created",
        });
      } catch { /* silent */ }

      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["subscription"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      trackFBCustomEvent("CreateOS");
      toast({
        title: "Serviço registrado",
        description: "O serviço foi adicionado com sucesso",
      });
    },
    onError: (error) => {
      if (error.message === "LIMIT_REACHED") {
        // Don't show toast here, let the component handle the upgrade modal
        return;
      }
      toast({
        variant: "destructive",
        title: "Erro ao registrar",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<ServiceFormData> }) => {
      // Buscar o serviço atual para saber o status anterior
      const { data: currentService, error: fetchError } = await supabase
        .from("services")
        .select("*, client:clients(*)")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const oldStatus = currentService.status;
      const newStatus = data.status || oldStatus;
      const updateData: Record<string, unknown> = { 
        ...data,
        assigned_to: data.assigned_to === "" ? null : data.assigned_to,
        scheduled_date: data.scheduled_date === "" ? null : ensureDateTimestamp(data.scheduled_date, orgTz),
        payment_due_date: data.payment_due_date === "" ? null : ensureDateTimestamp(data.payment_due_date, orgTz),
        entry_date: data.entry_date === "" ? null : toTimestamp(data.entry_date, data.scheduled_date || currentService.scheduled_date, orgTz),
        exit_date: data.exit_date === "" ? null : toTimestamp(data.exit_date, data.scheduled_date || currentService.scheduled_date, orgTz),
        completed_date: data.completed_date === "" ? null : data.completed_date,
        ...(data.service_type ? { service_type: data.service_type } : {}),
      };
      
      // Se status mudou para completed, definir completed_date
      if (data.status === "completed" && !data.completed_date) {
        updateData.completed_date = new Date().toISOString();
      }

      const { data: service, error } = await supabase
        .from("services")
        .update(updateData)
        .eq("id", id)
        .select("*, client:clients(*)")
        .single();

      if (error) throw error;

      // Sync transaction with OS changes
      const serviceValue = data.value !== undefined ? data.value : currentService.value;
      const newDueDate = data.payment_due_date !== undefined ? data.payment_due_date : currentService.payment_due_date;
      
      // Fetch ALL existing transactions linked to this service (can be multiple with split)
      const { data: existingTransactions } = await supabase
        .from("transactions")
        .select("id, status, type")
        .eq("service_id", id);

      const pendingIncomes = (existingTransactions ?? []).filter(t => t.status === "pending" && t.type === "income");
      const pendingExpenses = (existingTransactions ?? []).filter(t => t.status === "pending" && t.type === "expense");

      // Handle status changes
      if (newStatus === "cancelled") {
        // Only delete PENDING transactions; confirmed (paid) ones remain
        for (const t of [...pendingIncomes, ...pendingExpenses]) {
          await supabase.from("transactions").delete().eq("id", t.id);
        }
      } else if (newStatus === "completed" && oldStatus !== "completed") {
        // Delete any stale pending transactions before creating new ones
        for (const t of [...pendingIncomes, ...pendingExpenses]) {
          await supabase.from("transactions").delete().eq("id", t.id);
        }

        // Create transactions per parcela using the helper
        await createSplitPaymentTransactions({
          serviceId: id,
          organizationId: service.organization_id,
          clientId: service.client_id,
          serviceType: service.service_type,
          clientName: service.client?.name || "Cliente",
          serviceValue: serviceValue || 0,
          paymentMethod: data.payment_method || currentService.payment_method,
          dueDate: newDueDate,
          payments: undefined, // updateMutation doesn't receive payments array
        });
      } else if (oldStatus === "completed") {
        // Transitioning FROM completed — only delete pending, keep paid
        for (const t of [...pendingIncomes, ...pendingExpenses]) {
          await supabase.from("transactions").delete().eq("id", t.id);
        }
      } else if (pendingIncomes.length > 0) {
        // Update value/due_date on pending transactions if they changed
        const updates: Record<string, unknown> = {};
        if (data.value !== undefined && data.value !== currentService.value) {
          updates.amount = data.value;
        }
        if (data.payment_due_date !== undefined && data.payment_due_date !== currentService.payment_due_date) {
          updates.due_date = data.payment_due_date || null;
        }
        if (Object.keys(updates).length > 0) {
          // If value changed and there are multiple split transactions, delete all and recreate
          if (data.value !== undefined && data.value !== currentService.value && pendingIncomes.length > 1) {
            for (const t of [...pendingIncomes, ...pendingExpenses]) {
              await supabase.from("transactions").delete().eq("id", t.id);
            }
            // Recreate with new value as single transaction
            await createSplitPaymentTransactions({
              serviceId: id,
              organizationId: service.organization_id,
              clientId: service.client_id,
              serviceType: service.service_type,
              clientName: service.client?.name || "Cliente",
              serviceValue: data.value || 0,
              paymentMethod: data.payment_method || currentService.payment_method,
              dueDate: newDueDate,
              payments: undefined,
            });
          } else {
            // Simple update for single transaction
            for (const t of pendingIncomes) {
              await supabase.from("transactions").update(updates).eq("id", t.id);
            }
          }
        }
      }

      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["service-payments"] });
      queryClient.invalidateQueries({ queryKey: ["recebimentos-tecnico"] });
      toast({
        title: "Serviço atualizado",
        description: "Os dados foram salvos com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("services")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      toast({
        title: "Serviço movido para a lixeira",
        description: "O serviço ficará na lixeira por 30 dias",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir",
        description: error.message,
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, paymentMethod, payments }: { id: string; status: ServiceStatus; paymentMethod?: string; payments?: Array<{ payment_method: string; amount: number; financial_account_id: string }> }) => {
      // Buscar o serviço atual para saber o status anterior e dados do cliente
      const { data: currentService, error: fetchError } = await supabase
        .from("services")
        .select("*, client:clients(*)")
        .eq("id", id)
        .single();

      if (fetchError) throw fetchError;

      const oldStatus = currentService.status;
      const updateData: Record<string, unknown> = { status };
      
      if (status === "completed") {
        updateData.completed_date = new Date().toISOString();
        updateData.operational_status = "completed";
        trackFBCustomEvent("FinishOS");
        if (paymentMethod) {
          updateData.payment_method = paymentMethod;
        }
      }

      const { data: service, error } = await supabase
        .from("services")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Fetch ALL existing transactions linked to this service
      const { data: existingTransactions } = await supabase
        .from("transactions")
        .select("id, status, type")
        .eq("service_id", id);

      const pendingIncomes = (existingTransactions ?? []).filter(t => t.status === "pending" && t.type === "income");
      const pendingExpenses = (existingTransactions ?? []).filter(t => t.status === "pending" && t.type === "expense");

      // === Helper: revert financial balances and clean up service_payments ===
      const revertFinancials = async (serviceId: string) => {
        const { data: svcPayments } = await supabase
          .from("service_payments")
          .select("*")
          .eq("service_id", serviceId);

        if (svcPayments && svcPayments.length > 0) {
          for (const sp of svcPayments) {
            const { data: acct } = await supabase
              .from("financial_accounts")
              .select("balance")
              .eq("id", sp.financial_account_id)
              .single();
            if (acct) {
              await supabase
                .from("financial_accounts")
                .update({ balance: Number(acct.balance) - sp.amount })
                .eq("id", sp.financial_account_id);
            }
          }
          await supabase.from("service_payments").delete().eq("service_id", serviceId);
        }
      };

      // Handle status changes
      if (status === "cancelled") {
        await revertFinancials(id);
        for (const t of [...pendingIncomes, ...pendingExpenses]) {
          await supabase.from("transactions").delete().eq("id", t.id);
        }
      } else if (oldStatus === "completed" && status !== "completed") {
        await revertFinancials(id);
        for (const t of [...pendingIncomes, ...pendingExpenses]) {
          await supabase.from("transactions").delete().eq("id", t.id);
        }
      } else if (status === "completed" && oldStatus !== "completed") {
        // Delete any stale pending transactions
        for (const t of [...pendingIncomes, ...pendingExpenses]) {
          await supabase.from("transactions").delete().eq("id", t.id);
        }
        // Also clean up any stale service_payments
        await supabase.from("service_payments").delete().eq("service_id", id);

        // Create split payment transactions using the helper
        await createSplitPaymentTransactions({
          serviceId: id,
          organizationId: currentService.organization_id,
          clientId: currentService.client_id,
          serviceType: currentService.service_type,
          clientName: currentService.client?.name || "Cliente",
          serviceValue: currentService.value || 0,
          paymentMethod: paymentMethod || currentService.payment_method,
          dueDate: currentService.payment_due_date,
          payments, // ← NOW ACTUALLY USED
        });
      }

      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["financial-accounts"] });
      queryClient.invalidateQueries({ queryKey: ["service-payments"] });
      queryClient.invalidateQueries({ queryKey: ["recebimentos-tecnico"] });
      toast({
        title: "Status atualizado",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar status",
        description: error.message,
      });
    },
  });

  return {
    services: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    updateStatus: updateStatusMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
