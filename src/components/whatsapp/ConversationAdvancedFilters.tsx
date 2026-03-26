import { useState, useEffect } from "react";
import {
  Filter,
  X,
  Calendar,
  User,
  Radio,
  Tag,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { WhatsAppTag, getTagColorStyle } from "@/hooks/useWhatsAppTags";

const STORAGE_KEY = "tecvo_whatsapp_filters";

export type PeriodFilter = "all" | "today" | "yesterday" | "7d" | "30d" | "custom";

export interface AdvancedFilters {
  channelId: string | null;
  assignedTo: string | null;
  tags: string[];
  period: PeriodFilter;
  periodStart?: string;
  periodEnd?: string;
}

export const EMPTY_FILTERS: AdvancedFilters = {
  channelId: null,
  assignedTo: null,
  tags: [],
  period: "all",
};

export function hasActiveFilters(f: AdvancedFilters): boolean {
  return !!(f.channelId || f.assignedTo || f.tags.length > 0 || f.period !== "all");
}

export function countActiveFilters(f: AdvancedFilters): number {
  let n = 0;
  if (f.channelId) n++;
  if (f.assignedTo) n++;
  if (f.tags.length > 0) n++;
  if (f.period !== "all") n++;
  return n;
}

export function loadFiltersFromStorage(): AdvancedFilters {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY_FILTERS, ...JSON.parse(raw) };
  } catch {}
  return { ...EMPTY_FILTERS };
}

export function saveFiltersToStorage(f: AdvancedFilters) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {}
}

interface Props {
  filters: AdvancedFilters;
  onChange: (f: AdvancedFilters) => void;
  channels: { id: string; name: string; phone_number: string }[];
  teamMembers: { user_id: string; full_name: string | null }[];
  orgTags: WhatsAppTag[];
}

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  all: "Qualquer período",
  today: "Hoje",
  yesterday: "Ontem",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  custom: "Personalizado",
};

