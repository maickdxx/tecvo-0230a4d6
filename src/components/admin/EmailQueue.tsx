import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Mail, Search, RefreshCw, Trash2, Play, Pause, AlertTriangle, CheckCircle, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface EmailQueueItem {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: "pending" | "processing" | "sent" | "failed" | "retrying";
  priority: "high" | "normal" | "low";
  attempts: number;
  maxAttempts: number;
  scheduledFor?: string;
  sentAt?: string;
  error?: string;
  createdAt: string;
}

export function EmailQueue() {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [queueItems] = useState<EmailQueueItem[]>([
    {
      id: "1",
      to: "cliente@exemplo.com",
      subject: "Confirmacao de Servico",
      template: "service_confirmation",
      status: "sent",
      priority: "high",
      attempts: 1,
      maxAttempts: 3,
      sentAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString(),
    },
    {
      id: "2",
      to: "usuario@empresa.com",
      subject: "Relatorio Mensal",
      template: "monthly_report",
      status: "pending",
      priority: "normal",
      attempts: 0,
      maxAttempts: 3,
      scheduledFor: new Date(Date.now() + 1000 * 60 * 30).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
    },
    {
      id: "3",
      to: "admin@tecvo.com.br",
      subject: "Alerta de Sistema",
      template: "system_alert",
      status: "failed",
      priority: "high",
      attempts: 3,
      maxAttempts: 3,
      error: "SMTP connection timeout",
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    },
    {
      id: "4",
      to: "contato@empresa.com",
      subject: "Lembrete de Pagamento",
      template: "payment_reminder",
      status: "retrying",
      priority: "normal",
      attempts: 2,
      maxAttempts: 3,
      error: "Temporary server error",
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: "5",
      to: "suporte@cliente.com",
      subject: "Resposta ao Ticket",
      template: "support_response",
      status: "processing",
      priority: "high",
      attempts: 1,
      maxAttempts: 3,
      createdAt: new Date(Date.now() - 1000 * 30).toISOString(),
    },
  ]);

  const [queueStats] = useState({
    total: 1247,
    pending: 89,
    processing: 12,
    sent: 1098,
    failed: 48,
    avgDeliveryTime: 3.2,
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsRefreshing(false);
    toast.success("Fila atualizada");
  };

  const handleRetry = (id: string) => {
    toast.success("Email reenviado para fila");
  };

  const handleDelete = (id: string) => {
    toast.success("Email removido da fila");
  };

  const handlePause = () => {
    toast.success("Fila pausada");
  };

  const handleResume = () => {
    toast.success("Fila retomada");
  };

  const getStatusIcon = (status: EmailQueueItem["status"]) => {
    switch (status) {
      case "pending":
        return <Clock className="h-4 w-4 text-gray-400" />;
      case "processing":
        return <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />;
      case "sent":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "failed":
        return <XCircle className="h-4 w-4 text-red-600" />;
      case "retrying":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusBadge = (status: EmailQueueItem["status"]) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "processing":
        return <Badge variant="default" className="bg-blue-600">Processando</Badge>;
      case "sent":
        return <Badge variant="default" className="bg-green-600">Enviado</Badge>;
      case "failed":
        return <Badge variant="destructive">Falhou</Badge>;
      case "retrying":
        return <Badge variant="default" className="bg-yellow-600">Tentando</Badge>;
    }
  };

  const getPriorityBadge = (priority: EmailQueueItem["priority"]) => {
    switch (priority) {
      case "high":
        return <Badge variant="destructive">Alta</Badge>;
      case "normal":
        return <Badge variant="secondary">Normal</Badge>;
      case "low":
        return <Badge variant="outline">Baixa</Badge>;
    }
  };

  const filteredItems = queueItems.filter(item => {
    const matchesSearch =
      item.to.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subject.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats.total}</div>
            <p className="text-xs text-muted-foreground">Emails na fila</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats.pending}</div>
            <p className="text-xs text-muted-foreground">Aguardando envio</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Enviados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats.sent}</div>
            <p className="text-xs text-muted-foreground">Ultimas 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Medio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{queueStats.avgDeliveryTime}s</div>
            <p className="text-xs text-muted-foreground">Entrega media</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Fila de Emails</CardTitle>
              <CardDescription>
                Gerencie emails pendentes e enviados
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" onClick={handlePause}>
                <Pause className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleResume}>
                <Play className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por destinatario ou assunto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full md:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="processing">Processando</SelectItem>
                <SelectItem value="sent">Enviados</SelectItem>
                <SelectItem value="failed">Falhas</SelectItem>
                <SelectItem value="retrying">Tentando</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Destinatario</TableHead>
                  <TableHead>Assunto</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum email encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(item.status)}
                          {getStatusBadge(item.status)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Mail className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{item.to}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium text-sm">{item.subject}</div>
                          {item.error && (
                            <div className="text-xs text-red-600 mt-1">{item.error}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getPriorityBadge(item.priority)}</TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {item.attempts}/{item.maxAttempts}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(item.createdAt), "dd/MM HH:mm")}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(item.status === "failed" || item.status === "retrying") && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRetry(item.id)}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(item.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
