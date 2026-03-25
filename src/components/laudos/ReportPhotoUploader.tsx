import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Camera, Loader2, Trash2, ImagePlus, CheckCircle2 } from "lucide-react";
import {
  useReportPhotos,
  PHOTO_CATEGORY_LABELS,
  PHOTO_CATEGORY_ORDER,
  MAX_PHOTOS_PER_CATEGORY,
  getCategoryCount,
  type PhotoCategory,
  type ReportPhoto,
} from "@/hooks/useReportPhotos";

interface ReportPhotoUploaderProps {
  reportId: string;
}

const CATEGORY_ICONS: Record<PhotoCategory, string> = {
  before: "📷",
  problem: "🔍",
  after: "✅",
};

const CATEGORY_COLORS: Record<PhotoCategory, string> = {
  before: "bg-blue-500/10 text-blue-700 border-blue-200",
  problem: "bg-amber-500/10 text-amber-700 border-amber-200",
  after: "bg-green-500/10 text-green-700 border-green-200",
};

export function ReportPhotoUploader({ reportId }: ReportPhotoUploaderProps) {
  const { photos, upload, remove, isUploading } = useReportPhotos(reportId);
  const [selectedCategory, setSelectedCategory] = useState<PhotoCategory>("problem");
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentCatCount = getCategoryCount(photos, selectedCategory);
  const isAtLimit = currentCatCount >= MAX_PHOTOS_PER_CATEGORY;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const remaining = MAX_PHOTOS_PER_CATEGORY - currentCatCount;
    const filesToUpload = Array.from(files).slice(0, remaining);

    for (let i = 0; i < filesToUpload.length; i++) {
      setUploadProgress(`Enviando ${i + 1} de ${filesToUpload.length}...`);
      try {
        await upload({ file: filesToUpload[i], category: selectedCategory });
      } catch {
        // Error toast handled by mutation
      }
    }

    setUploadProgress(null);
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
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            {photos.length} / {MAX_PHOTOS_PER_CATEGORY * 3} fotos
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Upload controls */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Select
            value={selectedCategory}
            onValueChange={(v) => setSelectedCategory(v as PhotoCategory)}
          >
            <SelectTrigger className="sm:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PHOTO_CATEGORY_ORDER.map((cat) => {
                const count = getCategoryCount(photos, cat);
                return (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_ICONS[cat]} {PHOTO_CATEGORY_LABELS[cat]} ({count}/{MAX_PHOTOS_PER_CATEGORY})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            className="gap-2 flex-1"
            disabled={isUploading || isAtLimit}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isAtLimit ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <ImagePlus className="h-4 w-4" />
            )}
            {uploadProgress
              ? uploadProgress
              : isAtLimit
              ? `Limite atingido (${MAX_PHOTOS_PER_CATEGORY})`
              : `Adicionar Foto (${currentCatCount}/${MAX_PHOTOS_PER_CATEGORY})`}
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

        {/* Photo grid by category - fixed order */}
        {PHOTO_CATEGORY_ORDER.map((cat) => {
          const catPhotos = groupedPhotos[cat];
          if (catPhotos.length === 0) return null;
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`text-xs font-medium border ${CATEGORY_COLORS[cat]}`}>
                  {CATEGORY_ICONS[cat]} {PHOTO_CATEGORY_LABELS[cat]}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {catPhotos.length}/{MAX_PHOTOS_PER_CATEGORY}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {catPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group rounded-lg overflow-hidden border border-border aspect-square"
                  >
                    <img
                      src={photo.photo_url}
                      alt={photo.caption || PHOTO_CATEGORY_LABELS[cat]}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      onClick={() => remove(photo.id)}
                      className="absolute top-1 right-1 bg-destructive/90 text-destructive-foreground rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
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
          <div className="text-center py-8 text-muted-foreground text-sm border border-dashed border-border rounded-lg">
            <Camera className="h-10 w-10 mx-auto mb-2 opacity-20" />
            <p>Nenhuma foto adicionada</p>
            <p className="text-xs mt-1">Até {MAX_PHOTOS_PER_CATEGORY} fotos por categoria</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
