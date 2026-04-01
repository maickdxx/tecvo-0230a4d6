import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface TrashItem {
  id: string;
  name: string;
  type: "client" | "supplier" | "service" | "catalog" | "transaction" | "pmoc";
  deleted_at: string;
  table: string;
}

export function useTrash() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["trash", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const cutoff = thirtyDaysAgo.toISOString();

      const [clients, suppliers, services, catalog, transactions, pmocContracts] = await Promise.all([
        supabase
          .from("clients")
          .select("id, name, deleted_at")
          .not("deleted_at", "is", null)
          .gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("suppliers")
          .select("id, name, deleted_at")
          .not("deleted_at", "is", null)
          .gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("services")
          .select("id, description, deleted_at, quote_number")
          .not("deleted_at", "is", null)
          .gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("catalog_services")
          .select("id, name, deleted_at")
          .not("deleted_at", "is", null)
          .gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, description, deleted_at, type, category")
          .not("deleted_at", "is", null)
          .gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("pmoc_contracts")
          .select("id, name, deleted_at")
          .not("deleted_at", "is", null)
          .gte("deleted_at", cutoff)
          .order("deleted_at", { ascending: false }),
      ]);

      const items: TrashItem[] = [];

      (clients.data ?? []).forEach((c) =>
        items.push({ id: c.id, name: c.name, type: "client", deleted_at: c.deleted_at!, table: "clients" })
      );
      (suppliers.data ?? []).forEach((s) =>
        items.push({ id: s.id, name: s.name, type: "supplier", deleted_at: s.deleted_at!, table: "suppliers" })
      );
      (services.data ?? []).forEach((s) =>
        items.push({
          id: s.id,
          name: s.description || `#${s.quote_number}`,
          type: "service",
          deleted_at: s.deleted_at!,
          table: "services",
        })
      );
      (catalog.data ?? []).forEach((c) =>
        items.push({ id: c.id, name: c.name, type: "catalog", deleted_at: c.deleted_at!, table: "catalog_services" })
      );
      (transactions.data ?? []).forEach((t) =>
        items.push({ id: t.id, name: t.description || `${t.type} - ${t.category}`, type: "transaction", deleted_at: t.deleted_at!, table: "transactions" })
      );
      (pmocContracts.data ?? []).forEach((p) =>
        items.push({ id: p.id, name: p.name, type: "pmoc", deleted_at: p.deleted_at!, table: "pmoc_contracts" })
      );

      return items;
    },
    enabled: !!organizationId,
  });

  const restoreMutation = useMutation({
    mutationFn: async (item: TrashItem) => {
      const { error } = await supabase
        .from(item.table as any)
        .update({ deleted_at: null })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      queryClient.invalidateQueries({ queryKey: ["clients"] });
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      queryClient.invalidateQueries({ queryKey: ["services"] });
      queryClient.invalidateQueries({ queryKey: ["catalog_services"] });
      toast({ title: "Item restaurado", description: "O item foi restaurado com sucesso" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro ao restaurar", description: error.message });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (item: TrashItem) => {
      const { error } = await supabase
        .from(item.table as any)
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trash"] });
      toast({ title: "Item excluído permanentemente", description: "O item foi removido definitivamente" });
    },
    onError: (error) => {
      toast({ variant: "destructive", title: "Erro ao excluir", description: error.message });
    },
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    restore: restoreMutation.mutateAsync,
    permanentDelete: permanentDeleteMutation.mutateAsync,
    isRestoring: restoreMutation.isPending,
    isDeleting: permanentDeleteMutation.isPending,
  };
}
