import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Filter,
  X,
  Calendar,
  Globe,
  MousePointer2,
  Timer,
  Activity,
  ChevronDown,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export interface LeadFilters {
  search: string;
  source: string[];
  campaign: string[];
  dateFrom: string;
  dateTo: string;
  interest: "all" | "interested" | "visitor";
  signupStarted: boolean | null;
  signupCompleted: boolean | null;
  minPages: number | null;
  minDurationSeconds: number | null;
  minEvents: number | null;
}

export const defaultLeadFilters: LeadFilters = {
  search: "",
  source: [],
  campaign: [],
  dateFrom: "",
  dateTo: "",
  interest: "all",
  signupStarted: null,
  signupCompleted: null,
  minPages: null,
  minDurationSeconds: null,
  minEvents: null,
};

interface LeadFiltersProps {
  filters: LeadFilters;
  onChange: (filters: LeadFilters) => void;
  availableSources: string[];
  availableCampaigns: string[];
  resultCount: number;
}

export function LeadFiltersPanel({
  filters,
  onChange,
  availableSources,
  availableCampaigns,
  resultCount,
}: LeadFiltersProps) {
  const [open, setOpen] = useState(false);

  const activeCount = countActiveFilters(filters);

  const update = (partial: Partial<LeadFilters>) =>
    onChange({ ...filters, ...partial });

  const toggleArrayItem = (
    key: "source" | "campaign",
    item: string
  ) => {
    const current = filters[key];
    const next = current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];
    update({ [key]: next });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por ID ou origem..."
              className="pl-8"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
            />
          </div>
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="h-4 w-4" />
                Filtros
                {activeCount > 0 && (
                  <Badge className="h-5 min-w-5 px-1.5 text-[10px] bg-primary text-primary-foreground">
                    {activeCount}
                  </Badge>
                )}
                <ChevronDown
                  className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
                />
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          {activeCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 text-muted-foreground"
              onClick={() => onChange({ ...defaultLeadFilters })}
            >
              <RotateCcw className="h-3 w-3" /> Limpar
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {resultCount} lead{resultCount !== 1 ? "s" : ""} encontrado{resultCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Active filter badges */}
      {activeCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filters.source.map((s) => (
            <Badge
              key={`s-${s}`}
              variant="secondary"
              className="gap-1 text-[10px] cursor-pointer"
              onClick={() => toggleArrayItem("source", s)}
            >
              Origem: {s} <X className="h-3 w-3" />
            </Badge>
          ))}
          {filters.campaign.map((c) => (
            <Badge
              key={`c-${c}`}
              variant="secondary"
              className="gap-1 text-[10px] cursor-pointer"
              onClick={() => toggleArrayItem("campaign", c)}
            >
              Campanha: {c} <X className="h-3 w-3" />
            </Badge>
          ))}
          {filters.dateFrom && (
            <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => update({ dateFrom: "" })}>
              De: {filters.dateFrom} <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.dateTo && (
            <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => update({ dateTo: "" })}>
              Até: {filters.dateTo} <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.interest !== "all" && (
            <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => update({ interest: "all" })}>
              {filters.interest === "interested" ? "Interessados" : "Visitantes"} <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.signupStarted === true && (
            <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => update({ signupStarted: null })}>
              Iniciou cadastro <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.signupCompleted === true && (
            <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => update({ signupCompleted: null })}>
              Concluiu cadastro <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.minPages && (
            <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => update({ minPages: null })}>
              ≥{filters.minPages} páginas <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.minDurationSeconds && (
            <Badge variant="secondary" className="gap-1 text-[10px] cursor-pointer" onClick={() => update({ minDurationSeconds: null })}>
              ≥{Math.round(filters.minDurationSeconds / 60)}min <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}

      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 p-4 bg-muted/30 border rounded-lg">
            {/* Period */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" /> Período
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  className="text-xs h-8"
                  value={filters.dateFrom}
                  onChange={(e) => update({ dateFrom: e.target.value })}
                />
                <Input
                  type="date"
                  className="text-xs h-8"
                  value={filters.dateTo}
                  onChange={(e) => update({ dateTo: e.target.value })}
                />
              </div>
            </div>

            {/* Source */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5" /> Origem
              </Label>
              <div className="space-y-1.5 max-h-28 overflow-y-auto">
                {availableSources.length === 0 && (
                  <span className="text-[10px] text-muted-foreground">Nenhuma origem</span>
                )}
                {availableSources.map((src) => (
                  <label key={src} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={filters.source.includes(src)}
                      onCheckedChange={() => toggleArrayItem("source", src)}
                    />
                    <span className="capitalize">{src}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Interest */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <MousePointer2 className="h-3.5 w-3.5" /> Nível de Interesse
              </Label>
              <div className="space-y-1.5">
                {(["all", "interested", "visitor"] as const).map((val) => (
                  <label key={val} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox
                      checked={filters.interest === val}
                      onCheckedChange={() => update({ interest: val })}
                    />
                    <span>
                      {val === "all" ? "Todos" : val === "interested" ? "Interessados (clicou CTA)" : "Visitantes (sem CTA)"}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Engagement */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5" /> Engajamento
              </Label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={filters.signupStarted === true}
                    onCheckedChange={(c) => update({ signupStarted: c ? true : null })}
                  />
                  Iniciou cadastro
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={filters.signupCompleted === true}
                    onCheckedChange={(c) => update({ signupCompleted: c ? true : null })}
                  />
                  Concluiu cadastro
                </label>
              </div>
              <div className="space-y-1.5 pt-1">
                <Label className="text-[10px] text-muted-foreground">Mín. páginas</Label>
                <Input
                  type="number"
                  min={0}
                  className="text-xs h-7"
                  placeholder="Ex: 3"
                  value={filters.minPages ?? ""}
                  onChange={(e) => update({ minPages: e.target.value ? Number(e.target.value) : null })}
                />
                <Label className="text-[10px] text-muted-foreground">Mín. tempo (seg)</Label>
                <Input
                  type="number"
                  min={0}
                  className="text-xs h-7"
                  placeholder="Ex: 60"
                  value={filters.minDurationSeconds ?? ""}
                  onChange={(e) =>
                    update({
                      minDurationSeconds: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                />
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function countActiveFilters(f: LeadFilters): number {
  let n = 0;
  if (f.source.length) n++;
  if (f.campaign.length) n++;
  if (f.dateFrom) n++;
  if (f.dateTo) n++;
  if (f.interest !== "all") n++;
  if (f.signupStarted !== null) n++;
  if (f.signupCompleted !== null) n++;
  if (f.minPages) n++;
  if (f.minDurationSeconds) n++;
  if (f.minEvents) n++;
  return n;
}

export function applyLeadFilters(leads: any[], filters: LeadFilters): any[] {
  return leads.filter((lead) => {
    // Search
    if (filters.search) {
      const term = filters.search.toLowerCase();
      const matchId = lead.visitor_id?.toLowerCase().includes(term);
      const matchSource = lead.source?.toLowerCase().includes(term);
      if (!matchId && !matchSource) return false;
    }

    // Source
    if (filters.source.length > 0) {
      const src = (lead.source || "direto").toLowerCase();
      if (!filters.source.some((s) => s.toLowerCase() === src)) return false;
    }

    // Campaign
    if (filters.campaign.length > 0) {
      const camp = (lead.campaign || "").toLowerCase();
      if (!filters.campaign.some((c) => c.toLowerCase() === camp)) return false;
    }

    // Date range
    if (filters.dateFrom) {
      if (new Date(lead.last_seen) < new Date(filters.dateFrom)) return false;
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59, 999);
      if (new Date(lead.last_seen) > to) return false;
    }

    // Interest
    if (filters.interest === "interested" && !lead.clicked_cta) return false;
    if (filters.interest === "visitor" && lead.clicked_cta) return false;

    // Signup started/completed - check from metadata flags if available
    if (filters.signupStarted === true && !lead.signup_started) return false;
    if (filters.signupCompleted === true && !lead.signup_completed) return false;

    // Min pages
    if (filters.minPages && (lead.unique_pages || 0) < filters.minPages) return false;

    // Min duration
    if (filters.minDurationSeconds && ((lead as any).total_duration_seconds || 0) < filters.minDurationSeconds) return false;

    return true;
  });
}
