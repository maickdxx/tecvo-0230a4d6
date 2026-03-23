import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Flag, Plus, Search, Trash2, Edit, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  enabled: boolean;
  scope: "global" | "organization" | "user";
  createdAt: string;
  updatedAt: string;
}

export function FeatureFlags() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newFlag, setNewFlag] = useState({
    name: "",
    key: "",
    description: "",
    scope: "global" as const,
  });

  const [flags, setFlags] = useState<FeatureFlag[]>([
    {
      id: "1",
      name: "WhatsApp Bot Automation",
      key: "whatsapp_bot_automation",
      description: "Habilita automacao de bots no WhatsApp",
      enabled: true,
      scope: "global",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "2",
      name: "AI Assistant Beta",
      key: "ai_assistant_beta",
      description: "Acesso ao novo assistente de IA",
      enabled: false,
      scope: "organization",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "3",
      name: "Advanced Analytics",
      key: "advanced_analytics",
      description: "Dashboard de analytics avancado",
      enabled: true,
      scope: "global",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: "4",
      name: "Multi-Channel Support",
      key: "multi_channel_support",
      description: "Suporte a multiplos canais de atendimento",
      enabled: false,
      scope: "organization",
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ]);

  const handleToggle = (id: string) => {
    setFlags(prev =>
      prev.map(flag =>
        flag.id === id ? { ...flag, enabled: !flag.enabled, updatedAt: new Date().toISOString() } : flag
      )
    );
    toast.success("Feature flag atualizada");
  };

  const handleDelete = (id: string) => {
    setFlags(prev => prev.filter(flag => flag.id !== id));
    toast.success("Feature flag removida");
  };

  const handleAddFlag = () => {
    if (!newFlag.name || !newFlag.key) {
      toast.error("Nome e chave sao obrigatorios");
      return;
    }

    const newFeatureFlag: FeatureFlag = {
      id: Date.now().toString(),
      name: newFlag.name,
      key: newFlag.key,
      description: newFlag.description,
      enabled: false,
      scope: newFlag.scope,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setFlags(prev => [newFeatureFlag, ...prev]);
    setNewFlag({ name: "", key: "", description: "", scope: "global" });
    setIsAddDialogOpen(false);
    toast.success("Feature flag criada");
  };

  const filteredFlags = flags.filter(flag =>
    flag.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    flag.key.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getScopeBadge = (scope: string) => {
    switch (scope) {
      case "global":
        return <Badge variant="default">Global</Badge>;
      case "organization":
        return <Badge variant="secondary">Organizacao</Badge>;
      case "user":
        return <Badge variant="outline">Usuario</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Gerencie funcionalidades habilitadas na plataforma
              </CardDescription>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Flag
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Feature Flag</DialogTitle>
                  <DialogDescription>
                    Adicione uma nova flag para controlar funcionalidades
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="name">Nome</Label>
                    <Input
                      id="name"
                      value={newFlag.name}
                      onChange={(e) => setNewFlag(prev => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome da feature"
                    />
                  </div>
                  <div>
                    <Label htmlFor="key">Chave</Label>
                    <Input
                      id="key"
                      value={newFlag.key}
                      onChange={(e) => setNewFlag(prev => ({ ...prev, key: e.target.value }))}
                      placeholder="feature_key_name"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Descricao</Label>
                    <Input
                      id="description"
                      value={newFlag.description}
                      onChange={(e) => setNewFlag(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Descricao da feature"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button onClick={handleAddFlag}>Criar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar feature flags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-3">
            {filteredFlags.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma feature flag encontrada
              </div>
            ) : (
              filteredFlags.map((flag) => (
                <div
                  key={flag.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start gap-4 flex-1">
                    <div className="mt-1">
                      <Flag className={`h-5 w-5 ${flag.enabled ? "text-green-600" : "text-gray-400"}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{flag.name}</h4>
                        {getScopeBadge(flag.scope)}
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        {flag.description}
                      </p>
                      <code className="text-xs bg-muted px-2 py-1 rounded">
                        {flag.key}
                      </code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={flag.enabled}
                      onCheckedChange={() => handleToggle(flag.id)}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(flag.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Flags</CardTitle>
            <Flag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{flags.length}</div>
            <p className="text-xs text-muted-foreground">Flags cadastradas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativas</CardTitle>
            <Flag className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {flags.filter(f => f.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">Features habilitadas</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inativas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {flags.filter(f => !f.enabled).length}
            </div>
            <p className="text-xs text-muted-foreground">Features desabilitadas</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
