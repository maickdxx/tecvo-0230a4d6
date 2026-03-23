import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

interface Feedback {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  created_at: string;
}

export function useFeedback() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();

  const { data: feedbacks, isLoading } = useQuery({
    queryKey: ["feedback", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Feedback[];
    },
    enabled: !!user?.id,
  });

  const createFeedback = useMutation({
    mutationFn: async (input: { type: string; title: string; description: string }) => {
      const { error } = await supabase.from("feedback" as any).insert({
        user_id: user!.id,
        organization_id: organization!.id,
        type: input.type,
        title: input.title,
        description: input.description,
      } as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feedback"] });
    },
  });

  return { feedbacks, isLoading, createFeedback };
}
