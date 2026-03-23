import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";
import { useMemo, useCallback } from "react";

export type CategoryType = "income" | "expense";

export interface TransactionCategory {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  type: CategoryType;
  is_default: boolean;
  created_at: string;
  parent_id: string | null;
}

export interface TransactionCategoryFormData {
  name: string;
  type: CategoryType;
  slug?: string;
  parent_id?: string | null;
}

export interface GroupedCategory {
  parent: TransactionCategory;
  children: TransactionCategory[];
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

export function useTransactionCategories(type?: CategoryType) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transaction-categories", organizationId, type],
    queryFn: async () => {
      if (!organizationId) return [];

      let queryBuilder = supabase
        .from("transaction_categories")
        .select("*")
        .order("name");

      if (type) {
        queryBuilder = queryBuilder.eq("type", type);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;
      return (data as unknown as TransactionCategory[]) ?? [];
    },
    enabled: !!organizationId,
  });

  const allCategories = query.data ?? [];

  // Parent categories (parent_id is null)
  const parentCategories = useMemo(
    () => allCategories.filter((c) => c.parent_id === null || c.parent_id === undefined),
    [allCategories]
  );

  // Get children of a parent
  const getChildren = useCallback(
    (parentId: string) => allCategories.filter((c) => c.parent_id === parentId),
    [allCategories]
  );

  // Grouped categories: { parent, children }[]
  const groupedCategories = useMemo<GroupedCategory[]>(() => {
    return parentCategories.map((parent) => ({
      parent,
      children: allCategories.filter((c) => c.parent_id === parent.id),
    }));
  }, [parentCategories, allCategories]);

  // Flat lists filtered by type (only subcategories - leaves)
  const incomeCategories = useMemo(
    () => allCategories.filter((c) => c.type === "income" && c.parent_id !== null && c.parent_id !== undefined),
    [allCategories]
  );
  const expenseCategories = useMemo(
    () => allCategories.filter((c) => c.type === "expense" && c.parent_id !== null && c.parent_id !== undefined),
    [allCategories]
  );

  // Grouped by type
  const groupedIncomeCategories = useMemo<GroupedCategory[]>(
    () => groupedCategories.filter((g) => g.parent.type === "income"),
    [groupedCategories]
  );
  const groupedExpenseCategories = useMemo<GroupedCategory[]>(
    () => groupedCategories.filter((g) => g.parent.type === "expense"),
    [groupedCategories]
  );

  // Create a labels map from the categories
  const categoryLabels: Record<string, string> = {};
  allCategories.forEach((cat) => {
    categoryLabels[cat.slug] = cat.name;
  });

  const createMutation = useMutation({
    mutationFn: async (data: TransactionCategoryFormData) => {
      if (!organizationId) throw new Error("Organização não encontrada");

      const slug = data.slug || generateSlug(data.name);

      const insertData: Record<string, unknown> = {
        name: data.name,
        slug,
        type: data.type,
        organization_id: organizationId,
        is_default: false,
      };
      if (data.parent_id) {
        insertData.parent_id = data.parent_id;
      }

      const { data: category, error } = await supabase
        .from("transaction_categories")
        .insert(insertData as any)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma categoria com esse nome");
        }
        throw error;
      }
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
      toast({
        title: "Categoria criada",
        description: "A nova categoria foi adicionada com sucesso",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao criar categoria",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<TransactionCategoryFormData> }) => {
      const updateData: Record<string, unknown> = { ...data };
      if (data.name && !data.slug) {
        updateData.slug = generateSlug(data.name);
      }

      const { data: category, error } = await supabase
        .from("transaction_categories")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe uma categoria com esse nome");
        }
        throw error;
      }
      return category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
      toast({
        title: "Categoria atualizada",
        description: "A categoria foi atualizada com sucesso",
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
      const { error } = await supabase.from("transaction_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transaction-categories"] });
      toast({
        title: "Categoria excluída",
        description: "A categoria foi removida com sucesso",
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

  return {
    categories: allCategories,
    parentCategories,
    getChildren,
    groupedCategories,
    groupedIncomeCategories,
    groupedExpenseCategories,
    incomeCategories,
    expenseCategories,
    categoryLabels,
    isLoading: query.isLoading,
    error: query.error,
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
