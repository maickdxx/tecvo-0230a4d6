import { AppLayout } from "@/components/layout";
import { ClientFullForm } from "@/components/clients/ClientFullForm";
import { useClients, type ClientFormData } from "@/hooks/useClients";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function EditarCliente() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { clients, isLoading, update, isUpdating } = useClients();

  const client = clients.find((c) => c.id === id) ?? null;

  const handleSubmit = async (data: ClientFormData) => {
    if (!id) return;
    await update({ id, data });
    navigate("/clientes");
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Cliente não encontrado.</p>
          <Button variant="link" onClick={() => navigate("/clientes")}>Voltar para Clientes</Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="gap-2 mb-2" onClick={() => navigate("/clientes")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Editar Cliente</h1>
        <p className="text-muted-foreground">{client.name}</p>
      </div>
      <ClientFullForm client={client} onSubmit={handleSubmit} isSubmitting={isUpdating} onCancel={() => navigate("/clientes")} />
    </AppLayout>
  );
}
