import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServiceForm } from "./ServiceForm";
import { useClients, type Client } from "@/hooks/useClients";
import type { Service, ServiceFormData } from "@/hooks/useServices";
import { type ServiceItemLocal } from "@/components/services/ServiceCatalogSelector";

export interface ServiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service?: Service | null;
  clients: Client[];
  onSubmit: (data: ServiceFormData, items?: ServiceItemLocal[]) => Promise<void>;
  isSubmitting?: boolean;
  defaultDate?: Date | null;
}

export function ServiceDialog({
  open,
  onOpenChange,
  service,
  clients,
  onSubmit,
  isSubmitting,
  defaultDate,
}: ServiceDialogProps) {
  const [expanded, setExpanded] = useState(false);
  const { create: createClient, isCreating: isCreatingClient, clients: freshClients } = useClients();

  const handleSubmit = async (data: ServiceFormData, items?: ServiceItemLocal[]) => {
    await onSubmit(data, items);
    onOpenChange(false);
  };

  // Use freshClients to get the most up-to-date list after creating a new client
  const clientList = freshClients.length > 0 ? freshClients : clients;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        className={cn(
          "overflow-y-auto transition-all duration-200",
          expanded ? "sm:max-w-2xl" : "sm:max-w-lg"
        )}
      >
        <div className="flex items-center justify-between pr-8">
          <SheetHeader className="text-left">
            <SheetTitle>
              {service ? "Editar Serviço" : "Novo Serviço"}
            </SheetTitle>
          </SheetHeader>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setExpanded(!expanded)}
            className="hidden sm:flex"
            title={expanded ? "Reduzir" : "Expandir"}
          >
            {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
        <div className="mt-6">
          <ServiceForm
            service={service}
            clients={clientList}
            onSubmit={handleSubmit}
            onCancel={() => onOpenChange(false)}
            isSubmitting={isSubmitting}
            defaultDate={defaultDate}
            createClient={createClient}
            isCreatingClient={isCreatingClient}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
