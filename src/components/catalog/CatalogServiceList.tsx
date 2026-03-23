import { CatalogServiceCard } from "./CatalogServiceCard";
import { Package } from "lucide-react";
import type { CatalogService } from "@/hooks/useCatalogServices";

interface CatalogServiceListProps {
  services: CatalogService[];
  isLoading: boolean;
  onEdit: (service: CatalogService) => void;
  onDelete: (id: string) => void;
}

export function CatalogServiceList({
  services,
  isLoading,
  onEdit,
  onDelete,
}: CatalogServiceListProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-24 rounded-xl bg-muted animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (services.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Package className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-1">
          Nenhum serviço cadastrado
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          Cadastre os serviços que sua empresa oferece para agilizar a criação de orçamentos e ordens de serviço.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {services.map((service) => (
        <CatalogServiceCard
          key={service.id}
          service={service}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
}
