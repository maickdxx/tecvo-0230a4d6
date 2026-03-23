import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Shield, Plus, Edit, Trash2, Activity, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface RateLimitRule {
  id: string;
  name: string;
  endpoint: string;
  limit: number;
  window: number;
  enabled: boolean;
  scope: "global" | "user" | "ip";
  currentUsage?: number;
  blocked?: number;
}

export function RateLimiting() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newRule, setNewRule] = useState({
    name: "",
    endpoint: "",
    limit: 100,
    window: 60,
    scope: "user" as const,
  });

  const [rules, setRules] = useState<RateLimitRule[]>([
    {
      id: "1",
      name: "API Geral",
      endpoint: "/api/*",
      limit: 1000,
      window: 60,
      enabled: true,
      scope: "user",
      currentUsage: 847,
      blocked: 23,
    },
    {
      id: "2",
      name: "WhatsApp Send",
      endpoint: "/api/whatsapp/send",
      limit: 50,
      window: 60,
      enabled: true,
      scope: "user",
      currentUsage: 42,
      blocked: 5,
    },
    {
      id: "3",
      name: "Auth Login",
      endpoint: "/auth/login",
      limit: 5,
      window: 300,
      enabled: true,
      scope: "ip",
      currentUsage: 3,
      blocked: 128,
    },
    {
      id: "4",
      name: "AI Assistant",
      endpoint: "/api/ai/*",
      limit: 20,
      window: 60,
      enabled: true,
      scope: "user",
      currentUsage: 18,
      blocked: 2,
    },
    {
      id: "5",
      name: "Upload Files",
      endpoint: "/api/upload",
      limit: 10,
      window: 60,
      enabled: true,
      scope: "user",
      currentUsage: 6,
      blocked: 0,
    },
  ]);

  const handleToggle = (id: string) => {
    setRules(prev =>
      prev.map(rule =>
        rule.id === id ? { ...rule, enabled: !rule.enabled } : rule
      )
    );
    toast.success("Regra atualizada");
  };

  const handleDelete = (id: string) => {
    setRules(prev => prev.filter(rule => rule.id !== id));
    toast.success("Regra removida");
  };

  const handleAddRule = () => {
    if (!newRule.name || !newRule.endpoint) {
      toast.error("Nome e endpoint sao obrigatorios");
      return;
    }

    const newRateLimitRule: RateLimitRule = {
      id: Date.now().toString(),
      name: newRule.name,
      endpoint: newRule.endpoint,
      limit: newRule.limit,
      window: newRule.window,
      enabled: true,
      scope: newRule.scope,
      currentUsage: 0,
      blocked: 0,
    };

    setRules(prev => [newRateLimitRule, ...prev]);
    setNewRule({ name: "", endpoint: "", limit: 100, window: 60, scope: "user" });
    setIsAddDialogOpen(false);
    toast.success("Regra criada");
  };

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case "global":
        return <Badge variant="default">Global</Badge>;
      case "user":
        return <Badge variant="secondary">Usuario</Badge>;
      case "ip":
        return <Badge variant="outline">IP</Badge>;
      default:
        return null;
    }
  };

  const getUsagePercentage = (current?: number, limit?: number) => {
    if (!current || !limit) return 0;
    return (current / limit) * 100;
  };

  const totalBlocked = rules.reduce((sum, rule) => sum + (rule.blocked || 0), 0);
  const totalRequests = rules.reduce((sum, rule) => sum + (rule.currentUsage || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Regras Ativas</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {rules.filter(r => r.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">
              de {rules.length} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Requisicoes</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRequests.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Ultima hora</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bloqueadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBlocked}</div>
            <p className="text-xs text-muted-foreground">Requisicoes negadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Bloqueio</CardTitle>
            <Shield className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalRequests > 0 ? ((totalBlocked / totalRequests) * 100).toFixed(1) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">Do total</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rate Limiting</CardTitle>
              <CardDescription>
                Configure limites de taxa para proteger a API
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Regra
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Regra de Rate Limit</DialogTitle>
                  <DialogDescription>
                    Defina limites de requisicoes para endpoints
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={newRule.name}
                      onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome da regra"
                    />
                  </div>
                  <div>
                    <Label htmlFor="endpoint">Endpoint</Label>
                    <Input
                      id="endpoint"
                      value={newRule.endpoint}
                      onChange={(e) => setNewRule(prev => ({ ...prev, endpoint: e.target.value }))}
                      placeholder="/api/endpoint/*"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="limit">Limite</Label>
                      <Input
                        id="limit"
                        type="number"
                        value={newRule.limit}
                        onChange={(e) => setNewRule(prev => ({ ...prev, limit: parseInt(e.target.value) }))}
                      />
                    </div>
                    <div>
                      <Label htmlFor="window">Janela (segundos)</Label>
                      <Input
                        id="window"
                        type="number"
                        value={newRule.window}
                        onChange={(e) => setNewRule(prev => ({ ...prev, window: parseInt(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddRule}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Endpoint</TableHead>
                  <TableHead>Limite</TableHead>
                  <TableHead>Escopo</TableHead>
                  <TableHead>Uso Atual</TableHead>
                  <TableHead>Bloqueadas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.map((rule) => {
                  const usagePercentage = getUsagePercentage(rule.currentUsage, rule.limit);
                  return (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div className="font-medium">{rule.name}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">
                          {rule.endpoint}
                        </code>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <div className="font-medium">{rule.limit} req</div>
                          <div className="text-muted-foreground">
                            por {rule.window}s
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{getScopeBadge(rule.scope)}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm font-medium">
                            {rule.currentUsage} / {rule.limit}
                          </div>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                usagePercentage > 90
                                  ? "bg-red-600"
                                  : usagePercentage > 70
                                  ? "bg-yellow-600"
                                  : "bg-green-600"
                              }`}
                              style={{ width: `${usagePercentage}%` }}
                            />
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          <span className="font-medium text-red-600">
                            {rule.blocked}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.enabled}
                          onCheckedChange={() => handleToggle(rule.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
