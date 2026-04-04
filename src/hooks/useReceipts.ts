import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Receipt {
  id: string;
  organization_id: string;
  service_id: string;
  client_name: string;
  client_phone: string | null;
  quote_number: string | null;
  service_description: string | null;
  service_value: number;
  payments_snapshot: any[];
  message: string;
  sent_via: string | null;
  sent_at: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export function useReceipts() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const { data: receipts = [], isLoading } = useQuery({
    queryKey: ["receipts", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("service_receipts")
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Receipt[];
    },
    enabled: !!organizationId,
  });

  const updateReceipt = useMutation({
    mutationFn: async ({ id, message, status }: { id: string; message?: string; status?: string }) => {
      const updates: any = {};
      if (message !== undefined) updates.message = message;
      if (status !== undefined) updates.status = status;
      const { error } = await supabase
        .from("service_receipts")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["receipts"] }),
  });

  const createReceipt = useMutation({
    mutationFn: async (receipt: Omit<Receipt, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("service_receipts")
        .insert(receipt as any)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["receipts"] }),
  });

  return { receipts, isLoading, updateReceipt, createReceipt };
}
