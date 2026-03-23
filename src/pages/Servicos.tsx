import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { PageTutorialBanner } from "@/components/onboarding";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ServiceList, ServiceDialog, ServiceOrderDialog } from "@/components/services";
import { QuoteDialog } from "@/components/services/QuoteDialog";
import { UpgradeModal } from "@/components/subscription";
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
import { useServices, type Service, type ServiceFormData, type ServiceStatus } from "@/hooks/useServices";
import { usePaginatedServices } from "@/hooks/usePaginatedServices";
import { useClients } from "@/hooks/useClients";
import { useSubscription } from "@/hooks/useSubscription";

export default function Servicos() {
  const [searchParams] = useSearchParams();
  const clientIdFilter = searchParams.get("cliente");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Paginated data loading
  const {
    services,
    totalCount,
    isLoading,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = usePaginatedServices({
    clientId: clientIdFilter || undefined,
    statusFilter,
  });

  // Mutations only (skip data query to avoid double-fetching)
  const { create, update, remove, updateStatus, isCreating, isUpdating } = useServices({
    clientId: clientIdFilter || undefined,
    skipQuery: true,
  });

  const { clients } = useClients();
  const { canCreateService, servicesUsed, refetch: refetchSubscription } = useSubscription();
  
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [deleteService, setDeleteService] = useState<Service | null>(null);
  const [quoteService, setQuoteService] = useState<Service | null>(null);
  const [serviceOrderService, setServiceOrderService] = useState<Service | null>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [cancelCompletedService, setCancelCompletedService] = useState<Service | null>(null);

  // Open dialog with pre-selected client if navigated from client history
  useEffect(() => {
    if (clientIdFilter && clients.length > 0) {
      // User came from client page, could auto-open form
    }
  }, [clientIdFilter, clients]);

  const handleCreate = () => {
    if (!canCreateService) {
      setShowUpgradeModal(true);
      return;
    }
    setSelectedService(null);
    setDialogOpen(true);
  };

  const handleEdit = (service: Service) => {
    setSelectedService(service);
    setDialogOpen(true);
  };

  const handleDelete = (service: Service) => {
    setDeleteService(service);
  };

  const handleStatusChange = async (service: Service, status: ServiceStatus) => {
    if (status === "cancelled" && service.status === "completed") {
      setCancelCompletedService(service);
      return;
    }
    await updateStatus({ id: service.id, status });
  };

  const confirmCancelCompleted = async () => {
    if (cancelCompletedService) {
      await updateStatus({ id: cancelCompletedService.id, status: "cancelled" });
      setCancelCompletedService(null);
    }
  };

  const handleQuote = (service: Service) => {
    setQuoteService(service);
  };

  const handleServiceOrder = (service: Service) => {
    setServiceOrderService(service);
  };

  const handleSubmit = async (data: ServiceFormData) => {
    try {
      if (selectedService) {
        await update({ id: selectedService.id, data });
      } else {
        await create(data);
        refetchSubscription();
      }
    } catch (error) {
      if ((error as Error).message === "LIMIT_REACHED") {
        setDialogOpen(false);
        setShowUpgradeModal(true);
      }
    }
  };

  const confirmDelete = async () => {
    if (deleteService) {
      await remove(deleteService.id);
      setDeleteService(null);
    }
  };

  const clientName = clientIdFilter
    ? clients.find((c) => c.id === clientIdFilter)?.name
    : null;

  return (
    <AppLayout>
      <PageTutorialBanner pageKey="servicos" title="Serviços" message="Aqui você acompanha todos os serviços da sua empresa. Cada registro alimenta seu histórico e suas métricas." />
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Serviços</h1>
          <p className="text-muted-foreground">
            {clientName
              ? `Histórico de ${clientName}`
              : `${totalCount} serviço${totalCount !== 1 ? "s" : ""} registrado${totalCount !== 1 ? "s" : ""}`}
          </p>
        </div>
        <Button className="gap-2" onClick={handleCreate}>
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Novo Serviço</span>
        </Button>
      </div>

      <ServiceList
        services={services}
        isLoading={isLoading}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onStatusChange={handleStatusChange}
        onQuote={handleQuote}
        onServiceOrder={handleServiceOrder}
        hasMore={hasNextPage}
        isLoadingMore={isFetchingNextPage}
        onLoadMore={() => fetchNextPage()}
        totalCount={totalCount}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      <ServiceDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        service={selectedService}
        clients={clients}
        onSubmit={handleSubmit}
        isSubmitting={isCreating || isUpdating}
      />

      {quoteService && (
        <QuoteDialog
          open={!!quoteService}
          onOpenChange={(open) => !open && setQuoteService(null)}
          service={quoteService}
        />
      )}

      {serviceOrderService && (
        <ServiceOrderDialog
          open={!!serviceOrderService}
          onOpenChange={(open) => !open && setServiceOrderService(null)}
          service={serviceOrderService}
        />
      )}

      <AlertDialog open={!!deleteService} onOpenChange={() => setDeleteService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir serviço?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este serviço? Esta ação não pode ser desfeita.
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

      <AlertDialog open={!!cancelCompletedService} onOpenChange={() => setCancelCompletedService(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar OS concluída?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta OS já gerou movimentação financeira. Ao cancelar, o valor será removido automaticamente da conta bancária.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmCancelCompleted} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar OS
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <UpgradeModal 
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal}
        servicesUsed={servicesUsed}
      />
    </AppLayout>
  );
}
