import { useState, useMemo, useEffect } from "react";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ClientList, ClientDialog } from "@/components/clients";
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
import { useClients, type Client, type ClientFormData } from "@/hooks/useClients";
import { usePaginatedClients } from "@/hooks/usePaginatedClients";
import { useServices } from "@/hooks/useServices";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";

export interface ClientMetrics {
  lastServiceDate: string | null;
  totalRevenue: number;
  totalServices: number;
  hasScheduled: boolean;
  hasPendingPayment: boolean;
}

export default function Clientes() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  // Paginated data for the list
  const {
    clients,
    totalCount,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedClients(debouncedSearch);

  // Mutations only (skip data query)
  const { create, update, remove, isCreating, isUpdating } = useClients();

  const { services } = useServices({ documentType: "service_order" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  const clientMetrics = useMemo(() => {
    const today = getTodayInTz(tz);
    const map: Record<string, ClientMetrics> = {};

    for (const s of services) {
      const cid = s.client_id;
      if (!map[cid]) {
        map[cid] = { lastServiceDate: null, totalRevenue: 0, totalServices: 0, hasScheduled: false, hasPendingPayment: false };
      }
      const m = map[cid];

      if (s.status === "completed") {
        m.totalServices += 1;
        m.totalRevenue += s.value || 0;
        const completedDate = (s.completed_date || s.scheduled_date || s.created_at).substring(0, 10);
        if (!m.lastServiceDate || completedDate > m.lastServiceDate) {
          m.lastServiceDate = completedDate;
        }
      }

      if ((s.status === "scheduled" || s.status === "in_progress") && s.scheduled_date) {
        const sd = s.scheduled_date.substring(0, 10);
        if (sd >= today) {
          m.hasScheduled = true;
        }
      }

      if (s.status === "completed" && s.payment_due_date) {
        const due = s.payment_due_date.substring(0, 10);
        if (due < today && !s.completed_date) {
          m.hasPendingPayment = true;
        }
      }
      if (s.status === "completed" && !s.payment_method && (s.value || 0) > 0) {
        m.hasPendingPayment = true;
      }
    }

    return map;
  }, [services]);

  const handleCreate = () => {
    navigate("/clientes/novo");
  };

  const handleEdit = (client: Client) => {
    navigate(`/clientes/editar/${client.id}`);
  };

  const handleDelete = (client: Client) => {
    setDeleteClient(client);
  };

  const handleViewHistory = (client: Client) => {
    navigate(`/servicos?cliente=${client.id}`);
  };

  const handleCreateOS = (clientId: string) => {
    navigate(`/ordens-servico/nova?cliente=${clientId}`);
  };

  const handleSubmit = async (data: ClientFormData) => {
    if (selectedClient) {
      await update({ id: selectedClient.id, data });
    } else {
      await create(data);
    }
  };

  const confirmDelete = async () => {
    if (deleteClient) {
      await remove(deleteClient.id);
      setDeleteClient(null);
    }
  };

  return (
    <AppLayout>
      <PageTutorialBanner pageKey="clientes" title="Clientes" message="Seus clientes são seu maior ativo. Quanto mais você registra, mais a Tecvo trabalha por você com recorrência automática." />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground">
            {totalCount} cliente{totalCount !== 1 ? "s" : ""} cadastrado{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
        <Button className="gap-2" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Cliente</span>
        </Button>
      </div>

      <ClientList
        clients={clients}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onViewHistory={handleViewHistory}
        onCreateOS={handleCreateOS}
        clientMetrics={clientMetrics}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        totalCount={totalCount}
        search={search}
        onSearchChange={setSearch}
      />

      <ClientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        client={selectedClient}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      <AlertDialog open={!!deleteClient} onOpenChange={() => setDeleteClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mover para a lixeira?</AlertDialogTitle>
            <AlertDialogDescription>
              O cliente {deleteClient?.name} será movido para a lixeira e ficará lá por 30 dias
              antes de ser excluído permanentemente. Você pode restaurá-lo a qualquer momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
