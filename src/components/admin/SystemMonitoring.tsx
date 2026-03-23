import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Server, MessageSquare, Database, Zap, CircleCheck as CheckCircle2, Circle as XCircle, TriangleAlert as AlertTriangle, RefreshCw, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface SystemStatus {
  name: string;
  status: "online" | "offline" | "warning";
  uptime: string;
  responseTime?: number;
  lastCheck: string;
}

export function SystemMonitoring() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [systems] = useState<SystemStatus[]>([
    {
      name: "API Principal",
      status: "online",
      uptime: "99.9%",
      responseTime: 120,
      lastCheck: new Date().toISOString(),
    },
    {
      name: "Banco de Dados",
      status: "online",
      uptime: "100%",
      responseTime: 45,
      lastCheck: new Date().toISOString(),
    },
    {
      name: "WhatsApp API",
      status: "online",
      uptime: "98.5%",
      responseTime: 250,
      lastCheck: new Date().toISOString(),
    },
    {
      name: "Storage (Supabase)",
      status: "online",
      uptime: "99.7%",
      responseTime: 180,
      lastCheck: new Date().toISOString(),
    },
    {
      name: "Email Service",
      status: "online",
      uptime: "99.2%",
      responseTime: 320,
      lastCheck: new Date().toISOString(),
    },
    {
      name: "IA/OpenAI",
      status: "warning",
      uptime: "95.1%",
      responseTime: 1500,
      lastCheck: new Date().toISOString(),
    },
  ]);

  const [resources] = useState({
    cpu: 45,
    memory: 62,
    storage: 38,
    bandwidth: 28,
  });

  const [errors] = useState([
    {
      id: "1",
      level: "error",
      message: "Database connection timeout",
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      service: "API",
    },
    {
      id: "2",
      level: "warning",
      message: "High memory usage detected",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      service: "Server",
    },
    {
      id: "3",
      level: "info",
      message: "WhatsApp API rate limit approaching",
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      service: "WhatsApp",
    },
  ]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: SystemStatus["status"]) => {
    switch (status) {
      case "online":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "offline":
        return <XCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: SystemStatus["status"]) => {
    switch (status) {
      case "online":
        return <Badge variant="default" className="bg-green-600">Online</Badge>;
      case "offline":
        return <Badge variant="destructive">Offline</Badge>;
      case "warning":
        return <Badge variant="default" className="bg-yellow-600">Alerta</Badge>;
    }
  };

  const getErrorIcon = (level: string) => {
    switch (level) {
      case "error":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      case "info":
        return <Activity className="h-4 w-4 text-blue-600" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now.getTime() - date.getTime()) / 1000 / 60);

    if (diff < 1) return "agora";
    if (diff < 60) return `${diff}min atrás`;
    if (diff < 1440) return `${Math.floor(diff / 60)}h atrás`;
    return `${Math.floor(diff / 1440)}d atrás`;
  };

  const onlineCount = systems.filter(s => s.status === "online").length;
  const averageResponseTime = systems.reduce((sum, s) => sum + (s.responseTime || 0), 0) / systems.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium">Status do Sistema</h3>
          <p className="text-sm text-muted-foreground">
            Monitoramento em tempo real dos serviços
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Status Geral</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onlineCount}/{systems.length}</div>
            <p className="text-xs text-muted-foreground">
              Serviços operacionais
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo de Resposta</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(averageResponseTime)}ms</div>
            <p className="text-xs text-muted-foreground">
              Média atual
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">CPU</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resources.cpu}%</div>
            <Progress value={resources.cpu} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Memória</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resources.memory}%</div>
            <Progress value={resources.memory} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Status dos Serviços</CardTitle>
          <CardDescription>
            Monitoramento individual de cada serviço
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {systems.map((system, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(system.status)}
                  <div>
                    <div className="font-medium">{system.name}</div>
                    <div className="text-sm text-muted-foreground">
                      Uptime: {system.uptime}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {system.responseTime && (
                    <div className="text-right">
                      <div className="text-sm font-medium">{system.responseTime}ms</div>
                      <div className="text-xs text-muted-foreground">Resposta</div>
                    </div>
                  )}
                  {getStatusBadge(system.status)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Uso de Recursos</CardTitle>
            <CardDescription>Consumo atual do sistema</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">CPU</span>
                <span className="text-sm text-muted-foreground">{resources.cpu}%</span>
              </div>
              <Progress value={resources.cpu} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Memória</span>
                <span className="text-sm text-muted-foreground">{resources.memory}%</span>
              </div>
              <Progress value={resources.memory} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Armazenamento</span>
                <span className="text-sm text-muted-foreground">{resources.storage}%</span>
              </div>
              <Progress value={resources.storage} />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Banda</span>
                <span className="text-sm text-muted-foreground">{resources.bandwidth}%</span>
              </div>
              <Progress value={resources.bandwidth} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs de Erro Recentes</CardTitle>
            <CardDescription>
              Últimos alertas e erros do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {errors.map((error) => (
                <div
                  key={error.id}
                  className="flex items-start gap-3 p-3 border rounded-lg"
                >
                  {getErrorIcon(error.level)}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{error.message}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {error.service} • {formatTimestamp(error.timestamp)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
