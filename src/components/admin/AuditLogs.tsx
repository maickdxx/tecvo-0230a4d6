import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter, Download, User, Building2, Settings, Trash2, CreditCard as Edit, Plus, Shield, Calendar } from "lucide-react";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  action: string;
  actionType: "create" | "update" | "delete" | "access";
  userId: string;
  userEmail: string;
  organizationId?: string;
  organizationName?: string;
  details: string;
  metadata: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
}

export function AuditLogs() {
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [userFilter, setUserFilter] = useState<string>("all");

  const [logs] = useState<AuditLog[]>([
    {
      id: "1",
      action: "Plano atualizado",
      actionType: "update",
      userId: "user-1",
      userEmail: "admin@tecvo.com.br",
      organizationId: "org-1",
      organizationName: "Empresa ABC Ltda",
      details: "Plano alterado de Starter para Pro",
      metadata: { oldPlan: "starter", newPlan: "pro" },
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
      ipAddress: "192.168.1.1",
    },
    {
      id: "2",
      action: "Organização excluída",
      actionType: "delete",
      userId: "user-1",
      userEmail: "admin@tecvo.com.br",
      organizationId: "org-2",
      organizationName: "Tech Solutions",
      details: "Organização e todos os dados foram removidos",
      metadata: { reason: "Solicitação do cliente" },
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      ipAddress: "192.168.1.1",
    },
    {
      id: "3",
      action: "Super Admin concedido",
      actionType: "create",
      userId: "user-1",
      userEmail: "admin@tecvo.com.br",
      details: "Privilégios de super admin concedidos a user@example.com",
      metadata: { targetUserId: "user-3", targetEmail: "user@example.com" },
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
      ipAddress: "192.168.1.1",
    },
    {
      id: "4",
      action: "Configuração alterada",
      actionType: "update",
      userId: "user-1",
      userEmail: "admin@tecvo.com.br",
      details: "Limite de mensagens WhatsApp atualizado",
      metadata: { setting: "whatsapp_message_limit", oldValue: 1000, newValue: 5000 },
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      ipAddress: "192.168.1.1",
    },
    {
      id: "5",
      action: "Acesso ao painel admin",
      actionType: "access",
      userId: "user-2",
      userEmail: "manager@tecvo.com.br",
      details: "Login realizado no painel administrativo",
      metadata: { userAgent: "Chrome/120.0" },
      timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
      ipAddress: "192.168.1.2",
    },
  ]);

  const getActionIcon = (actionType: AuditLog["actionType"]) => {
    switch (actionType) {
      case "create":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "update":
        return <Edit className="h-4 w-4 text-blue-600" />;
      case "delete":
        return <Trash2 className="h-4 w-4 text-red-600" />;
      case "access":
        return <Shield className="h-4 w-4 text-purple-600" />;
    }
  };

  const getActionBadge = (actionType: AuditLog["actionType"]) => {
    switch (actionType) {
      case "create":
        return <Badge variant="default" className="bg-green-600">Criação</Badge>;
      case "update":
        return <Badge variant="default" className="bg-blue-600">Atualização</Badge>;
      case "delete":
        return <Badge variant="destructive">Exclusão</Badge>;
      case "access":
        return <Badge variant="default" className="bg-purple-600">Acesso</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), "dd/MM/yyyy HH:mm:ss");
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.organizationName?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = actionFilter === "all" || log.actionType === actionFilter;
    const matchesUser = userFilter === "all" || log.userId === userFilter;

    return matchesSearch && matchesAction && matchesUser;
  });

  const handleExport = () => {
    console.log("Exportando logs...");
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Logs de Auditoria</CardTitle>
              <CardDescription>
                Registro completo de todas as ações realizadas na plataforma
              </CardDescription>
            </div>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 mb-6 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por ação, usuário ou organização..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full md:w-48">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as ações</SelectItem>
                <SelectItem value="create">Criação</SelectItem>
                <SelectItem value="update">Atualização</SelectItem>
                <SelectItem value="delete">Exclusão</SelectItem>
                <SelectItem value="access">Acesso</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Organização</TableHead>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>IP</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum log encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.actionType)}
                          {getActionBadge(log.actionType)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.action}</div>
                          <div className="text-sm text-muted-foreground">
                            {log.details}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{log.userEmail}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {log.organizationName ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{log.organizationName}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{formatTimestamp(log.timestamp)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground font-mono">
                          {log.ipAddress || "-"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ações</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimas 24 horas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Criações</CardTitle>
            <Plus className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter(l => l.actionType === "create").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Novos registros
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atualizações</CardTitle>
            <Edit className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter(l => l.actionType === "update").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Modificações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exclusões</CardTitle>
            <Trash2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {logs.filter(l => l.actionType === "delete").length}
            </div>
            <p className="text-xs text-muted-foreground">
              Ações críticas
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
