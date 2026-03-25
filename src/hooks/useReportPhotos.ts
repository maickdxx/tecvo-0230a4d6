import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";


export type PhotoCategory = "before" | "after" | "problem";

export interface ReportPhoto {
  id: string;
  report_id: string;
  organization_id: string;
  category: PhotoCategory;
  photo_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export const PHOTO_CATEGORY_LABELS: Record<PhotoCategory, string> = {
  before: "Antes",
  after: "Depois",
  problem: "Problema Identificado",
};

export function useReportPhotos(reportId: string | undefined) {
  const { organizationId } = useAuth();
  const queryClient = useQueryClient();

  const { data: photos = [], isLoading } = useQuery({
    queryKey: ["report-photos", reportId],
    queryFn: async () => {
      if (!reportId) return [];
      const { data, error } = await supabase
        .from("technical_report_photos")
        .select("*")
        .eq("report_id", reportId)
        .order("category")
        .order("sort_order");
      if (error) throw error;
      return data as ReportPhoto[];
    },
    enabled: !!reportId,
  });

  const uploadMutation = useMutation({
    mutationFn: async ({
      file,
      category,
      caption,
    }: {
      file: File;
      category: PhotoCategory;
      caption?: string;
    }) => {
      if (!reportId || !organizationId) throw new Error("Missing context");

      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${organizationId}/${reportId}/${crypto.randomUUID()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("report-photos")
        .upload(filePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("report-photos")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase
        .from("technical_report_photos")
        .insert({
          report_id: reportId,
          organization_id: organizationId,
          category,
          photo_url: urlData.publicUrl,
          caption: caption || null,
          sort_order: photos.filter((p) => p.category === category).length,
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-photos", reportId] });
      toast({ title: "Foto adicionada" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao enviar foto", description: err.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (photoId: string) => {
      const photo = photos.find((p) => p.id === photoId);
      if (photo) {
        // Extract storage path from URL
        const url = new URL(photo.photo_url);
        const pathMatch = url.pathname.match(/report-photos\/(.+)$/);
        if (pathMatch) {
          await supabase.storage.from("report-photos").remove([pathMatch[1]]);
        }
      }
      const { error } = await supabase
        .from("technical_report_photos")
        .delete()
        .eq("id", photoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["report-photos", reportId] });
      toast({ title: "Foto removida" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Erro ao remover", description: err.message });
    },
  });

  return {
    photos,
    isLoading,
    upload: uploadMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
  };
}
