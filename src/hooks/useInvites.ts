import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { AppRole } from "@/hooks/useUserRole";

export interface Invite {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  created_at: string;
  accepted_at: string | null;
  organization_id: string;
}

export interface InviteWithOrg {
  id: string;
  email: string;
  role: AppRole;
  token: string;
  organization_id: string;
  organizations: {
    name: string;
  } | null;
}

export function useInvites() {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["invites", organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invites")
        .select("*")
        .eq("organization_id", organizationId!)
        .is("accepted_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Invite[];
    },
    enabled: !!organizationId,
  });

  const createInviteMutation = useMutation({
    mutationFn: async ({ email, role, maxUsers }: { email: string; role: AppRole; maxUsers?: number }) => {
      // Get organization name for the email
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", organizationId!)
        .single();

      if (orgError) throw orgError;

      // Enforce team member limit based on plan
      if (maxUsers && maxUsers !== Infinity) {
        const { count: memberCount } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!);

        const { count: pendingCount } = await supabase
          .from("invites")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!)
          .is("accepted_at", null);

        const totalUsers = (memberCount || 0) + (pendingCount || 0);
        if (totalUsers >= maxUsers) {
          throw new Error(`Limite de ${maxUsers} usuário(s) atingido no seu plano. Faça upgrade para adicionar mais membros.`);
        }
      }

      // Check if invite already exists for this email
      const { data: existingInvite } = await supabase
        .from("invites")
        .select("id")
        .eq("email", email)
        .eq("organization_id", organizationId!)
        .is("accepted_at", null)
        .maybeSingle();

      if (existingInvite) {
        throw new Error("Já existe um convite pendente para este email");
      }

      // Check if user already exists in organization
      const { data: existingProfile } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", organizationId!)
        .eq("full_name", email) // This check isn't perfect but provides some validation
        .maybeSingle();

      // Create the invite
      const { data: invite, error: insertError } = await supabase
        .from("invites")
        .insert({
          email,
          role,
          organization_id: organizationId!,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Send the invite email
      const { error: emailError } = await supabase.functions.invoke("send-invite", {
        body: {
          email,
          role,
          organizationName: org.name,
          inviteToken: invite.token,
        },
      });

      if (emailError) {
        // Delete the invite if email fails
        await supabase.from("invites").delete().eq("id", invite.id);
        throw new Error("Falha ao enviar email de convite");
      }

      return invite;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast({
        title: "Convite enviado!",
        description: "O convidado receberá um email com instruções.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao enviar convite",
        description: error.message,
      });
    },
  });

  const createInviteLinkMutation = useMutation({
    mutationFn: async ({ email, role, maxUsers }: { email: string; role: AppRole; maxUsers?: number }) => {
      // Enforce team member limit based on plan
      if (maxUsers && maxUsers !== Infinity) {
        const { count: memberCount } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!);

        const { count: pendingCount } = await supabase
          .from("invites")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId!)
          .is("accepted_at", null);

        const totalUsers = (memberCount || 0) + (pendingCount || 0);
        if (totalUsers >= maxUsers) {
          throw new Error(`Limite de ${maxUsers} usuário(s) atingido no seu plano. Faça upgrade para adicionar mais membros.`);
        }
      }

      // Check if invite already exists for this email
      const { data: existingInvite } = await supabase
        .from("invites")
        .select("id")
        .eq("email", email)
        .eq("organization_id", organizationId!)
        .is("accepted_at", null)
        .maybeSingle();

      if (existingInvite) {
        throw new Error("Já existe um convite pendente para este email");
      }

      // Create the invite without sending email
      const { data: invite, error: insertError } = await supabase
        .from("invites")
        .insert({
          email,
          role,
          organization_id: organizationId!,
          invited_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return invite;
    },
    onSuccess: (invite) => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      const link = `${window.location.origin}/login?invite=${invite.token}`;
      navigator.clipboard.writeText(link);
      toast({
        title: "Link copiado!",
        description: "Compartilhe o link com o convidado.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao gerar link",
        description: error.message,
      });
    },
  });

  const deleteInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("invites")
        .delete()
        .eq("id", inviteId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invites"] });
      toast({
        title: "Convite cancelado",
        description: "O convite foi removido com sucesso.",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Falha ao cancelar convite",
      });
    },
  });

  const copyInviteLink = async (token: string) => {
    const baseUrl = "https://tecvo.com.br";
    const link = `${baseUrl}/login?invite=${token}`;
    await navigator.clipboard.writeText(link);
    toast({
      title: "Link copiado!",
      description: "Compartilhe o link com o convidado.",
    });
  };

  return {
    invites,
    isLoading,
    createInvite: createInviteMutation.mutate,
    isCreating: createInviteMutation.isPending,
    createInviteLink: createInviteLinkMutation.mutate,
    isCreatingLink: createInviteLinkMutation.isPending,
    deleteInvite: deleteInviteMutation.mutate,
    isDeleting: deleteInviteMutation.isPending,
    copyInviteLink,
  };
}

// Hook to fetch invite by token (for signup flow)
// Uses secure RPC function to prevent email enumeration attacks
export function useInviteByToken(token: string | null) {
  return useQuery({
    queryKey: ["invite-by-token", token],
    queryFn: async () => {
      if (!token) return null;

      // Use secure RPC function instead of direct table query
      // This prevents enumeration of all pending invites
      const { data, error } = await supabase
        .rpc("get_invite_by_token", { invite_token: token });

      if (error) throw error;
      
      // Transform the RPC result to match the expected interface
      if (data && data.length > 0) {
        const invite = data[0];
        return {
          id: invite.id,
          email: invite.email,
          role: invite.role,
          token: invite.token,
          organization_id: invite.organization_id,
          organizations: invite.organization_name 
            ? { name: invite.organization_name } 
            : null,
        } as InviteWithOrg;
      }
      
      return null;
    },
    enabled: !!token,
  });
}
