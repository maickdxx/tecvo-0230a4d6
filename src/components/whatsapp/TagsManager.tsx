import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWhatsAppTags, getTagColorStyle, AVAILABLE_TAG_COLORS, WhatsAppTag } from "@/hooks/useWhatsAppTags";
import { Pencil, Trash2, Plus, Check, X, Tag, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TagsManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean;
}

export function TagsManager({ open, onOpenChange, embedded }: TagsManagerProps) {
  const { tags, createTag, updateTag, deleteTag, loading } = useWhatsAppTags();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<WhatsAppTag | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    if (tags.some(t => t.name.toLowerCase() === newName.trim().toLowerCase())) {
      toast.error("Etiqueta já existe");
      return;
    }
    const tag = await createTag(newName.trim(), newColor);
    if (tag) {
      setNewName("");
      setCreating(false);
      toast.success("Etiqueta criada");
    } else {
      toast.error("Erro ao criar etiqueta");
    }
  };

  const handleUpdate = async (id: string) => {
    if (!editName.trim()) return;
    const existing = tags.find(t => t.name.toLowerCase() === editName.trim().toLowerCase() && t.id !== id);
    if (existing) {
      toast.error("Já existe uma etiqueta com esse nome");
      return;
    }
    const ok = await updateTag(id, editName.trim(), editColor);
    if (ok) {
      setEditingId(null);
      toast.success("Etiqueta atualizada");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteTag(deleteTarget);
    setDeleteTarget(null);
    toast.success("Etiqueta removida");
  };

  const startEdit = (tag: WhatsAppTag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const filteredTags = tags.filter(t =>
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ColorPicker = ({ value, onChange }: { value: string; onChange: (c: string) => void }) => (
    <div className="flex gap-1.5 flex-wrap">
      {AVAILABLE_TAG_COLORS.filter(c => c !== "gray").map(c => {
        const s = getTagColorStyle(c);
        return (
          <button
            key={c}
            onClick={() => onChange(c)}
            className={cn(
              "w-7 h-7 rounded-full border-2 transition-all",
              s.bg, s.border,
              value === c ? "scale-110 ring-2 ring-primary/30 ring-offset-1 ring-offset-background" : "hover:scale-105"
            )}
          />
        );
      })}
    </div>
  );

  const innerContent = (
    <div className="space-y-4">
      {/* Search + summary */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar etiqueta..."
            className="pl-9 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {!searchTerm && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Tag className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {tags.length} {tags.length === 1 ? "etiqueta" : "etiquetas"}
              </p>
              <p className="text-xs text-muted-foreground">
                Organize seus contatos com categorias
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => { setCreating(true); setSearchTerm(""); }}
            >
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          </div>
        )}
      </div>

      {/* Tags list */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : filteredTags.length === 0 && !creating ? (
          <div className="text-center py-12 px-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
              <Tag className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {searchTerm ? "Nenhuma etiqueta encontrada" : "Nenhuma etiqueta criada"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchTerm ? "Tente buscar por outro nome." : "Crie etiquetas para categorizar seus contatos."}
            </p>
            {!searchTerm && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => setCreating(true)}
              >
                <Plus className="h-3.5 w-3.5" /> Criar primeira etiqueta
              </Button>
            )}
          </div>
        ) : (
          filteredTags.map(tag => {
            const style = getTagColorStyle(tag.color);
            const isEditing = editingId === tag.id;

            if (isEditing) {
              return (
                <div key={tag.id} className="rounded-xl border-2 border-primary/30 bg-card p-4 space-y-3 shadow-sm">
                  <Input
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    className="h-9"
                    autoFocus
                    onKeyDown={e => e.key === "Enter" && handleUpdate(tag.id)}
                  />
                  <ColorPicker value={editColor} onChange={setEditColor} />
                  <div className="flex gap-2">
                    <Button size="sm" className="gap-1" onClick={() => handleUpdate(tag.id)}>
                      <Check className="h-3.5 w-3.5" /> Salvar
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={tag.id}
                className="group flex items-center gap-3 rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all duration-200 px-4 py-3"
              >
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border",
                    style.bg, style.text, style.border
                  )}
                >
                  <span className={cn("w-2.5 h-2.5 rounded-full", style.bg)} />
                  {tag.name}
                </span>
                <div className="flex-1" />
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => startEdit(tag)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(tag)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Create new */}
      {creating && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Nova etiqueta</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCreating(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Input
            placeholder="Nome da etiqueta"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            autoFocus
            className="h-10"
            onKeyDown={e => e.key === "Enter" && handleCreate()}
          />
          <ColorPicker value={newColor} onChange={setNewColor} />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1 gap-1.5" onClick={handleCreate}>
              <Check className="h-3.5 w-3.5" /> Criar etiqueta
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>Cancelar</Button>
          </div>
        </div>
      )}

      {/* Floating create button when search has no results but not showing empty state */}
      {!creating && searchTerm && filteredTags.length > 0 && (
        <Button variant="outline" className="w-full gap-1.5" onClick={() => { setCreating(true); setSearchTerm(""); }}>
          <Plus className="h-4 w-4" /> Nova etiqueta
        </Button>
      )}
    </div>
  );

  const deleteDialog = (
    <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Apagar etiqueta</AlertDialogTitle>
          <AlertDialogDescription>
            A etiqueta "{deleteTarget?.name}" será removida de todos os contatos que a utilizam. Esta ação não pode ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Apagar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  if (embedded) {
    return (
      <>
        <div className="bg-card rounded-2xl border p-6 shadow-sm max-w-lg">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
              <Tag className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
                Etiquetas
              </h2>
              <p className="text-sm text-muted-foreground">Organize seus contatos com categorias</p>
            </div>
          </div>
          {innerContent}
        </div>
        {deleteDialog}
      </>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md p-6 gap-0">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Tag className="h-5 w-5" />
              </div>
              Etiquetas
            </DialogTitle>
          </DialogHeader>
          {innerContent}
        </DialogContent>
      </Dialog>
      {deleteDialog}
    </>
  );
}
