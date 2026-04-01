import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useTrash, type TrashItem } from "@/hooks/useTrash";
import { AlertTriangle, RotateCcw, Trash2, Users, Building2, Wrench, ClipboardList, DollarSign, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";

const typeLabels: Record<TrashItem["type"], string> = {
  client: "Cliente",
  supplier: "Fornecedor",
  service: "Serviço",
  catalog: "Catálogo",
  transaction: "Transação",
  pmoc: "Contrato PMOC",
};

const typeIcons: Record<TrashItem["type"], React.ElementType> = {
  client: Users,
  supplier: Building2,
  service: ClipboardList,
  catalog: Wrench,
  transaction: DollarSign,
  pmoc: FileText,
};

export default function Lixeira() {
  const { items, isLoading, restore, permanentDelete, isRestoring, isDeleting } = useTrash();
  const [deleteItem, setDeleteItem] = useState<TrashItem | null>(null);

  const getDaysRemaining = (deletedAt: string) => {
    const deleted = new Date(deletedAt);
    const expiry = new Date(deleted);
    expiry.setDate(expiry.getDate() + 30);
    return Math.max(0, differenceInDays(expiry, new Date()));
  };

  const itemsByType = useMemo(() => ({
    client: items.filter((i) => i.type === "client"),
    supplier: items.filter((i) => i.type === "supplier"),
    service: items.filter((i) => i.type === "service"),
    catalog: items.filter((i) => i.type === "catalog"),
    transaction: items.filter((i) => i.type === "transaction"),
    pmoc: items.filter((i) => i.type === "pmoc"),
  }), [items]);

  const filterByType = (type: TrashItem["type"]) => itemsByType[type];

  const renderItems = (filtered: TrashItem[]) => {
    if (filtered.length === 0) {
      return (
        <p className="text-sm text-muted-foreground text-center py-8">Nenhum item na lixeira</p>
      );
    }

    return (
      <div className="space-y-2">
        {filtered.map((item) => {
          const daysLeft = getDaysRemaining(item.deleted_at);
          const Icon = typeIcons[item.type];
          return (
            <Card key={`${item.table}-${item.id}`}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Excluído em {format(new Date(item.deleted_at), "dd/MM/yyyy", { locale: ptBR })}
                      {" · "}
                      <span className={daysLeft <= 5 ? "text-destructive font-medium" : ""}>
                        {daysLeft} {daysLeft === 1 ? "dia restante" : "dias restantes"}
                      </span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => restore(item)}
                    disabled={isRestoring || isDeleting}
                    className="gap-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Restaurar</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteItem(item)}
                    disabled={isRestoring || isDeleting}
                    className="gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Excluir</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  const tabs = [
    { value: "all", label: "Todos", count: items.length },
    { value: "client", label: "Clientes", count: filterByType("client").length },
    { value: "supplier", label: "Fornecedores", count: filterByType("supplier").length },
    { value: "service", label: "Serviços", count: filterByType("service").length },
    { value: "catalog", label: "Catálogo", count: filterByType("catalog").length },
    { value: "transaction", label: "Transações", count: filterByType("transaction").length },
    { value: "pmoc", label: "PMOC", count: filterByType("pmoc").length },
  ];

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Lixeira</h1>
        <p className="text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "itens"} na lixeira
        </p>
      </div>

      <Alert className="mb-6 border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <AlertDescription className="text-amber-700 dark:text-amber-300">
          Os itens excluídos ficam na lixeira por <strong>30 dias</strong> antes de serem removidos permanentemente.
          Você pode restaurá-los a qualquer momento dentro desse período.
        </AlertDescription>
      </Alert>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList className="mb-4 flex-wrap h-auto">
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value} className="gap-2">
                {tab.label}
                {tab.count > 0 && (
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">
                    {tab.count}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all">{renderItems(items)}</TabsContent>
          <TabsContent value="client">{renderItems(filterByType("client"))}</TabsContent>
          <TabsContent value="supplier">{renderItems(filterByType("supplier"))}</TabsContent>
          <TabsContent value="service">{renderItems(filterByType("service"))}</TabsContent>
          <TabsContent value="catalog">{renderItems(filterByType("catalog"))}</TabsContent>
          <TabsContent value="transaction">{renderItems(filterByType("transaction"))}</TabsContent>
          <TabsContent value="pmoc">{renderItems(filterByType("pmoc"))}</TabsContent>
        </Tabs>
      )}

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteItem?.name}</strong> permanentemente?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteItem) {
                  permanentDelete(deleteItem);
                  setDeleteItem(null);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
