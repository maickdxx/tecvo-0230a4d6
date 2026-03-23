import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronRight, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTransactionCategories, type CategoryType, type TransactionCategory, type GroupedCategory } from "@/hooks/useTransactionCategories";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface TransactionCategoriesSettingsProps {
  onBack: () => void;
}

function SettingsCategoryList({
  groupedCategories,
  type,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  isCreating,
  isUpdating,
  isDeleting,
}: {
  groupedCategories: GroupedCategory[];
  type: CategoryType;
  isLoading: boolean;
  onCreate: (data: { name: string; type: CategoryType; parent_id?: string | null }) => Promise<unknown>;
  onUpdate: (params: { id: string; data: { name: string } }) => Promise<unknown>;
  onDelete: (id: string) => Promise<unknown>;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;
}) {
  const [newParentName, setNewParentName] = useState("");
  const [newChildName, setNewChildName] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleteIsParent, setDeleteIsParent] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    groupedCategories.forEach((g) => { initial[g.parent.id] = true; });
    return initial;
  });

  const handleCreateParent = async () => {
    if (!newParentName.trim()) return;
    await onCreate({ name: newParentName.trim(), type });
    setNewParentName("");
  };

  const handleCreateChild = async (parentId: string) => {
    const name = newChildName[parentId]?.trim();
    if (!name) return;
    await onCreate({ name, type, parent_id: parentId });
    setNewChildName((prev) => ({ ...prev, [parentId]: "" }));
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await onUpdate({ id: editingId, data: { name: editingName.trim() } });
    setEditingId(null);
    setEditingName("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await onDelete(deleteId);
    setDeleteId(null);
    setDeleteIsParent(false);
  };

  const allCategories = groupedCategories.flatMap((g) => [g.parent, ...g.children]);
  const categoryToDelete = allCategories.find((c) => c.id === deleteId);
  const Icon = type === "income" ? TrendingUp : TrendingDown;
  const iconColorClass = type === "income" ? "text-green-600" : "text-red-600";
  const bgColorClass = type === "income" ? "bg-green-500/10" : "bg-red-500/10";

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder={`Nova categoria mãe de ${type === "income" ? "receita" : "despesa"}`} value={newParentName} onChange={(e) => setNewParentName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleCreateParent()} />
        <Button onClick={handleCreateParent} disabled={!newParentName.trim() || isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Categoria Mãe</span>
        </Button>
      </div>

      {groupedCategories.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">Nenhuma categoria cadastrada</p>
      ) : (
        <div className="space-y-3">
          {groupedCategories.map((group) => (
            <Collapsible key={group.parent.id} open={openGroups[group.parent.id] !== false} onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.parent.id]: open }))}>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    {openGroups[group.parent.id] !== false ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <div className={`rounded-lg ${bgColorClass} p-2`}><FolderOpen className={`h-4 w-4 ${iconColorClass}`} /></div>

                {editingId === group.parent.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") { setEditingId(null); setEditingName(""); } }} autoFocus />
                    <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(""); }}>Cancelar</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="font-semibold text-card-foreground">{group.parent.name}</p>
                      <span className="text-xs text-muted-foreground">{group.children.length} subcategorias</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditingId(group.parent.id); setEditingName(group.parent.name); }}><Pencil className="h-4 w-4" /></Button>
                      {!group.parent.is_default && (
                        <Button variant="ghost" size="icon" onClick={() => { setDeleteId(group.parent.id); setDeleteIsParent(true); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      )}
                    </div>
                  </>
                )}
              </div>

              <CollapsibleContent>
                <div className="ml-8 mt-1 space-y-1 border-l-2 border-border pl-4">
                  {group.children.map((child) => (
                    <div key={child.id} className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5">
                      <div className={`rounded-md ${bgColorClass} p-1.5`}><Icon className={`h-3.5 w-3.5 ${iconColorClass}`} /></div>
                      {editingId === child.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); if (e.key === "Escape") { setEditingId(null); setEditingName(""); } }} autoFocus className="h-8" />
                          <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>{isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}</Button>
                          <Button size="sm" variant="ghost" onClick={() => { setEditingId(null); setEditingName(""); }}>Cancelar</Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1"><p className="text-sm font-medium text-card-foreground">{child.name}</p></div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingId(child.id); setEditingName(child.name); }}><Pencil className="h-3.5 w-3.5" /></Button>
                            {!child.is_default && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteId(child.id); setDeleteIsParent(false); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  <div className="flex gap-2 pt-1">
                    <Input placeholder="Nova subcategoria..." value={newChildName[group.parent.id] || ""} onChange={(e) => setNewChildName((prev) => ({ ...prev, [group.parent.id]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && handleCreateChild(group.parent.id)} className="h-8 text-sm" />
                    <Button size="sm" variant="outline" onClick={() => handleCreateChild(group.parent.id)} disabled={!newChildName[group.parent.id]?.trim() || isCreating}>
                      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteIsParent(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteIsParent ? "categoria mãe" : "subcategoria"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIsParent
                ? `Tem certeza que deseja excluir "${categoryToDelete?.name}" e todas as suas subcategorias?`
                : `Tem certeza que deseja excluir "${categoryToDelete?.name}"?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export function TransactionCategoriesSettings({ onBack }: TransactionCategoriesSettingsProps) {
  const {
    groupedIncomeCategories,
    groupedExpenseCategories,
    isLoading,
    create,
    update,
    remove,
    isCreating,
    isUpdating,
    isDeleting,
  } = useTransactionCategories();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-5 w-5" /></Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plano Financeiro</h1>
          <p className="text-muted-foreground">Defina como o dinheiro da empresa será organizado. Essas categorias são usadas em contas a pagar, contas a receber e relatórios.</p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-muted/30 px-4 py-2.5 text-sm text-muted-foreground">
        Estas categorias são financeiras e não substituem o catálogo de serviços.
      </div>

      <p className="text-xs text-muted-foreground">
        <strong>Categoria mãe</strong> = grupo principal (ex: Serviços) &nbsp;|&nbsp; <strong>Subcategoria</strong> = detalhamento (ex: Limpeza, Instalação)
      </p>

      <Tabs defaultValue="income" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="income" className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Receitas</TabsTrigger>
          <TabsTrigger value="expense" className="flex items-center gap-2"><TrendingDown className="h-4 w-4" />Despesas</TabsTrigger>
        </TabsList>
        <TabsContent value="income" className="mt-4">
          <SettingsCategoryList groupedCategories={groupedIncomeCategories} type="income" isLoading={isLoading} onCreate={create} onUpdate={update} onDelete={remove} isCreating={isCreating} isUpdating={isUpdating} isDeleting={isDeleting} />
        </TabsContent>
        <TabsContent value="expense" className="mt-4">
          <SettingsCategoryList groupedCategories={groupedExpenseCategories} type="expense" isLoading={isLoading} onCreate={create} onUpdate={update} onDelete={remove} isCreating={isCreating} isUpdating={isUpdating} isDeleting={isDeleting} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
