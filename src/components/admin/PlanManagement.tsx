import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, CreditCard as Edit, Users, DollarSign, Check } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  slug: string;
  price: number;
  features: string[];
  subscriberCount: number;
  isActive: boolean;
}

export function PlanManagement() {
  const [plans] = useState<Plan[]>([
    {
      id: "1",
      name: "Starter",
      slug: "starter",
      price: 97,
      features: [
        "Até 50 OS/mês",
        "1 usuário",
        "WhatsApp básico",
        "Relatórios simples",
      ],
      subscriberCount: 15,
      isActive: true,
    },
    {
      id: "2",
      name: "Essential",
      slug: "essential",
      price: 197,
      features: [
        "Até 200 OS/mês",
        "3 usuários",
        "WhatsApp completo",
        "Relatórios avançados",
        "Portal do cliente",
      ],
      subscriberCount: 42,
      isActive: true,
    },
    {
      id: "3",
      name: "Pro",
      slug: "pro",
      price: 397,
      features: [
        "OS ilimitadas",
        "Usuários ilimitados",
        "WhatsApp + IA",
        "Todos os recursos",
        "Suporte prioritário",
        "API de integração",
      ],
      subscriberCount: 23,
      isActive: true,
    },
  ]);

  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleEdit = (plan: Plan) => {
    setEditingPlan(plan);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setEditingPlan(null);
    setIsDialogOpen(true);
  };

  const totalRevenue = plans.reduce((sum, plan) => sum + (plan.price * plan.subscriberCount), 0);
  const totalSubscribers = plans.reduce((sum, plan) => sum + plan.subscriberCount, 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Planos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{plans.length}</div>
            <p className="text-xs text-muted-foreground">
              {plans.filter(p => p.isActive).length} ativos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Assinantes</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalSubscribers}</div>
            <p className="text-xs text-muted-foreground">
              Em todos os planos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Receita Total (MRR)</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {new Intl.NumberFormat("pt-BR", {
                style: "currency",
                currency: "BRL",
              }).format(totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Receita mensal recorrente
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Planos e Assinaturas</CardTitle>
            <CardDescription>
              Gerencie os planos disponíveis e seus assinantes
            </CardDescription>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>
                  {editingPlan ? "Editar Plano" : "Criar Novo Plano"}
                </DialogTitle>
                <DialogDescription>
                  Configure os detalhes do plano de assinatura
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome do Plano</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Profissional"
                      defaultValue={editingPlan?.name}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price">Preço Mensal (R$)</Label>
                    <Input
                      id="price"
                      type="number"
                      placeholder="197"
                      defaultValue={editingPlan?.price}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="features">Recursos (um por linha)</Label>
                  <Textarea
                    id="features"
                    placeholder="Até 200 OS/mês&#10;3 usuários&#10;WhatsApp completo"
                    rows={6}
                    defaultValue={editingPlan?.features.join("\n")}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button>
                    {editingPlan ? "Salvar Alterações" : "Criar Plano"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Plano</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>Assinantes</TableHead>
                <TableHead>Receita/Mês</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan) => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{plan.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {plan.features.length} recursos
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(plan.price)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {plan.subscriberCount}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(plan.price * plan.subscriberCount)}
                  </TableCell>
                  <TableCell>
                    {plan.isActive ? (
                      <Badge variant="default" className="gap-1">
                        <Check className="h-3 w-3" />
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(plan)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => (
          <Card key={plan.id} className="relative">
            {plan.subscriberCount > 30 && (
              <Badge className="absolute top-4 right-4" variant="default">
                Popular
              </Badge>
            )}
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
              <div className="text-3xl font-bold">
                {new Intl.NumberFormat("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                }).format(plan.price)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Assinantes:</span>
                  <span className="font-medium">{plan.subscriberCount}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Receita/Mês:</span>
                  <span className="font-medium">
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(plan.price * plan.subscriberCount)}
                  </span>
                </div>
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium mb-2">Recursos:</div>
                  <ul className="space-y-1">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
