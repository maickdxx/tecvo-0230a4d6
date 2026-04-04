import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MESSAGE_VARIABLES,
  getVariablesByCategory,
  CATEGORY_LABELS,
  previewWithExamples,
  findInvalidVariables,
  type VariableCategory,
  type MessageVariable,
} from "@/lib/messageVariables";
import { Braces, Search, AlertTriangle, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface VariableInsertButtonProps {
  /** Called when user picks a variable — receives the tag e.g. "{{primeiro_nome}}" */
  onInsert: (tag: string) => void;
  /** Compact mode for tight layouts */
  compact?: boolean;
  className?: string;
}

export function VariableInsertButton({ onInsert, compact, className }: VariableInsertButtonProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const grouped = getVariablesByCategory();

  const filtered = search.trim()
    ? MESSAGE_VARIABLES.filter(
        (v) =>
          v.label.toLowerCase().includes(search.toLowerCase()) ||
          v.key.toLowerCase().includes(search.toLowerCase())
      )
    : null;

  const handleSelect = (v: MessageVariable) => {
    onInsert(`{{${v.key}}}`);
    setOpen(false);
    setSearch("");
  };

  const categories = Object.keys(grouped) as VariableCategory[];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn("h-7 gap-1.5 text-[11px]", className)}
        >
          <Braces className="h-3.5 w-3.5" />
          {!compact && "Variável"}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 p-0 max-h-80 overflow-hidden flex flex-col"
        align="start"
        side="top"
        sideOffset={6}
      >
        {/* Search */}
        <div className="p-2 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar variável..."
              className="h-8 pl-7 text-xs"
              autoFocus
            />
          </div>
        </div>

        {/* Variable list */}
        <div className="overflow-y-auto flex-1 p-1">
          {filtered ? (
            filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma variável encontrada</p>
            ) : (
              <div className="space-y-0.5">
                {filtered.map((v) => (
                  <VariableRow key={v.key} variable={v} onSelect={handleSelect} />
                ))}
              </div>
            )
          ) : (
            categories.map((cat) => (
              <div key={cat} className="mb-1">
                <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-1.5 sticky top-0 bg-popover z-10">
                  {CATEGORY_LABELS[cat]}
                </p>
                <div className="space-y-0.5">
                  {grouped[cat].map((v) => (
                    <VariableRow key={v.key} variable={v} onSelect={handleSelect} />
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function VariableRow({ variable, onSelect }: { variable: MessageVariable; onSelect: (v: MessageVariable) => void }) {
  return (
    <button
      onClick={() => onSelect(variable)}
      className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted/60 transition-colors"
    >
      <code className="text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded shrink-0">
        {`{{${variable.key}}}`}
      </code>
      <span className="text-xs text-foreground truncate flex-1">{variable.label}</span>
    </button>
  );
}

/** Inline warning for invalid variables in a message */
export function VariableValidation({ message }: { message: string }) {
  const invalid = findInvalidVariables(message);
  if (invalid.length === 0) return null;

  return (
    <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded-md bg-destructive/10 border border-destructive/20">
      <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
      <div>
        <p className="text-[10px] font-medium text-destructive">
          {invalid.length === 1 ? "Variável inválida:" : "Variáveis inválidas:"}
        </p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          {invalid.map((k) => (
            <code key={k} className="text-[10px] font-mono bg-destructive/10 text-destructive px-1 rounded">
              {`{{${k}}}`}
            </code>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Small preview toggle that shows resolved message with example data */
export function MessagePreviewToggle({ message }: { message: string }) {
  const [showPreview, setShowPreview] = useState(false);
  const hasVars = /\{\{\w+\}\}/.test(message);

  if (!hasVars) return null;

  const preview = previewWithExamples(message);

  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setShowPreview(!showPreview)}
        className="flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 transition-colors"
      >
        <Eye className="h-3 w-3" />
        {showPreview ? "Ocultar pré-visualização" : "Pré-visualizar"}
      </button>
      {showPreview && (
        <div className="mt-1 p-2.5 rounded-lg bg-muted/50 border border-border">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Exemplo:</p>
          <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">{preview}</p>
        </div>
      )}
    </div>
  );
}
