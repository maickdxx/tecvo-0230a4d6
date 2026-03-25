import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "./use-toast";

const SIGNATURE_BUCKET = "service-signatures";

export interface ServiceSignature {
  id: string;
  service_id: string;
  organization_id: string;
  signature_url: string | null;
  signer_name: string | null;
  signed_at: string | null;
  token: string;
  ip_address: string | null;
  created_at: string;
}

/** Fetch client IP from a public API (best effort) */
async function fetchClientIP(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    const data = await res.json();
    return data.ip || null;
  } catch {
    return null;
  }
}

export function useServiceSignatures(serviceId?: string) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: signature, isLoading } = useQuery({
    queryKey: ["service-signature", serviceId],
    queryFn: async () => {
      if (!serviceId) return null;
      const { data, error } = await supabase
        .from("service_signatures")
        .select("*")
        .eq("service_id", serviceId)
        .maybeSingle();
      if (error) throw error;
      return data as ServiceSignature | null;
    },
    enabled: !!serviceId,
  });

  const createSignatureMutation = useMutation({
    mutationFn: async ({ serviceId, blob, signerName }: { serviceId: string; blob: Blob; signerName?: string }) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      const fileName = `${profile.organization_id}/client-sig-${serviceId}-${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from(SIGNATURE_BUCKET)
        .upload(fileName, blob, { upsert: true, contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from(SIGNATURE_BUCKET)
        .getPublicUrl(fileName);

      const signatureUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

      // Capture IP for legal validity
      const ip = await fetchClientIP();

      const { data, error } = await supabase
        .from("service_signatures")
        .insert({
          service_id: serviceId,
          organization_id: profile.organization_id,
          signature_url: signatureUrl,
          signer_name: signerName || null,
          signed_at: new Date().toISOString(),
          ip_address: ip,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["service-signature", vars.serviceId] });
      toast({ title: "Assinatura salva!", description: "A assinatura do cliente foi registrada com sucesso." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao salvar assinatura", description: error.message });
    },
  });

  const createSignatureLinkMutation = useMutation({
    mutationFn: async (serviceId: string) => {
      if (!profile?.organization_id) throw new Error("Organização não encontrada");

      // Check if a signature already exists (prevent duplicates)
      const { data: existing } = await supabase
        .from("service_signatures")
        .select("*")
        .eq("service_id", serviceId)
        .maybeSingle();

      if (existing) {
        if (existing.signature_url) {
          throw new Error("Esta OS já possui uma assinatura registrada.");
        }
        return existing as ServiceSignature;
      }

      const { data, error } = await supabase
        .from("service_signatures")
        .insert({
          service_id: serviceId,
          organization_id: profile.organization_id,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data as ServiceSignature;
    },
    onSuccess: (_, serviceId) => {
      queryClient.invalidateQueries({ queryKey: ["service-signature", serviceId] });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "Erro ao gerar link", description: error.message });
    },
  });

  return {
    signature,
    isLoading,
    createSignature: createSignatureMutation.mutateAsync,
    isCreating: createSignatureMutation.isPending,
    createSignatureLink: createSignatureLinkMutation.mutateAsync,
    isCreatingLink: createSignatureLinkMutation.isPending,
  };
}

/** Sign via public token (no auth required) */
export async function signViaToken(token: string, blob: Blob, signerName: string) {
  // Verify the token exists via secure RPC
  const { data: sigRows, error: fetchError } = await supabase
    .rpc("get_signature_by_token", { p_token: token });

  const sigRecord = sigRows?.[0] || null;
  if (fetchError || !sigRecord) throw new Error("Link inválido ou já utilizado");

  // Prevent overwriting existing signature
  if (sigRecord.signature_url) {
    throw new Error("Esta ordem de serviço já foi assinada.");
  }

  const fileName = `public-sig-${token}-${Date.now()}.png`;

  const { error: uploadError } = await supabase.storage
    .from(SIGNATURE_BUCKET)
    .upload(fileName, blob, { upsert: true, contentType: "image/png" });
  if (uploadError) throw uploadError;

  const { data: publicUrlData } = supabase.storage
    .from(SIGNATURE_BUCKET)
    .getPublicUrl(fileName);

  const signatureUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;

  // Capture IP for legal validity
  const ip = await fetchClientIP();

  // Use secure RPC to update signature (prevents tampering)
  const { data: signed, error: updateError } = await supabase
    .rpc("sign_service_signature", {
      p_token: token,
      p_signature_url: signatureUrl,
      p_signer_name: signerName,
      ...(ip ? { p_ip_address: ip } : {}),
    });

  if (updateError) throw updateError;
  if (!signed) throw new Error("Não foi possível salvar a assinatura");

  return signatureUrl;
}
