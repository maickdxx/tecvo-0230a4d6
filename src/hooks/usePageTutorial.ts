import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function usePageTutorial(pageKey: string) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const { data: seenPages, isLoading } = useQuery({
    queryKey: ["page-tutorials-seen", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("organizations")
        .select("page_tutorials_seen")
        .eq("id", organizationId)
        .single();
      if (error) throw error;
      return (data?.page_tutorials_seen as string[]) || [];
    },
    enabled: !!organizationId,
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("No org");
      const current = seenPages || [];
      if (current.includes(pageKey)) return;
      const updated = [...current, pageKey];
      const { error } = await supabase
        .from("organizations")
        .update({ page_tutorials_seen: updated } as any)
        .eq("id", organizationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["page-tutorials-seen", organizationId] });
    },
  });

  const showTutorial = !isLoading && !!seenPages && !seenPages.includes(pageKey);

  return {
    showTutorial,
    dismissTutorial: () => dismissMutation.mutate(),
    isLoading,
  };
}
