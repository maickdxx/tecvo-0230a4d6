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
    <div className="flex flex-col items-center gap-3 min-w-[76px] p-4 rounded-2xl bg-white border border-border/20 shadow-sm shrink-0 transition-all duration-300 hover:shadow-md hover:border-sky-200 group/day">
      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{day.dayName}</span>
      <span className="text-[9px] font-bold text-muted-foreground/30 -mt-2">
        {day.date.slice(8)}/{day.date.slice(5, 7)}
      </span>
      <div className="group-hover/day:scale-110 transition-transform duration-300">
        {getWeatherIcon(day.weatherCode)}
      </div>
      <div className="flex flex-col items-center">
        <span className="text-sm font-black text-foreground/80 tracking-tight">{day.tempMax}°</span>
        <span className="text-[9px] font-bold text-muted-foreground/40">{day.tempMin}°</span>
      </div>
      {day.precipProbability > 0 && (
        <div className="flex items-center gap-1 text-[9px] font-black text-sky-500/80 uppercase">
          <Droplets className="h-2.5 w-2.5" />
          {day.precipProbability}%
        </div>
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
    <Card className="overflow-hidden rounded-[2rem] border-border/40 shadow-[0_8px_30px_rgb(0,0,0,0.03)] bg-gradient-to-br from-sky-50/50 via-white to-transparent transition-all duration-500 hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] group">
      <CardHeader className="pb-6 px-8 pt-8 bg-muted/[0.05] border-b border-border/10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-sky-100/50 shadow-sm ring-4 ring-sky-50/20 group-hover:scale-110 transition-transform duration-500">
              <Thermometer className="h-4 w-4 text-sky-600" />
            </div>
            <div>
              <CardTitle className="text-[11px] font-black uppercase tracking-[0.25em] text-muted-foreground/60">Clima Operacional</CardTitle>
              <span className="text-[10px] font-bold text-muted-foreground/40 uppercase tracking-widest mt-0.5 block">
                {weather.city}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-[10px] font-black uppercase tracking-wider gap-2 px-4 rounded-xl border-border/40 hover:bg-background hover:shadow-md transition-all duration-300 w-full sm:w-auto"
            onClick={() => setModalOpen(true)}
          >
            <Download className="h-3.5 w-3.5 text-primary/60" />
            Arte Promocional
          </Button>
        </div>
        {!weather.city && (
          <div className="flex items-center gap-2 mt-3 p-2.5 rounded-xl bg-amber-50/50 border border-amber-100/50 text-[10px] font-bold text-amber-600/80 uppercase tracking-wide">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            Ative a localização para alertas precisos.
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6 p-8 bg-gradient-to-b from-transparent to-muted/[0.02]">
        <div className="flex gap-4 overflow-x-auto pb-2 -mx-2 px-2 max-w-full custom-scrollbar">
          {weather.days.map((day) => (
            <DayCard key={day.date} day={day} />
          ))}
        </div>
        
        <div
          className={cn(
            "flex items-center gap-4 rounded-2xl border-l-[6px] p-5 shadow-sm transition-all duration-300 group-hover:shadow-md",
            alertStyles[weather.alert.type]
          )}
        >
          <div className="p-2.5 rounded-xl bg-white/50 shadow-sm ring-4 ring-black/[0.01]">
            {alertIcons[weather.alert.type]}
          </div>
          <div className="space-y-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-foreground/40">Alerta Inteligente</p>
            <p className="text-[13px] font-bold text-foreground/70 leading-relaxed tracking-tight">{weather.alert.message}</p>
          </div>
        </div>
        
        <p className="text-[11px] text-muted-foreground/40 leading-relaxed font-medium italic text-center px-4">
          "Utilize o clima a seu favor. Gere artes automáticas e antecipe agendamentos para manter a agenda cheia mesmo em dias de chuva."
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