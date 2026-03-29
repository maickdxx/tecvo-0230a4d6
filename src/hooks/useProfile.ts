import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export function useProfile() {
  const { profile, user } = useAuth();

  const updateProfileMutation = useMutation({
    mutationFn: async ({ 
      fullName, 
      phone, 
      position, 
      whatsappAiEnabled 
    }: { 
      fullName: string; 
      phone: string; 
      position?: string; 
      whatsappAiEnabled?: boolean 
    }) => {
      if (!user) throw new Error("Não autenticado");

      const updateData: any = { full_name: fullName, phone };
      if (position !== undefined) {
        updateData.position = position || null;
      }
      if (whatsappAiEnabled !== undefined) {
        updateData.whatsapp_ai_enabled = whatsappAiEnabled;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      // Força refresh do perfil recarregando a página
      window.location.reload();
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o perfil.",
        variant: "destructive",
      });
    },
  });

  return {
    profile,
    updateProfile: updateProfileMutation.mutate,
    isUpdating: updateProfileMutation.isPending,
  };
}
