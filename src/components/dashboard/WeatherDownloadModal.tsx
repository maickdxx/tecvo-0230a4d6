import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Loader2, Smartphone, Square, MessageCircle, Calendar, CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateWeatherImage, generateWeatherPreview, type ArtFormat, type ArtPeriod } from "@/lib/generateWeatherImage";
import type { DayForecast, WeatherAlert } from "@/hooks/useWeatherForecast";
import { Skeleton } from "@/components/ui/skeleton";

interface FormatOption {
  id: ArtFormat;
  label: string;
  sublabel: string;
  size: string;
  icon: React.ReactNode;
}

const formats: FormatOption[] = [
  {
    id: "story",
    label: "Story",
    sublabel: "Instagram / WhatsApp Status",
    size: "1080 × 1920",
    icon: <Smartphone className="h-4 w-4" />,
  },
  {
    id: "feed",
    label: "Feed",
    sublabel: "Instagram / Facebook",
    size: "1080 × 1080",
    icon: <Square className="h-4 w-4" />,
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    sublabel: "Envio direto",
    size: "1080 × 1350",
    icon: <MessageCircle className="h-4 w-4" />,
  },
];

interface WeatherDownloadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload: (format: ArtFormat, period: ArtPeriod) => Promise<void>;
  city: string;
  today: DayForecast;
  days: DayForecast[];
  alert: WeatherAlert;
  logoUrl?: string | null;
  companyName?: string | null;
  companyPhone?: string | null;
}

export function WeatherDownloadModal({
  open,
  onOpenChange,
  onDownload,
  city,
  today,
  days,
  alert,
  logoUrl,
  companyName,
  companyPhone,
}: WeatherDownloadModalProps) {
  const [format, setFormat] = useState<ArtFormat>("story");
  const [period, setPeriod] = useState<ArtPeriod>("day");
  const [isGenerating, setIsGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  const generatePreview = useCallback(async () => {
    if (!open || !today) return;
    setIsLoadingPreview(true);
    try {
      // Revoke old URL
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = await generateWeatherPreview({
        city, today, days, alert, logoUrl, companyName, companyPhone, format, period,
      });
      setPreviewUrl(url);
    } catch {
      setPreviewUrl(null);
    } finally {
      setIsLoadingPreview(false);
    }
  }, [open, format, period, city, today, days, alert, logoUrl, companyName, companyPhone]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, []);

  const handleDownload = async () => {
    setIsGenerating(true);
    try {
      await onDownload(format, period);
      onOpenChange(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const aspectRatios: Record<ArtFormat, string> = {
    story: "9/16",
    feed: "1/1",
    whatsapp: "4/5",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerar Arte Promocional</DialogTitle>
          <DialogDescription>
            Escolha o formato, período e visualize a arte antes de baixar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          {/* Period selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Período</label>
            <Tabs value={period} onValueChange={(v) => setPeriod(v as ArtPeriod)}>
              <TabsList className="w-full">
                <TabsTrigger value="day" className="flex-1 gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Hoje
                </TabsTrigger>
                <TabsTrigger value="week" className="flex-1 gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Semana
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Format selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Formato</label>
            <div className="grid grid-cols-3 gap-2">
              {formats.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-xl border p-3 text-center transition-all",
                    format === f.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/40"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-lg",
                      format === f.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {f.icon}
                  </div>
                  <span className="text-xs font-semibold text-foreground">{f.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{f.sublabel}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Prévia</label>
            <div className="flex justify-center rounded-xl border border-border bg-muted/30 p-4">
              {isLoadingPreview ? (
                <div
                  className="flex items-center justify-center rounded-lg bg-muted/50"
                  style={{ aspectRatio: aspectRatios[format], width: format === "feed" ? 280 : 220 }}
                >
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Prévia da arte"
                  className="rounded-lg shadow-md"
                  style={{
                    aspectRatio: aspectRatios[format],
                    width: format === "feed" ? 280 : 220,
                    objectFit: "cover",
                  }}
                />
              ) : (
                <div
                  className="flex items-center justify-center rounded-lg bg-muted/50 text-xs text-muted-foreground"
                  style={{ aspectRatio: aspectRatios[format], width: format === "feed" ? 280 : 220 }}
                >
                  Erro ao gerar prévia
                </div>
              )}
            </div>
          </div>

          {/* Download button */}
          <Button onClick={handleDownload} disabled={isGenerating} className="w-full gap-2">
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Gerar e baixar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ArtFormat, ArtPeriod };
