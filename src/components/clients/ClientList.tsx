import { useState, useMemo } from "react";
import { Search, Users, Loader2, UserPlus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ClientCard } from "./ClientCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import type { Client } from "@/hooks/useClients";
import type { ClientMetrics } from "@/pages/Clientes";

type FilterType = "all" | "active" | "inactive" | "reactivate" | "scheduled" | "pending";

interface ClientListProps {
  clients: Client[];
  isLoading: boolean;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
  onViewHistory: (client: Client) => void;
  onCreateOS?: (clientId: string) => void;
  clientMetrics?: Record<string, ClientMetrics>;
  // Pagination props (optional)
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number;
  search?: string;
  onSearchChange?: (value: string) => void;
}

function getStatusFromMetrics(metrics: ClientMetrics | undefined): "active" | "inactive" | "reactivate" | null {
  if (!metrics?.lastServiceDate) return null;
  const today = new Date();
  const last = new Date(metrics.lastServiceDate);
  const diffMs = today.getTime() - last.getTime();
  const diffMonths = diffMs / (1000 * 60 * 60 * 24 * 30.44);
  if (diffMonths < 3) return "active";
  if (diffMonths < 6) return "inactive";
  return "reactivate";
}

export function ClientList({
  clients,
  isLoading,
  onEdit,
  onDelete,
  onViewHistory,
  onCreateOS,
  clientMetrics = {},
  hasMore,
  isLoadingMore,
  onLoadMore,
  totalCount,
}: ClientListProps) {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");

  const searchFiltered = clients.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase()) ||
    client.phone.includes(search) ||
    client.email?.toLowerCase().includes(search.toLowerCase())
  );

  const filterCounts = useMemo(() => {
    const counts = { all: searchFiltered.length, active: 0, inactive: 0, reactivate: 0, scheduled: 0, pending: 0 };
    for (const c of searchFiltered) {
      const m = clientMetrics[c.id];
      const status = getStatusFromMetrics(m);
      if (status === "active") counts.active++;
      if (status === "inactive") counts.inactive++;
      if (status === "reactivate") counts.reactivate++;
      if (m?.hasScheduled) counts.scheduled++;
      if (m?.hasPendingPayment) counts.pending++;
    }
    return counts;
  }, [searchFiltered, clientMetrics]);

  const filteredClients = useMemo(() => {
    if (activeFilter === "all") return searchFiltered;
    return searchFiltered.filter((c) => {
      const m = clientMetrics[c.id];
      const status = getStatusFromMetrics(m);
      switch (activeFilter) {
        case "active": return status === "active";
        case "inactive": return status === "inactive";
        case "reactivate": return status === "reactivate";
        case "scheduled": return m?.hasScheduled;
        case "pending": return m?.hasPendingPayment;
        default: return true;
      }
    });
  }, [searchFiltered, activeFilter, clientMetrics]);

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: "Todos" },
    { key: "active", label: "Ativos" },
    { key: "inactive", label: "Inativos" },
    { key: "reactivate", label: "Reativar" },
    { key: "scheduled", label: "Agendada" },
    { key: "pending", label: "Pgto Pendente" },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nome, telefone ou email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <Button
            key={f.key}
            variant={activeFilter === f.key ? "default" : "outline"}
            size="sm"
            className="text-xs h-8"
            onClick={() => setActiveFilter(f.key)}
          >
            {f.label} ({filterCounts[f.key]})
          </Button>
        ))}
      </div>

      {filteredClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/20 py-12 px-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mb-4">
            {search || activeFilter !== "all" ? (
              <Search className="h-7 w-7 text-primary" />
            ) : (
              <UserPlus className="h-7 w-7 text-primary" />
            )}
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">
            {search || activeFilter !== "all" ? "Nenhum cliente encontrado" : "Cadastre seu primeiro cliente"}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-5 leading-relaxed">
            {search || activeFilter !== "all"
              ? "Tente buscar por outro termo ou alterar o filtro."
              : "Comece adicionando os dados dos seus clientes para organizar serviços e histórico de atendimento."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 entrance-stagger">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                onEdit={onEdit}
                onDelete={onDelete}
                onViewHistory={onViewHistory}
                onCreateOS={onCreateOS}
                metrics={clientMetrics[client.id]}
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
                        ({clients.length} de {totalCount})
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
