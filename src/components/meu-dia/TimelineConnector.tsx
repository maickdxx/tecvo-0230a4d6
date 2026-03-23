import { Car } from "lucide-react";

interface Props {
  distanceKm?: number;
  timeMin?: number;
}

export function TimelineConnector({ distanceKm, timeMin }: Props) {
  return (
    <div className="flex items-center gap-2 py-1.5 pl-6">
      {/* Vertical line */}
      <div className="w-px h-8 bg-border ml-3" />
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-full px-3 py-1">
        <Car className="h-3 w-3" />
        {distanceKm !== undefined && timeMin !== undefined ? (
          <span>{distanceKm} km • ~{timeMin} min</span>
        ) : (
          <span className="text-muted-foreground/50">Calculando rota…</span>
        )}
      </div>
    </div>
  );
}
