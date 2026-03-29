import { useState } from "react";
import { AppLayout } from "@/components/layout";
import { ClientFullForm } from "@/components/clients/ClientFullForm";
import { useClients, type ClientFormData } from "@/hooks/useClients";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Users, ArrowRight, Loader2, CheckCircle2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { useGuidedOnboarding } from "@/hooks/useGuidedOnboarding";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";

function QuickClientForm({
  onSubmit,
  isSubmitting,
  onShowFullForm,
}: {
  onSubmit: (data: ClientFormData) => Promise<void>;
  isSubmitting: boolean;
  onShowFullForm: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ variant: "destructive", title: "Nome obrigatório", description: "Informe o nome do cliente." });
      return;
    }
    if (phone.replace(/\D/g, "").length < 10) {
      toast({ variant: "destructive", title: "Telefone obrigatório", description: "Informe um telefone válido." });
      return;
    }
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      person_type: "pf",
    } as ClientFormData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="border-0 shadow-none">
        <CardContent className="p-0 space-y-6">
          <div className="text-center mb-2">
            <div className="flex justify-center mb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Users className="h-8 w-8 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-foreground">
              Vamos cadastrar seu primeiro cliente
            </h2>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              Comece pelo básico. Você pode completar o resto depois.
            </p>
          </div>

          <div className="space-y-4 max-w-md mx-auto">
            <div>
              <Label htmlFor="quick-name">Nome do Cliente</Label>
              <Input
                id="quick-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: João Silva"
                className="text-base h-12"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="quick-phone">Telefone</Label>
              <Input
                id="quick-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="text-base h-12"
              />
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 pt-2">
            <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[240px] gap-2">
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {isSubmitting ? "Salvando..." : "Salvar e continuar"}
              {!isSubmitting && <ArrowRight className="h-4 w-4" />}
            </Button>
            
            <Button 
              type="button" 
              variant="ghost" 
              size="sm" 
              onClick={onShowFullForm}
              className="text-muted-foreground hover:text-primary transition-colors"
            >
              Desejo preencher todos os dados (Cadastro completo)
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

export default function NovoCliente() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { create, isCreating } = useClients();
  const { showGuide, steps } = useGuidedOnboarding();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  // Activation mode: first client hasn't been created yet
  const isActivationMode = showGuide && !steps[0]?.completed;
  const fromChecklist = searchParams.get("from") === "checklist";
  const useQuickForm = isActivationMode || fromChecklist;

  const handleQuickSubmit = async (data: ClientFormData) => {
    await create(data);
    await queryClient.invalidateQueries({ queryKey: ["guided-onboarding"] });
    setShowSuccess(true);
    setTimeout(() => {
      navigate("/ordens-servico/nova?from=checklist");
    }, 1500);
  };

  const handleFullSubmit = async (data: ClientFormData) => {
    await create(data);
    navigate("/clientes");
  };

  if (showSuccess) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 animate-in fade-in duration-300">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <CheckCircle2 className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center space-y-2 max-w-sm">
            <h2 className="text-lg font-bold text-foreground">Cliente criado com sucesso!</h2>
            <p className="text-sm text-muted-foreground">
              Agora vamos cadastrar seu primeiro serviço.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (useQuickForm) {
    return (
      <AppLayout>
        <div className="max-w-lg mx-auto py-8">
          <QuickClientForm onSubmit={handleQuickSubmit} isSubmitting={isCreating} />
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
        <h1 className="text-2xl font-bold text-foreground">Novo Cliente</h1>
        <p className="text-muted-foreground">Preencha os dados do novo cliente</p>
      </div>
      <ClientFullForm onSubmit={handleFullSubmit} isSubmitting={isCreating} onCancel={() => navigate("/clientes")} />
    </AppLayout>
  );
}
