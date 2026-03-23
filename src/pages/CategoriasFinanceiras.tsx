import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Loader2, TrendingUp, TrendingDown, ChevronDown, ChevronRight, FolderOpen, Search } from "lucide-react";
import { AppLayout } from "@/components/layout";
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

function HierarchicalCategoryList({
  groupedCategories,
  type,
  isLoading,
  onCreate,
  onUpdate,
  onDelete,
  isCreating,
  isUpdating,
  isDeleting,
  searchTerm,
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
  searchTerm: string;
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

  const handleStartEdit = (id: string, name: string) => {
    setEditingId(id);
    setEditingName(name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await onUpdate({ id: editingId, data: { name: editingName.trim() } });
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    await onDelete(deleteId);
    setDeleteId(null);
    setDeleteIsParent(false);
  };

  const normalizedSearch = searchTerm.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return groupedCategories;
    return groupedCategories
      .map((g) => {
        const parentMatch = g.parent.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedSearch);
        const filteredChildren = g.children.filter((c) =>
          c.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(normalizedSearch)
        );
        if (parentMatch) return g; // show full group
        if (filteredChildren.length > 0) return { ...g, children: filteredChildren };
        return null;
      })
      .filter(Boolean) as GroupedCategory[];
  }, [groupedCategories, normalizedSearch]);

  const allCategories = groupedCategories.flatMap((g) => [g.parent, ...g.children]);
  const categoryToDelete = allCategories.find((c) => c.id === deleteId);

  const Icon = type === "income" ? TrendingUp : TrendingDown;
  const iconColorClass = type === "income" ? "text-success" : "text-destructive";
  const bgColorClass = type === "income" ? "bg-success/10" : "bg-destructive/10";

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Add new parent category */}
      <div className="flex gap-2">
        <Input
          placeholder={`Nova categoria mãe de ${type === "income" ? "entrada" : "saída"}`}
          value={newParentName}
          onChange={(e) => setNewParentName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateParent()}
        />
        <Button onClick={handleCreateParent} disabled={!newParentName.trim() || isCreating}>
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          <span className="ml-2 hidden sm:inline">Categoria Mãe</span>
        </Button>
      </div>

      {/* Grouped categories */}
      {filteredGroups.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">
          {normalizedSearch ? "Nenhuma categoria encontrada" : "Nenhuma categoria cadastrada"}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredGroups.map((group) => (
            <Collapsible
              key={group.parent.id}
              open={openGroups[group.parent.id] !== false}
              onOpenChange={(open) => setOpenGroups((prev) => ({ ...prev, [group.parent.id]: open }))}
            >
              {/* Parent header */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                    {openGroups[group.parent.id] !== false ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>

                <div className={`rounded-lg ${bgColorClass} p-2`}>
                  <FolderOpen className={`h-4 w-4 ${iconColorClass}`} />
                </div>

                {editingId === group.parent.id ? (
                  <div className="flex flex-1 items-center gap-2">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveEdit();
                        if (e.key === "Escape") handleCancelEdit();
                      }}
                      autoFocus
                    />
                    <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
                      {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancelar</Button>
                  </div>
                ) : (
                  <>
                    <div className="flex-1">
                      <p className="font-semibold text-card-foreground">{group.parent.name}</p>
                      <span className="text-xs text-muted-foreground">{group.children.length} subcategorias</span>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleStartEdit(group.parent.id, group.parent.name)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {!group.parent.is_default && (
                        <Button variant="ghost" size="icon" onClick={() => { setDeleteId(group.parent.id); setDeleteIsParent(true); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Children */}
              <CollapsibleContent>
                <div className="ml-8 mt-1 space-y-1 border-l-2 border-border pl-4">
                  {group.children.map((child) => (
                    <div
                      key={child.id}
                      className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
                    >
                      <div className={`rounded-md ${bgColorClass} p-1.5`}>
                        <Icon className={`h-3.5 w-3.5 ${iconColorClass}`} />
                      </div>

                      {editingId === child.id ? (
                        <div className="flex flex-1 items-center gap-2">
                          <Input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleSaveEdit();
                              if (e.key === "Escape") handleCancelEdit();
                            }}
                            autoFocus
                            className="h-8"
                          />
                          <Button size="sm" onClick={handleSaveEdit} disabled={isUpdating}>
                            {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>Cancelar</Button>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-card-foreground">{child.name}</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleStartEdit(child.id, child.name)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {!child.is_default && (
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setDeleteId(child.id); setDeleteIsParent(false); }}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  {/* Add subcategory */}
                  <div className="flex gap-2 pt-1">
                    <Input
                      placeholder="Nova subcategoria..."
                      value={newChildName[group.parent.id] || ""}
                      onChange={(e) => setNewChildName((prev) => ({ ...prev, [group.parent.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateChild(group.parent.id)}
                      className="h-8 text-sm"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateChild(group.parent.id)}
                      disabled={!newChildName[group.parent.id]?.trim() || isCreating}
                    >
                      {isCreating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => { setDeleteId(null); setDeleteIsParent(false); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {deleteIsParent ? "categoria mãe" : "subcategoria"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteIsParent
                ? `Tem certeza que deseja excluir "${categoryToDelete?.name}" e todas as suas subcategorias? Esta ação não pode ser desfeita.`
                : `Tem certeza que deseja excluir "${categoryToDelete?.name}"? Esta ação não pode ser desfeita.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function CategoriasFinanceiras() {
  const [searchTerm, setSearchTerm] = useState("");
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
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Plano de Contas</h1>
        <p className="text-muted-foreground">Gerencie as categorias de entrada e saída do seu financeiro</p>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar plano de contas..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      <Tabs defaultValue="expense" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="expense" className="flex items-center gap-2">
            <TrendingDown className="h-4 w-4" />
            Saídas
          </TabsTrigger>
          <TabsTrigger value="income" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Entradas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="expense" className="mt-4">
          <HierarchicalCategoryList
            groupedCategories={groupedExpenseCategories}
            type="expense"
            isLoading={isLoading}
            onCreate={create}
            onUpdate={update}
            onDelete={remove}
            isCreating={isCreating}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
            searchTerm={searchTerm}
          />
        </TabsContent>

        <TabsContent value="income" className="mt-4">
          <HierarchicalCategoryList
            groupedCategories={groupedIncomeCategories}
            type="income"
            isLoading={isLoading}
            onCreate={create}
            onUpdate={update}
            onDelete={remove}
            isCreating={isCreating}
            isUpdating={isUpdating}
            isDeleting={isDeleting}
            searchTerm={searchTerm}
          />
        </TabsContent>
      </Tabs>
    </AppLayout>
  );
}
