import { useState } from "react";
import {
  Sun,
  CloudSun,
  Cloud,
  CloudFog,
  CloudRain,
  Snowflake,
  CloudLightning,
  Thermometer,
  Droplets,
  AlertTriangle,
  Info,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWeatherForecast, type DayForecast } from "@/hooks/useWeatherForecast";
import { useOrganization } from "@/hooks/useOrganization";
import { useActivityTracker } from "@/hooks/useActivityTracker";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { generateWeatherImage, type ArtFormat, type ArtPeriod } from "@/lib/generateWeatherImage";
import { toast } from "@/hooks/use-toast";
import { WeatherDownloadModal } from "./WeatherDownloadModal";

function getWeatherIcon(code: number) {
  if (code <= 1) return <Sun className="h-6 w-6 text-amber-500" />;
  if (code === 2) return <CloudSun className="h-6 w-6 text-amber-400" />;
  if (code === 3) return <Cloud className="h-6 w-6 text-muted-foreground" />;
  if (code >= 45 && code <= 48) return <CloudFog className="h-6 w-6 text-muted-foreground" />;
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82))
    return <CloudRain className="h-6 w-6 text-blue-500" />;
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86))
    return <Snowflake className="h-6 w-6 text-sky-400" />;
  if (code >= 95) return <CloudLightning className="h-6 w-6 text-yellow-500" />;
  return <Sun className="h-6 w-6 text-amber-500" />;
}

const alertStyles = {
  heat: "border-l-amber-500 bg-amber-500/5",
  rain: "border-l-blue-500 bg-blue-500/5",
  cold: "border-l-sky-500 bg-sky-500/5",
  stable: "border-l-emerald-500 bg-emerald-500/5",
};

const alertIcons = {
  heat: <Sun className="h-4 w-4 text-amber-500 shrink-0" />,
  rain: <CloudRain className="h-4 w-4 text-blue-500 shrink-0" />,
  cold: <Snowflake className="h-4 w-4 text-sky-500 shrink-0" />,
  stable: <Info className="h-4 w-4 text-emerald-500 shrink-0" />,
};

function DayCard({ day }: { day: DayForecast }) {
  return (
    <div className="flex flex-col items-center gap-1 min-w-[64px] p-2 rounded-lg bg-muted/40 shrink-0">
      <span className="text-xs font-semibold text-foreground">{day.dayName}</span>
      <span className="text-[10px] text-muted-foreground">
        {day.date.slice(8)}/{day.date.slice(5, 7)}
      </span>
      {getWeatherIcon(day.weatherCode)}
      <div className="flex items-center gap-1 text-xs">
        <span className="font-medium text-foreground">{day.tempMax}°</span>
        <span className="text-muted-foreground">{day.tempMin}°</span>
      </div>
      {day.precipProbability > 0 && (
        <div className="flex items-center gap-0.5 text-[10px] text-blue-500">
          <Droplets className="h-3 w-3" />
          {day.precipProbability}%
        </div>
      )}
      {day.humidity > 0 && (
        <span className="text-[10px] text-muted-foreground">{day.humidity}% umid.</span>
      )}
    </div>
  );
}

export function WeatherForecast() {
  const { weather, isLoading } = useWeatherForecast();
  const { organization } = useOrganization();
  const [modalOpen, setModalOpen] = useState(false);
  const { trackEvent } = useActivityTracker();

  const handleDownload = async (format: ArtFormat, period: ArtPeriod) => {
    if (!weather || !weather.days.length) return;
    try {
      const blob = await generateWeatherImage({
        city: weather.city,
        today: weather.days[0],
        days: weather.days,
        alert: weather.alert,
        logoUrl: organization?.logo_url,
        companyName: organization?.name,
        companyPhone: organization?.phone,
        format,
        period,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10);
      const formatLabel = format === "story" ? "story" : format === "whatsapp" ? "whatsapp" : "feed";
      a.download = `previsao-${weather.city.toLowerCase().replace(/\s+/g, "-")}-${formatLabel}-${period}-${dateStr}.png`;
      a.click();
      URL.revokeObjectURL(url);
      trackEvent("weather_art_generated");
      toast({ title: "Imagem gerada!", description: `Arte no formato ${formatLabel} (${period === "week" ? "semana" : "dia"}) baixada com sucesso.` });
    } catch {
      toast({ variant: "destructive", title: "Erro", description: "Não foi possível gerar a imagem." });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-[72px] shrink-0 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!weather) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2">
            <Thermometer className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Clima Operacional</CardTitle>
            <span className="text-xs text-muted-foreground hidden sm:inline">
              — {weather.city}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 w-full sm:w-auto"
            onClick={() => setModalOpen(true)}
          >
            <Download className="h-3.5 w-3.5" />
            Baixar arte promocional
          </Button>
        </div>
        {!weather.city && (
          <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            Configure o endereço da empresa nas configurações para ativar alertas da sua região.
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {weather.days.map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
        </div>
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border-l-4 p-3 text-sm",
            alertStyles[weather.alert.type]
          )}
        >
          {alertIcons[weather.alert.type]}
          <span className="text-foreground">{weather.alert.message}</span>
        </div>
        <p className="text-[11px] text-muted-foreground leading-snug">
          Use essa arte para postar nos Stories, Status ou enviar para clientes e gerar novas vendas automaticamente.
        </p>
      </CardContent>
      <WeatherDownloadModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        onDownload={handleDownload}
        city={weather.city}
        today={weather.days[0]}
        days={weather.days}
        alert={weather.alert}
        logoUrl={organization?.logo_url}
        companyName={organization?.name}
        companyPhone={organization?.phone}
      />
    </Card>
  );
}