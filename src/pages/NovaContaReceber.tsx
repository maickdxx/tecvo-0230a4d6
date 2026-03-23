import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { ReceivableFullForm } from "@/components/finance/ReceivableFullForm";
import { useAccounts, type AccountFormData } from "@/hooks/useAccounts";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

export default function NovaContaReceber() {
  const navigate = useNavigate();
  const { create, isCreating } = useAccounts({ accountType: "receivable" });
  const [formKey, setFormKey] = useState(0);

  const handleSubmit = async (data: AccountFormData) => {
    await create(data);
    toast({ title: "Conta a receber criada", description: "Formulário pronto para o próximo lançamento." });
    setFormKey(prev => prev + 1);
  };

  return (
    <AppLayout>
      <div className="mb-6">
        <Button variant="ghost" size="sm" className="gap-2 mb-2" onClick={() => navigate("/contas-receber")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Nova Conta a Receber</h1>
        <p className="text-muted-foreground">Registre um novo recebível ou cobrança</p>
      </div>
      <ReceivableFullForm
        key={formKey}
        onSubmit={handleSubmit}
        isSubmitting={isCreating}
        onCancel={() => navigate("/contas-receber")}
      />
    </AppLayout>
  );
}
