import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CatalogServiceForm } from "./CatalogServiceForm";
import type { CatalogService, CatalogServiceFormData } from "@/hooks/useCatalogServices";

interface CatalogServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: CatalogService | null;
  onSubmit: (data: CatalogServiceFormData) => Promise<void>;
  isLoading?: boolean;
}

export function CatalogServiceDialog({
  open,
  onOpenChange,
  service,
  onSubmit,
  isLoading,
}: CatalogServiceDialogProps) {
  const handleSubmit = async (data: CatalogServiceFormData) => {
    await onSubmit(data);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {service ? "Editar Serviço" : "Novo Serviço"}
          </DialogTitle>
        </DialogHeader>
        <CatalogServiceForm
          service={service}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
}
