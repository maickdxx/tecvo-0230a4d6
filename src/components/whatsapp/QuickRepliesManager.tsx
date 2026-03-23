import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Pencil, Copy, MessageSquareText, Zap, X } from "lucide-react";
import { toast } from "sonner";
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
  const [creating, setCreating] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuickReply | null>(null);

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
    const { data } = await supabase
      .from("whatsapp_quick_messages")
      .select("id, title, content, shortcut")
      .eq("organization_id", organization.id)
      .order("title");
    setReplies((data as QuickReply[]) || []);
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

  const content = (
    <div className="space-y-4">
      {embedded && (
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <MessageSquareText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground">Respostas rápidas</h2>
            <p className="text-xs text-muted-foreground">Modelos de mensagem para agilizar o atendimento</p>
          </div>
        </div>
      )}

      {/* Reply cards */}
      <div className="space-y-3">
        {replies.length === 0 && !creating && (
          <div className="text-center py-10">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
              <MessageSquareText className="h-6 w-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma resposta rápida</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Crie modelos para responder com mais agilidade</p>
          </div>
        )}

        {replies.map((r) => (
          <div
            key={r.id}
            className="group rounded-xl border border-border/60 bg-card hover:border-border hover:shadow-sm transition-all p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-foreground">{r.title}</span>
                  {r.shortcut && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-primary bg-primary/8 px-1.5 py-0.5 rounded-md border border-primary/15">
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
        ))}
      </div>

      {/* Create inline form */}
      {creating && (
        <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Nova resposta rápida</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setCreating(false); resetForm(); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="grid gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Título</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} placeholder="Ex: Orçamento" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Atalho (opcional)</Label>
              <Input value={formShortcut} onChange={(e) => setFormShortcut(e.target.value)} placeholder="Ex: orcamento" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Mensagem</Label>
              <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} placeholder="Olá! Pode me enviar fotos..." className="mt-1 min-h-[80px]" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleCreate} disabled={!formTitle.trim() || !formContent.trim()} className="flex-1" size="sm">
              Salvar
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); resetForm(); }}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {!creating && (
        <Button variant="outline" className="w-full gap-1.5" onClick={() => { resetForm(); setCreating(true); }}>
          <Plus className="h-4 w-4" /> Nova resposta rápida
        </Button>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editingReply} onOpenChange={(v) => { if (!v) { setEditingReply(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar resposta rápida</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Título</Label>
              <Input value={formTitle} onChange={(e) => setFormTitle(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Atalho (opcional)</Label>
              <Input value={formShortcut} onChange={(e) => setFormShortcut(e.target.value)} placeholder="Ex: orcamento" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Mensagem</Label>
              <Textarea value={formContent} onChange={(e) => setFormContent(e.target.value)} className="mt-1 min-h-[100px]" />
            </div>
            <Button className="w-full" onClick={handleEdit} disabled={!formTitle.trim() || !formContent.trim()}>
              Salvar alterações
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

  if (embedded) return content;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Respostas rápidas</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
