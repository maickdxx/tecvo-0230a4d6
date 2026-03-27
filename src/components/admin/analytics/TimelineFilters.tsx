import { useState } from "react";
import { Filter, X, ChevronDown, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface TimelineFilterState {
  showPageViews: boolean;
  showInteractions: boolean;
  showCTAClicks: boolean;
  showSignup: boolean;
  showPayment: boolean;
}

export const defaultTimelineFilters: TimelineFilterState = {
  showPageViews: true,
  showInteractions: true,
  showCTAClicks: true,
  showSignup: true,
  showPayment: true,
};

interface TimelineFiltersProps {
  filters: TimelineFilterState;
  onChange: (filters: TimelineFilterState) => void;
  totalEvents: number;
  filteredEvents: number;
}

const EVENT_CATEGORIES = [
  { key: "showPageViews" as const, label: "Visualizações de página", color: "bg-primary" },
  { key: "showInteractions" as const, label: "Interações", color: "bg-amber-500" },
  { key: "showCTAClicks" as const, label: "Cliques em CTA", color: "bg-blue-500" },
  { key: "showSignup" as const, label: "Cadastro", color: "bg-green-500" },
  { key: "showPayment" as const, label: "Pagamento", color: "bg-emerald-600" },
];

export function TimelineFiltersPanel({
  filters,
  onChange,
  totalEvents,
  filteredEvents,
}: TimelineFiltersProps) {
  const [open, setOpen] = useState(false);
  const allOn = Object.values(filters).every(Boolean);
  const activeCount = Object.values(filters).filter((v) => !v).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Collapsible open={open} onOpenChange={setOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 h-7 text-xs">
              <Filter className="h-3 w-3" />
              Filtrar eventos
              {activeCount > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary text-primary-foreground">
                  {activeCount}
                </Badge>
              )}
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} />
            </Button>
          </CollapsibleTrigger>
        </Collapsible>
        {!allOn && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {filteredEvents}/{totalEvents} eventos
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2 text-muted-foreground"
              onClick={() => onChange({ ...defaultTimelineFilters })}
            >
              <RotateCcw className="h-2.5 w-2.5" /> Resetar
            </Button>
          </div>
        )}
      </div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent>
          <div className="flex flex-wrap gap-3 p-3 bg-muted/30 border rounded-lg">
            {EVENT_CATEGORIES.map((cat) => (
              <label key={cat.key} className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox
                  checked={filters[cat.key]}
                  onCheckedChange={(checked) =>
                    onChange({ ...filters, [cat.key]: !!checked })
                  }
                />
                <span className={`h-2 w-2 rounded-full ${cat.color}`} />
                {cat.label}
              </label>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export function filterTimelineEvents(
  events: any[],
  filters: TimelineFilterState
): any[] {
  return events.filter((e) => {
    const type = e.event_type;
    if (!filters.showPageViews && (type === "page_view" || type === "landing_page_view")) return false;
    if (!filters.showInteractions && type === "interaction") return false;
    if (!filters.showCTAClicks && type === "create_account_click") return false;
    if (!filters.showSignup && (type === "signup_started" || type === "signup_completed")) return false;
    if (!filters.showPayment && (type === "payment_initiated" || type === "payment_completed")) return false;
    return true;
  });
}
