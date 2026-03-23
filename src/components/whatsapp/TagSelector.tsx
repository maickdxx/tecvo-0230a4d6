import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tag, Check, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWhatsAppTags, getTagColorStyle, AVAILABLE_TAG_COLORS, WhatsAppTag } from "@/hooks/useWhatsAppTags";
import { toast } from "sonner";

interface TagSelectorProps {
  currentTags: string[];
  onToggle: (tag: string) => void;
}

export function TagSelector({ currentTags, onToggle }: TagSelectorProps) {
  const [open, setOpen] = useState(false);
  const { tags, createTag } = useWhatsAppTags();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (tags.some(t => t.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error("Etiqueta já existe");
      return;
    }
    const tag = await createTag(newName.trim(), newColor);
    if (tag) {
      onToggle(tag.name);
      setNewName("");
      setCreating(false);
      toast.success("Etiqueta criada");
    } else {
      toast.error("Erro ao criar etiqueta");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7" title="Etiquetas">
          <Tag className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-1" align="start">
        <p className="text-[10px] font-medium text-muted-foreground px-2 py-1">Etiquetas</p>
        <div className="max-h-48 overflow-y-auto">
          {tags.map(tag => {
            const selected = currentTags.includes(tag.name);
            const style = getTagColorStyle(tag.color);
            return (
              <button
                key={tag.id}
                onClick={() => onToggle(tag.name)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                  selected ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <span className={cn("w-2.5 h-2.5 rounded-full", style.bg, "border", style.border)} />
                <span className="flex-1 text-left text-foreground">{tag.name}</span>
                {selected && <Check className="h-3 w-3 text-primary" />}
              </button>
            );
          })}
        </div>

        <div className="border-t border-border mt-1 pt-1">
          {creating ? (
            <div className="px-2 py-1.5 space-y-1.5">
              <Input
                placeholder="Nome da etiqueta"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                className="h-7 text-xs"
                autoFocus
                onKeyDown={e => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-1 flex-wrap">
                {AVAILABLE_TAG_COLORS.filter(c => c !== "gray").map(c => {
                  const s = getTagColorStyle(c);
                  return (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn(
                        "w-5 h-5 rounded-full border-2 transition-transform",
                        s.bg, s.border,
                        newColor === c ? "scale-125 ring-2 ring-primary/30" : ""
                      )}
                    />
                  );
                })}
              </div>
              <div className="flex gap-1">
                <Button size="sm" className="h-6 text-[10px] flex-1" onClick={handleCreate}>
                  Criar
                </Button>
                <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={() => setCreating(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-primary hover:bg-muted/50 transition-colors"
            >
              <Plus className="h-3 w-3" />
              Nova etiqueta
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
