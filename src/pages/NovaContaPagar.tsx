import { AppLayout } from "@/components/layout";
import { PayableFullForm } from "@/components/finance/PayableFullForm";
import { useAccounts, type AccountFormData } from "@/hooks/useAccounts";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function NovaContaPagar() {
  const navigate = useNavigate();
  const { create, isCreating } = useAccounts({ accountType: "payable" });

  const handleSubmit = async (data: AccountFormData) => {
    await create(data);
    toast({ title: "Conta a pagar criada", description: "Conta registrada com sucesso." });
    navigate("/contas-pagar");
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="gap-2 mb-2" onClick={() => navigate("/contas-pagar")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Nova Conta a Pagar</h1>
        <p className="text-muted-foreground">Registre uma nova despesa ou pagamento</p>
      </div>
      <PayableFullForm
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
        onCancel={() => navigate("/contas-pagar")}
      />
    </AppLayout>
  );
}
