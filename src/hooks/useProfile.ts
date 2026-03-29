import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

export function useProfile() {
  const { profile, user } = useAuth();
  const { isOwner } = useUserRole();

  const updateProfileMutation = useMutation({
    mutationFn: async ({ 
      fullName, 
      phone, 
      position, 
      whatsappAiEnabled,
      whatsappSignature,
      aiAssistantName,
      aiAssistantVoice,
      dashboardLayout
    }: { 
      fullName?: string; 
      phone?: string; 
      position?: string; 
      whatsappAiEnabled?: boolean;
      whatsappSignature?: string;
      aiAssistantName?: string;
      aiAssistantVoice?: string;
      dashboardLayout?: any;
    }) => {
      if (!user) throw new Error("Não autenticado");

      const updateData: any = {};
      if (fullName !== undefined) updateData.full_name = fullName;
      if (phone !== undefined) updateData.phone = phone;
      if (position !== undefined) updateData.position = position || null;
      if (whatsappAiEnabled !== undefined) updateData.whatsapp_ai_enabled = whatsappAiEnabled;
      if (whatsappSignature !== undefined) updateData.whatsapp_signature = whatsappSignature;
      if (aiAssistantName !== undefined) updateData.ai_assistant_name = aiAssistantName;
      if (aiAssistantVoice !== undefined) updateData.ai_assistant_voice = aiAssistantVoice;
      if (dashboardLayout !== undefined) updateData.dashboard_layout = dashboardLayout;

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
