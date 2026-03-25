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
              {service.category && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                  <Tag className="h-3 w-3" />
                  {service.category}
                </div>
              )}
              {service.description && (
                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                  {service.description}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-sm font-bold text-primary">
                  {formatCurrency(service.unit_price)}
                </span>
                {service.default_discount > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-4 bg-emerald-50 text-emerald-700 border-emerald-100">
                    -{service.default_discount}% desc.
                  </Badge>
                )}
                {service.estimated_duration && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    {service.estimated_duration}
                  </div>
                )}
                {service.standard_checklist && service.standard_checklist.length > 0 && (
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium bg-muted/50 px-1.5 py-0.5 rounded">
                    <ListChecks className="h-3 w-3" />
                    {service.standard_checklist.length} itens
                  </div>
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
