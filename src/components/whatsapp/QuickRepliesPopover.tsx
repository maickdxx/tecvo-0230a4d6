import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Zap, Plus, Search, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface QuickRepliesPopoverProps {
  onSelect: (content: string) => void;
}

export function QuickRepliesPopover({ onSelect }: QuickRepliesPopoverProps) {
  const { organization } = useOrganization();
  const [replies, setReplies] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newShortcut, setNewShortcut] = useState("");

  const fetchReplies = async () => {
    if (!organization?.id) return;
    const { data } = await supabase
      .from("whatsapp_quick_messages")
      .select("*")
      .eq("organization_id", organization.id)
      .order("title");
    setReplies(data || []);
  };

  useEffect(() => { if (open) fetchReplies(); }, [open, organization?.id]);

  const filtered = replies.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    (r.shortcut || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim() || !organization?.id) return;
    await supabase.from("whatsapp_quick_messages").insert({
      organization_id: organization.id,
      title: newTitle.trim(),
      content: newContent.trim(),
      shortcut: newShortcut.trim() || null,
    });
    setNewTitle("");
    setNewContent("");
    setNewShortcut("");
    setDialogOpen(false);
    fetchReplies();
    toast.success("Resposta rápida criada");
  };

  const handleDelete = async (id: string) => {
    await supabase.from("whatsapp_quick_messages").delete().eq("id", id);
    fetchReplies();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 text-muted-foreground" title="Respostas rápidas">
          <Zap className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" side="top">
        <div className="p-2 border-b border-border flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar resposta..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-7 text-xs border-0 shadow-none focus-visible:ring-0 p-0"
          />
        </div>
        <div className="max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-3 text-center">Nenhuma resposta rápida</p>
          ) : (
            filtered.map(r => (
              <button
                key={r.id}
                onClick={() => { onSelect(r.content); setOpen(false); }}
                className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-start gap-2 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-foreground truncate">{r.title}</span>
                    {r.shortcut && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">/{r.shortcut}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">{r.content}</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(r.id); }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </button>
            ))
          )}
        </div>
        <div className="border-t border-border p-1.5">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full gap-1.5 text-xs h-7">
                <Plus className="h-3 w-3" /> Nova resposta rápida
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-base">Nova resposta rápida</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Título</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Orçamento" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Atalho (opcional)</Label>
                  <Input value={newShortcut} onChange={e => setNewShortcut(e.target.value)} placeholder="Ex: orcamento" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Mensagem</Label>
                  <Textarea value={newContent} onChange={e => setNewContent(e.target.value)} placeholder="Olá! Pode me enviar fotos..." className="mt-1 min-h-[80px]" />
                </div>
                <Button onClick={handleCreate} disabled={!newTitle.trim() || !newContent.trim()} className="w-full">
                  Criar resposta
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </PopoverContent>
    </Popover>
  );
}
