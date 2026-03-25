import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Package, Clock, ListChecks, Tag } from "lucide-react";
import type { CatalogService } from "@/hooks/useCatalogServices";

interface CatalogServiceCardProps {
  service: CatalogService;
  onEdit: (service: CatalogService) => void;
  onDelete: (id: string) => void;
}

export function CatalogServiceCard({
  service,
  onEdit,
  onDelete,
}: CatalogServiceCardProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-card-foreground break-words">
                  {service.name}
                </h3>
                {!service.is_active && (
                  <Badge variant="secondary" className="text-xs">
                    Inativo
                  </Badge>
                )}
              </div>
              {service.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 sm:line-clamp-1 mt-0.5">
                  {service.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <span className="text-sm font-semibold text-primary">
                  {formatCurrency(service.unit_price)}
                </span>
                {service.default_discount > 0 && (
                  <Badge variant="outline" className="text-xs">
                    -{service.default_discount}% desc.
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-2 sm:gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none sm:h-8 sm:w-8 sm:p-0"
              onClick={() => onEdit(service)}
            >
              <Pencil className="h-4 w-4" />
              <span className="sm:hidden ml-2">Editar</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none sm:h-8 sm:w-8 sm:p-0 text-destructive hover:text-destructive"
              onClick={() => onDelete(service.id)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="sm:hidden ml-2">Excluir</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
