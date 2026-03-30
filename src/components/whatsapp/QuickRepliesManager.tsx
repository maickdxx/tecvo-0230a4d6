import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Copy, MessageSquareText, Zap, X, Search, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface QuickReply {
  id: string;
  title: string;
  content: string;
  shortcut: string | null;
}

interface QuickRepliesManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  embedded?: boolean;
}

export function QuickRepliesManager({ open, onOpenChange, embedded }: QuickRepliesManagerProps) {
  const { organization } = useOrganization();
  const [replies, setReplies] = useState<QuickReply[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuickReply | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Form state
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formShortcut, setFormShortcut] = useState("");

  const resetForm = () => {
    setFormTitle("");
    setFormContent("");
    setFormShortcut("");
  };

  const fetchReplies = async () => {
    if (!organization?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("whatsapp_quick_messages")
      .select("id, title, content, shortcut")
      .eq("organization_id", organization.id)
      .order("title");
    setReplies((data as QuickReply[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    if (open || embedded) fetchReplies();
  }, [open, embedded, organization?.id]);

  const handleCreate = async () => {
    if (!formTitle.trim() || !formContent.trim() || !organization?.id) return;
    await supabase.from("whatsapp_quick_messages").insert({
      organization_id: organization.id,
      title: formTitle.trim(),
      content: formContent.trim(),
      shortcut: formShortcut.trim() || null,
    });
    resetForm();
    setCreating(false);
    fetchReplies();
    toast.success("Resposta rápida criada");
  };

  const handleEdit = async () => {
    if (!editingReply || !formTitle.trim() || !formContent.trim()) return;
    await supabase
      .from("whatsapp_quick_messages")
      .update({
        title: formTitle.trim(),
        content: formContent.trim(),
        shortcut: formShortcut.trim() || null,
      })
      .eq("id", editingReply.id);
    setEditingReply(null);
    resetForm();
    fetchReplies();
    toast.success("Resposta rápida atualizada");
  };

  const handleDuplicate = async (reply: QuickReply) => {
    if (!organization?.id) return;
    await supabase.from("whatsapp_quick_messages").insert({
      organization_id: organization.id,
      title: `${reply.title} (cópia)`,
      content: reply.content,
      shortcut: null,
    });
    fetchReplies();
    toast.success("Resposta duplicada");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await supabase.from("whatsapp_quick_messages").delete().eq("id", deleteTarget.id);
    setDeleteTarget(null);
    fetchReplies();
    toast.success("Resposta removida");
  };

  const startEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setFormTitle(reply.title);
    setFormContent(reply.content);
    setFormShortcut(reply.shortcut || "");
  };

  const filtered = replies.filter(r =>
    r.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const innerContent = (
    <div className="space-y-4">
      {/* Search + summary */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar resposta rápida..."
            className="pl-9 h-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {!searchTerm && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <MessageSquareText className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">
                {replies.length} {replies.length === 1 ? "resposta" : "respostas"}
              </p>
              <p className="text-xs text-muted-foreground">
                Modelos para agilizar atendimento
              </p>
            </div>
            <Button
              size="sm"
              className="gap-1.5 shrink-0"
              onClick={() => { resetForm(); setCreating(true); setSearchTerm(""); }}
            >
              <Plus className="h-3.5 w-3.5" /> Nova
            </Button>
          </div>
        )}
      </div>

      {/* Reply cards */}
      <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
        {loading ? (
          <div className="space-y-2 py-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-[72px] rounded-xl bg-muted/30 animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 && !creating ? (
          <div className="text-center py-12 px-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mb-3">
              <MessageSquareText className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {searchTerm ? "Nenhuma resposta encontrada" : "Nenhuma resposta rápida"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              {searchTerm ? "Tente buscar por outro termo." : "Crie modelos para responder com mais agilidade."}
            </p>
            {!searchTerm && (
              <Button
                variant="outline"
                size="sm"
                className="mt-4 gap-1.5"
                onClick={() => { resetForm(); setCreating(true); }}
              >
                <Plus className="h-3.5 w-3.5" /> Criar primeira resposta
              </Button>
            )}
          </div>
        ) : (
          filtered.map((r) => (
            <div
              key={r.id}
              className="group rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all duration-200 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{r.title}</span>
                    {r.shortcut && (
                      <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded-md border border-primary/15">
                        <Zap className="h-2.5 w-2.5" />
                        /{r.shortcut}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {r.content}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => startEdit(r)}
                    title="Editar"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleDuplicate(r)}
                    title="Duplicar"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setDeleteTarget(r)}
                    title="Excluir"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create inline form */}
      {creating && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-card p-4 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Nova resposta rápida</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setCreating(false); resetForm(); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Orçamento" className="mt-1 h-10" autoFocus />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Atalho (opcional)</Label>
              <Input value={formShortcut} onChange={(e) => setFormShortcut(e.target.value)} placeholder="Ex: orcamento" className="mt-1 h-10" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="Olá! Segue nosso orçamento..." className="mt-1 min-h-[80px]" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!formTitle.trim() || !formContent.trim()} className="flex-1 gap-1.5" size="sm">
              <Check className="h-3.5 w-3.5" /> Criar resposta
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setCreating(false); resetForm(); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!creating && searchTerm && filtered.length > 0 && (
        <Button variant="outline" className="w-full gap-1.5" onClick={() => { resetForm(); setCreating(true); setSearchTerm(""); }}>
          <Plus className="h-4 w-4" /> Nova resposta rápida
        </Button>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingReply} onOpenChange={(v) => { if (!v) { setEditingReply(null); resetForm(); } }}>
        <DialogContent className="max-w-md p-6 gap-0">
          <DialogHeader className="mb-6">
            <DialogTitle className="flex items-center gap-3 text-xl font-bold">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Pencil className="h-5 w-5" />
              </div>
              Editar resposta
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="mt-1 h-10" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Atalho (opcional)</Label>
              <Input value={formShortcut} onChange={(e) => setFormShortcut(e.target.value)} placeholder="Ex: orcamento" className="mt-1 h-10" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} className="mt-1 min-h-[100px]" />
            </div>
            <Button className="w-full gap-1.5" onClick={handleEdit} disabled={!formTitle.trim() || !formContent.trim()}>
              <Check className="h-4 w-4" /> Salvar alterações
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta rápida</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{deleteTarget?.title}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) {
    return (
      <div className="bg-card rounded-2xl border p-6 shadow-sm max-w-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <MessageSquareText className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground leading-tight">
              Respostas rápidas
            </h2>
            <p className="text-sm text-muted-foreground">Modelos de mensagem para agilizar o atendimento</p>
          </div>
        </div>
        {innerContent}
      </div>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 gap-0">
        <DialogHeader className="mb-6">
          <DialogTitle className="flex items-center gap-3 text-xl font-bold">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <MessageSquareText className="h-5 w-5" />
            </div>
            Respostas rápidas
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">{innerContent}</div>
      </DialogContent>
    </Dialog>
  );
}
