import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Download } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CatalogServiceList, CatalogServiceDialog, ImportCatalogDialog } from "@/components/catalog";
import { useCatalogServices, type CatalogService, type CatalogServiceFormData } from "@/hooks/useCatalogServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";

export default function CatalogoServicos() {
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<CatalogService | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const {
    services,
    isLoading,
    create,
    update,
    remove,
    isCreating,
    isUpdating,
    isDeleting,
  } = useCatalogServices();

  const { serviceTypes } = useServiceTypes();

  const filteredServices = services.filter((service) => {
    const matchesSearch = service.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === "all" || service.service_type === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleCreate = async (data: CatalogServiceFormData) => {
    await create(data);
  };

  const handleUpdate = async (data: CatalogServiceFormData) => {
    if (!editingService) return;
    await update({ id: editingService.id, data });
    setEditingService(null);
  };

  const handleEdit = (service: CatalogService) => {
    setEditingService(service);
    setDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await remove(deleteId);
    setDeleteId(null);
  };

  const handleDialogClose = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingService(null);
    }
  };

  return (
    <AppLayout>
      <PageTutorialBanner pageKey="catalogo" title="Catálogo de Serviços" message="Monte seu catálogo e agilize a criação de orçamentos e ordens de serviço." />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Catálogo de Serviços</h1>
          <p className="text-muted-foreground">Serviços e produtos oferecidos</p>
        </div>
        <div className="flex gap-2">
          {!services.some((s) => s.notes === "catalogo_padrao") && (
            <Button variant="outline" onClick={() => setImportOpen(true)} className="gap-2">
              <Download className="h-4 w-4" />
              Importar Serviços Padrão
            </Button>
          )}
          <Button onClick={() => setDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Serviço
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar serviço..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Todas as categorias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {serviceTypes.map((type) => (
              <SelectItem key={type.slug} value={type.slug}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <CatalogServiceList
        services={filteredServices}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={(id) => setDeleteId(id)}
      />

      <CatalogServiceDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        service={editingService}
        onSubmit={editingService ? handleUpdate : handleCreate}
        isLoading={isCreating || isUpdating}
      />

      <ImportCatalogDialog open={importOpen} onOpenChange={setImportOpen} />

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O serviço será removido do catálogo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={isDeleting}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
