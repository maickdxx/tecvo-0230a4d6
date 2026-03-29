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
import { Search, Download, User, Building2, Settings, Trash2, CreditCard as Edit, Plus, Shield, Calendar, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";

interface AuditLogRow {
  id: string;
  operation: string;
  table_name: string;
  record_id: string | null;
  user_id: string | null;
  organization_id: string | null;
  ip_address: string | null;
  metadata: Record<string, any> | null;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  created_at: string;
}

type ActionType = "INSERT" | "UPDATE" | "DELETE" | "other";

function classifyAction(operation: string): ActionType {
  const op = operation.toUpperCase();
  if (op === "INSERT" || op === "CREATE") return "INSERT";
  if (op === "UPDATE") return "UPDATE";
  if (op === "DELETE") return "DELETE";
  return "other";
}

export function AuditLogs() {
  const { isSuperAdmin } = useSuperAdmin();
  const [searchTerm, setSearchTerm] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [limit, setLimit] = useState(100);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-logs-real", actionFilter, limit],
    queryFn: async () => {
      let query = supabase
        .from("data_audit_log")
        .select("id, operation, table_name, record_id, user_id, organization_id, ip_address, metadata, old_data, new_data, created_at")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (actionFilter !== "all") {
        query = query.eq("operation", actionFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AuditLogRow[];
    },
    enabled: isSuperAdmin,
  });

  // Fetch org names for display
  const orgIds = [...new Set(logs.filter(l => l.organization_id).map(l => l.organization_id!))];
  const { data: orgMap = new Map<string, string>() } = useQuery({
    queryKey: ["audit-org-names", orgIds.join(",")],
    queryFn: async () => {
      if (orgIds.length === 0) return new Map<string, string>();
      const { data } = await supabase
        .from("organizations")
        .select("id, name")
        .in("id", orgIds);
      return new Map((data || []).map(o => [o.id, o.name]));
    },
    enabled: isSuperAdmin && orgIds.length > 0,
  });

  const getActionIcon = (actionType: ActionType) => {
    switch (actionType) {
      case "INSERT":
        return <Plus className="h-4 w-4 text-green-600" />;
      case "UPDATE":
        return <Edit className="h-4 w-4 text-blue-600" />;
      case "DELETE":
        return <Trash2 className="h-4 w-4 text-red-600" />;
      default:
        return <Shield className="h-4 w-4 text-purple-600" />;
    }
  };

  const getActionBadge = (actionType: ActionType) => {
    switch (actionType) {
      case "INSERT":
        return <Badge variant="default" className="bg-green-600">Criação</Badge>;
      case "UPDATE":
        return <Badge variant="default" className="bg-blue-600">Atualização</Badge>;
      case "DELETE":
        return <Badge variant="destructive">Exclusão</Badge>;
      default:
        return <Badge variant="default" className="bg-purple-600">{actionType}</Badge>;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return format(new Date(timestamp), "dd/MM/yyyy HH:mm:ss");
  };

  const filteredLogs = logs.filter(log => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      log.operation.toLowerCase().includes(term) ||
      log.table_name.toLowerCase().includes(term) ||
      log.user_id?.toLowerCase().includes(term) ||
      (log.organization_id && orgMap.get(log.organization_id)?.toLowerCase().includes(term))
    );
  });

  const handleExport = () => {
    const csvRows = [
      ["ID", "Operação", "Tabela", "Usuário", "Organização", "IP", "Data"].join(","),
      ...filteredLogs.map(log => [
        log.id,
        log.operation,
        log.table_name,
        log.user_id || "",
        log.organization_id ? (orgMap.get(log.organization_id) || log.organization_id) : "",
        log.ip_address || "",
        formatTimestamp(log.created_at),
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Stats from real data
  const insertCount = logs.filter(l => classifyAction(l.operation) === "INSERT").length;
  const updateCount = logs.filter(l => classifyAction(l.operation) === "UPDATE").length;
  const deleteCount = logs.filter(l => classifyAction(l.operation) === "DELETE").length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg">Logs de Auditoria</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Registros reais de operações no banco de dados
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filteredLogs.length === 0} className="w-full sm:w-auto">
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 mb-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Tipo de ação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="INSERT">Criação</SelectItem>
                <SelectItem value="UPDATE">Atualização</SelectItem>
                <SelectItem value="DELETE">Exclusão</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Operação / Tabela</TableHead>
                    <TableHead>Organização</TableHead>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>IP</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        Nenhum log encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLogs.map((log) => {
                      const actionType = classifyAction(log.operation);
                      return (
                        <TableRow key={log.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getActionIcon(actionType)}
                              {getActionBadge(actionType)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.operation}</div>
                              <div className="text-sm text-muted-foreground">
                                {log.table_name}
                                {log.record_id && <span className="ml-1 font-mono text-xs">({log.record_id.slice(0, 8)}…)</span>}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {log.organization_id ? (
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-sm">{orgMap.get(log.organization_id) || log.organization_id.slice(0, 8)}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">{formatTimestamp(log.created_at)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground font-mono">
                              {log.ip_address || "—"}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredLogs.length >= limit && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" size="sm" onClick={() => setLimit(prev => prev + 100)}>
                Carregar mais
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Ações</CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
            <p className="text-xs text-muted-foreground">Últimos registros carregados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Criações</CardTitle>
            <Plus className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insertCount}</div>
            <p className="text-xs text-muted-foreground">INSERT</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atualizações</CardTitle>
            <Edit className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{updateCount}</div>
            <p className="text-xs text-muted-foreground">UPDATE</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Exclusões</CardTitle>
            <Trash2 className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deleteCount}</div>
            <p className="text-xs text-muted-foreground">DELETE</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
