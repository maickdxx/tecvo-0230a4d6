import { useState, useMemo } from "react";
import { Search, Wrench, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ServiceCard } from "./ServiceCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Service, ServiceStatus } from "@/hooks/useServices";

interface ServiceListProps {
  services: Service[];
  isLoading: boolean;
  onEdit: (service: Service) => void;
  onDelete: (service: Service) => void;
  onStatusChange: (service: Service, status: ServiceStatus) => void;
  onQuote: (service: Service) => void;
  onServiceOrder: (service: Service) => void;
  // Pagination props (optional)
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
  // Controlled status filter (optional - for server-side filtering)
  statusFilter?: string;
  onStatusFilterChange?: (status: string) => void;
}

export function ServiceList({
  services,
  isLoading,
  onEdit,
  onDelete,
  onStatusChange,
  onQuote,
  onServiceOrder,
  hasMore,
  isLoadingMore,
  onLoadMore,
  totalCount,
  statusFilter: controlledStatusFilter,
  onStatusFilterChange,
}: ServiceListProps) {
  const [search, setSearch] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState<string>("all");

  // Use controlled or internal status filter
  const statusFilter = controlledStatusFilter ?? internalStatusFilter;
  const handleStatusFilterChange = onStatusFilterChange ?? setInternalStatusFilter;

  // Client-side filtering: search always, status only if not controlled from outside
  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const matchesSearch =
        !search ||
        service.client?.name.toLowerCase().includes(search.toLowerCase()) ||
        service.description?.toLowerCase().includes(search.toLowerCase());

      // Only apply client-side status filter if NOT controlled externally
      const matchesStatus =
        controlledStatusFilter !== undefined ||
        statusFilter === "all" ||
        service.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [services, search, statusFilter, controlledStatusFilter]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <Tabs value={statusFilter} onValueChange={handleStatusFilterChange} className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="w-max justify-start flex-nowrap">
            <TabsTrigger value="all" className="shrink-0 text-xs sm:text-sm px-3">Todos</TabsTrigger>
            <TabsTrigger value="scheduled" className="shrink-0 text-xs sm:text-sm px-3">Agendados</TabsTrigger>
            <TabsTrigger value="in_progress" className="shrink-0 text-xs sm:text-sm px-3">Em Andamento</TabsTrigger>
            <TabsTrigger value="completed" className="shrink-0 text-xs sm:text-sm px-3">Concluídos</TabsTrigger>
            <TabsTrigger value="cancelled" className="shrink-0 text-xs sm:text-sm px-3">Cancelados</TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {filteredServices.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 py-12 px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            <Wrench className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {search || statusFilter !== "all"
              ? "Nenhum serviço encontrado"
              : "Registre seu primeiro serviço"}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-5 leading-relaxed">
            {search || statusFilter !== "all"
              ? "Tente alterar os filtros ou buscar por outro termo."
              : "Adicione serviços para acompanhar atendimentos, valores e histórico dos seus clientes."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredServices.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
                onEdit={onEdit}
                onDelete={onDelete}
                onStatusChange={onStatusChange}
                onQuote={onQuote}
                onServiceOrder={onServiceOrder}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && onLoadMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={onLoadMore}
                disabled={isLoadingMore}
                className="gap-2"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando...
                  </>
                ) : (
                  <>
                    Carregar mais
                    {totalCount !== undefined && (
                      <span className="text-muted-foreground">
                        ({services.length} de {totalCount})
                      </span>
                    )}
                  </>
                )}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
