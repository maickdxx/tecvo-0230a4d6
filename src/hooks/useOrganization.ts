import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

export interface Organization {
  id: string;
  name: string;
  cnpj_cpf: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  logo_url: string | null;
  website: string | null;
  onboarding_completed: boolean | null;
  signature_url: string | null;
  auto_signature_os: boolean | null;
  require_client_signature: boolean | null;
  monthly_goal: number | null;
  timezone: string;
  whatsapp_owner: string | null;
  messaging_paused: boolean;
  messaging_paused_at: string | null;
  messaging_paused_reason: string | null;
}

export type OrganizationUpdate = Partial<Omit<Organization, "id">>;

export function useOrganization() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: organization, isLoading, error } = useQuery({
    queryKey: ["organization", profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return null;

      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", profile.organization_id)
        .maybeSingle();

      if (error) throw error;
      return data as Organization | null;
    },
    enabled: !!profile?.organization_id,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: OrganizationUpdate) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { data, error } = await supabase
        .from("organizations")
        .update(updates)
        .eq("id", profile.organization_id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast({
        title: "Perfil atualizado!",
        description: "As informações da empresa foram salvas",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar perfil",
        description: error.message,
      });
    },
  });

  const uploadLogoMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const fileExt = file.name.split(".").pop();
      const fileName = `${profile.organization_id}/logo.${fileExt}`;

      // Upload file to storage
      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(fileName);

      // Update organization with logo URL (add cache buster)
      const logoUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      
      const { error: updateError } = await supabase
        .from("organizations")
        .update({ logo_url: logoUrl })
        .eq("id", profile.organization_id);

      if (updateError) throw updateError;

      return logoUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast({
        title: "Logo atualizado!",
        description: "O logo da empresa foi salvo",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao fazer upload do logo",
        description: error.message,
      });
    },
  });

  const removeLogoMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      // List files in org folder
      const { data: files } = await supabase.storage
        .from("organization-logos")
        .list(profile.organization_id);

      // Delete all logo files
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${profile.organization_id}/${f.name}`);
        await supabase.storage.from("organization-logos").remove(filePaths);
      }

      // Update organization to remove logo URL
      const { error } = await supabase
        .from("organizations")
        .update({ logo_url: null })
        .eq("id", profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast({
        title: "Logo removido!",
        description: "O logo da empresa foi removido",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Erro ao remover logo",
        description: error.message,
      });
    },
  });

  const uploadSignatureMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const fileName = `${profile.organization_id}/signature.png`;

      const { error: uploadError } = await supabase.storage
        .from("organization-logos")
        .upload(fileName, blob, { upsert: true, contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("organization-logos")
        .getPublicUrl(fileName);

      const signatureUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("organizations")
        .update({ signature_url: signatureUrl } as any)
        .eq("id", profile.organization_id);

      if (updateError) throw updateError;
      return signatureUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast({ title: "Assinatura salva!", description: "A assinatura da empresa foi salva" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao salvar assinatura", description: error.message });
    },
  });

  const removeSignatureMutation = useMutation({
    mutationFn: async () => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { data: files } = await supabase.storage
        .from("organization-logos")
        .list(profile.organization_id);

      const sigFiles = files?.filter(f => f.name.startsWith("signature")) || [];
      if (sigFiles.length > 0) {
        const paths = sigFiles.map(f => `${profile.organization_id}/${f.name}`);
        await supabase.storage.from("organization-logos").remove(paths);
      }

      const { error } = await supabase
        .from("organizations")
        .update({ signature_url: null, auto_signature_os: false } as any)
        .eq("id", profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast({ title: "Assinatura removida!", description: "A assinatura da empresa foi removida" });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao remover assinatura", description: error.message });
    },
  });

  const toggleAutoSignatureOSMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const { error } = await supabase
        .from("organizations")
        .update({ auto_signature_os: enabled } as any)
        .eq("id", profile.organization_id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar configuração", description: error.message });
    },
  });

  const toggleRequireClientSignatureMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");
      const { error } = await supabase
        .from("organizations")
        .update({ require_client_signature: enabled } as any)
        .eq("id", profile.organization_id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao atualizar configuração", description: error.message });
    },
  });

  return {
    organization,
    isLoading,
    error,
    update: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    uploadLogo: uploadLogoMutation.mutate,
    isUploadingLogo: uploadLogoMutation.isPending,
    removeLogo: removeLogoMutation.mutate,
    isRemovingLogo: removeLogoMutation.isPending,
    uploadSignature: uploadSignatureMutation.mutate,
    isUploadingSignature: uploadSignatureMutation.isPending,
    removeSignature: removeSignatureMutation.mutate,
    isRemovingSignature: removeSignatureMutation.isPending,
    toggleAutoSignatureOS: toggleAutoSignatureOSMutation.mutate,
    toggleRequireClientSignature: toggleRequireClientSignatureMutation.mutate,
  };
}