export function ConversationAdvancedFilters({
  filters,
  onChange,
  channels,
  teamMembers,
  orgTags,
}: Props) {
  const [open, setOpen] = useState(false);
  const active = hasActiveFilters(filters);
  const activeCount = countActiveFilters(filters);

  const update = (patch: Partial<AdvancedFilters>) => {
    const next = { ...filters, ...patch };
    onChange(next);
    saveFiltersToStorage(next);
  };

  const clearAll = () => {
    onChange({ ...EMPTY_FILTERS });
    saveFiltersToStorage(EMPTY_FILTERS);
  };

  const toggleTag = (tagName: string) => {
    const next = filters.tags.includes(tagName)
      ? filters.tags.filter((t) => t !== tagName)
      : [...filters.tags, tagName];
    update({ tags: next });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted"
          )}
        >
          <Filter className="h-3 w-3" />
          Filtros
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] rounded-full px-1.5 min-w-[18px] text-center">
              {activeCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" sideOffset={4}>
        <div className="p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Filtros avançados</span>
            {active && (
              <button
                onClick={clearAll}
                className="text-[10px] text-destructive hover:underline"
              >
                Limpar tudo
              </button>
            )}
          </div>

          <Separator />

          {/* Channel */}
          {channels.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Radio className="h-3 w-3" /> Canal
              </label>
              <Select
                value={filters.channelId || "__all__"}
                onValueChange={(v) => update({ channelId: v === "__all__" ? null : v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos os canais" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os canais</SelectItem>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name || ch.phone_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Responsible */}
          {teamMembers.length > 1 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <User className="h-3 w-3" /> Responsável
              </label>
              <Select
                value={filters.assignedTo || "__all__"}
                onValueChange={(v) => update({ assignedTo: v === "__all__" ? null : v })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="__unassigned__">Sem responsável</SelectItem>
                  {teamMembers.map((m) => (
                    <SelectItem key={m.user_id} value={m.user_id}>
                      {m.full_name || "Sem nome"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Period */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" /> Período
            </label>
            <Select
              value={filters.period}
              onValueChange={(v) => update({ period: v as PeriodFilter })}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PERIOD_LABELS) as PeriodFilter[])
                  .filter((k) => k !== "custom") // custom not implemented yet
                  .map((k) => (
                    <SelectItem key={k} value={k}>
                      {PERIOD_LABELS[k]}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          {orgTags.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                <Tag className="h-3 w-3" /> Etiquetas
              </label>
              <div className="flex flex-wrap gap-1">
                {orgTags.map((tag) => {
                  const style = getTagColorStyle(tag.color);
                  const isSelected = filters.tags.includes(tag.name);
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.name)}
                      className={cn(
                        "inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-all",
                        isSelected
                          ? `${style.bg} ${style.text} ${style.border} ring-1 ring-primary/30`
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      {tag.name}
                      {isSelected && <X className="h-2 w-2" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Active filter chips row */
export function ActiveFilterChips({
  filters,
  onChange,
  channels,
  teamMembers,
  orgTags,
}: Props) {
  if (!hasActiveFilters(filters)) return null;

  const chips: { key: string; label: string; onRemove: () => void; color?: string }[] = [];

  if (filters.channelId) {
    const ch = channels.find((c) => c.id === filters.channelId);
    chips.push({
      key: "channel",
      label: `Canal: ${ch?.name || ch?.phone_number || "?"}`,
      onRemove: () => {
        const next = { ...filters, channelId: null };
        onChange(next);
        saveFiltersToStorage(next);
      },
    });
  }

  if (filters.assignedTo) {
    const label =
      filters.assignedTo === "__unassigned__"
        ? "Sem responsável"
        : teamMembers.find((m) => m.user_id === filters.assignedTo)?.full_name || "Responsável";
    chips.push({
      key: "assigned",
      label: `Resp: ${label}`,
      onRemove: () => {
        const next = { ...filters, assignedTo: null };
        onChange(next);
        saveFiltersToStorage(next);
      },
    });
  }

  if (filters.period !== "all") {
    chips.push({
      key: "period",
      label: PERIOD_LABELS[filters.period],
      onRemove: () => {
        const next = { ...filters, period: "all" as PeriodFilter };
        onChange(next);
        saveFiltersToStorage(next);
      },
    });
  }

  filters.tags.forEach((tagName) => {
    const tag = orgTags.find((t) => t.name === tagName);
    chips.push({
      key: `tag-${tagName}`,
      label: tagName,
      color: tag?.color,
      onRemove: () => {
        const next = { ...filters, tags: filters.tags.filter((t) => t !== tagName) };
        onChange(next);
        saveFiltersToStorage(next);
      },
    });
  });

  return (
    <div className="px-3 pb-1.5 flex items-center gap-1 flex-wrap">
      {chips.map((chip) => {
        const style = chip.color ? getTagColorStyle(chip.color) : null;
        return (
          <button
            key={chip.key}
            onClick={chip.onRemove}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
              style
                ? `${style.bg} ${style.text} ${style.border}`
                : "bg-primary/10 text-primary border-primary/20"
            )}
          >
            {chip.label}
            <X className="h-2.5 w-2.5" />
          </button>
        );
      })}
    </div>
  );
}

/** Filter contacts array by advanced filters */
export function applyAdvancedFilters(
  contacts: any[],
  filters: AdvancedFilters
): any[] {
  if (!hasActiveFilters(filters)) return contacts;

  return contacts.filter((c) => {
    // Channel filter
    if (filters.channelId && c.channel_id !== filters.channelId) return false;

    // Assigned filter
    if (filters.assignedTo) {
      if (filters.assignedTo === "__unassigned__") {
        if (c.assigned_to) return false;
      } else {
        if (c.assigned_to !== filters.assignedTo) return false;
      }
    }

    // Tags filter (OR logic — contact must have at least one of the selected tags)
    if (filters.tags.length > 0) {
      const cTags: string[] = c.tags || [];
      if (!filters.tags.some((tf) => cTags.includes(tf))) return false;
    }

    // Period filter
    if (filters.period !== "all" && c.last_message_at) {
      const msgDate = new Date(c.last_message_at);
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (filters.period) {
        case "today":
          if (msgDate < startOfToday) return false;
          break;
        case "yesterday": {
          const startOfYesterday = new Date(startOfToday);
          startOfYesterday.setDate(startOfYesterday.getDate() - 1);
          if (msgDate < startOfYesterday || msgDate >= startOfToday) return false;
          break;
        }
        case "7d": {
          const sevenDaysAgo = new Date(startOfToday);
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          if (msgDate < sevenDaysAgo) return false;
          break;
        }
        case "30d": {
          const thirtyDaysAgo = new Date(startOfToday);
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
          if (msgDate < thirtyDaysAgo) return false;
          break;
        }
      }
    }

    return true;
  });
}
