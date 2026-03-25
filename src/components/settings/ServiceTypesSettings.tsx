import { useState } from "react";
import { ArrowLeft, Plus, Pencil, Trash2, Loader2, Wrench, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useServiceTypes } from "@/hooks/useServiceTypes";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ServiceTypesSettingsProps {
  onBack: () => void;
}

export function ServiceTypesSettings({ onBack }: ServiceTypesSettingsProps) {
  const { serviceTypes, isLoading, create, update, remove, isCreating, isUpdating, isDeleting } = useServiceTypes();
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeRecurrence, setNewTypeRecurrence] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingRecurrence, setEditingRecurrence] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!newTypeName.trim()) return;
    await create({ name: newTypeName.trim(), generates_recurrence: newTypeRecurrence });
    setNewTypeName("");
    setNewTypeRecurrence(false);
  };

  const handleStartEdit = (id: string, name: string, recurrence: boolean) => {
    setEditingId(id);
    setEditingName(name);
    setEditingRecurrence(recurrence);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await update({ id: editingId, data: { name: editingName.trim(), generates_recurrence: editingRecurrence } });
    setEditingId(null);
    setEditingName("");
    setEditingRecurrence(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  const typeToDelete = serviceTypes.find((t) => t.id === deleteId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tipos de Serviço</h1>
          <p className="text-muted-foreground">Personalize os tipos de serviço da sua empresa</p>
        </div>
      </div>

      {/* Add new type */}
      <div className="flex flex-col gap-4 p-4 border rounded-lg bg-muted/30">
        <div className="flex gap-2">
          <Input
            placeholder="Nome do novo tipo de serviço"
            value={newTypeName}
            onChange={(e) => setNewTypeName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={!newTypeName.trim() || isCreating}>
            {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Adicionar</span>
          </Button>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="new-type-recurrence" 
            checked={newTypeRecurrence} 
            onCheckedChange={(checked) => setNewTypeRecurrence(checked as boolean)} 
          />
          <Label htmlFor="new-type-recurrence" className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2">
            Gera recorrência automática
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <RefreshCw className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">Quando uma OS deste tipo for concluída, iniciará um ciclo de 12 meses de mensagens automáticas para o cliente.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </Label>
        </div>
      </div>

      {/* Types list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-2">
          {serviceTypes.map((type) => (
            <div
              key={type.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3"
            >
              <div className="rounded-lg bg-primary/10 p-2">
                <Wrench className="h-4 w-4 text-primary" />
              </div>

              {editingId === type.id ? (
                <div className="flex flex-1 flex-col gap-3">
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
                    <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
                      Cancelar
                    </Button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id={`edit-recurrence-${type.id}`} 
                      checked={editingRecurrence} 
                      onCheckedChange={(checked) => setEditingRecurrence(checked as boolean)} 
                    />
                    <Label htmlFor={`edit-recurrence-${type.id}`} className="text-sm cursor-pointer">
                      Gera recorrência automática
                    </Label>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-card-foreground">{type.name}</p>
                      {type.generates_recurrence && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <RefreshCw className="h-3.5 w-3.5 text-primary cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="text-xs">Gera recorrência automática</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        Slug: {type.slug}
                      </span>
                      {type.is_default && (
                        <span className="text-[10px] text-muted-foreground uppercase tracking-tight">Padrão</span>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleStartEdit(type.id, type.name, type.generates_recurrence)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!type.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(type.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}

          {serviceTypes.length === 0 && (
            <p className="py-8 text-center text-muted-foreground">
              Nenhum tipo de serviço cadastrado
            </p>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tipo de serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir "{typeToDelete?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
