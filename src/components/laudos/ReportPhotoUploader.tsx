import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, Trash2, ImagePlus } from "lucide-react";
import {
  useReportPhotos,
  PHOTO_CATEGORY_LABELS,
  type PhotoCategory,
  type ReportPhoto,
} from "@/hooks/useReportPhotos";

interface ReportPhotoUploaderProps {
  reportId: string;
}

export function ReportPhotoUploader({ reportId }: ReportPhotoUploaderProps) {
  const { photos, upload, remove, isUploading } = useReportPhotos(reportId);
  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory>("problem");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      await upload({ file: files[i], category: selectedCategory });
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const groupedPhotos: Record<PhotoCategory, ReportPhoto[]> = {
    before: photos.filter((p) => p.category === "before"),
    problem: photos.filter((p) => p.category === "problem"),
    after: photos.filter((p) => p.category === "after"),
  };

  return (
    <Card>
      <CardHeader className="pb-3 pt-5 px-4">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-primary/10">
            <Camera className="h-3.5 w-3.5 text-primary" />
          </div>
          Evidências Fotográficas
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Upload controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as PhotoCategory)}
          >
            <SelectTrigger className="sm:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="before">📷 Antes</SelectItem>
              <SelectItem value="problem">🔍 Problema Identificado</SelectItem>
              <SelectItem value="after">✅ Depois</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="gap-2 flex-1"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {isUploading ? "Enviando..." : "Adicionar Foto"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Photo grid by category */}
        {(["before", "problem", "after"] as PhotoCategory[]).map((cat) => {
          const catPhotos = groupedPhotos[cat];
          if (catPhotos.length === 0) return null;
          return (
            <div key={cat}>
              <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">
                {PHOTO_CATEGORY_LABELS[cat]} ({catPhotos.length})
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                {catPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group rounded-lg overflow-hidden border border-border aspect-square"
                  >
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || PHOTO_CATEGORY_LABELS[cat]}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => remove(photo.id)}
                      className="absolute top-1 right-1 bg-destructive/90 text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {photos.length === 0 && (
          <div className="text-center py-6 text-muted-foreground text-sm">
            <Camera className="h-8 w-8 mx-auto mb-2 opacity-30" />
            Nenhuma foto adicionada
          </div>
        )}
      </CardContent>
    </Card>
  );
}
