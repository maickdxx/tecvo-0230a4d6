import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Database,
  Download,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  FileCheck,
  HardDrive,
  Cloud,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface BackupLog {
  id: string;
  organization_id: string;
  backup_path: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  size_bytes: number | null;
  record_counts: any;
  tables_included: string[];
  error_message: string | null;
}

interface ExternalBackupLog {
  id: string;
  organization_id: string | null;
  backup_date: string;
  s3_key: string;
  status: string;
  size_bytes: number | null;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  metadata: any;
}

interface ValidationResult {
  table: string;
  backup_count: number;
  live_count: number;
  match: boolean;
  issues: string[];
}

interface ValidationReport {
  results: ValidationResult[];
  overall: boolean;
  duration_ms: number;
}

function normalizeValidationResponse(data: unknown): ValidationReport {
  if (!data || typeof data !== "object") {
    throw new Error("Resposta inválida da validação.");
  }

  const report = data as Record<string, any>;
  const rawResults = Array.isArray(report.results)
    ? report.results
    : Array.isArray(report.tables)
      ? report.tables
      : [];

  const results: ValidationResult[] = rawResults.map((item) => ({
    table: typeof item?.table === "string" ? item.table : "Tabela desconhecida",
    backup_count: typeof item?.backup_count === "number" ? item.backup_count : 0,
    live_count: typeof item?.live_count === "number" ? item.live_count : 0,
    match: Boolean(item?.match),
    issues: Array.isArray(item?.issues)
      ? item.issues.filter((issue: unknown): issue is string => typeof issue === "string")
      : [],
  }));

  return {
    results,
    overall:
      typeof report.overall === "boolean"
        ? report.overall
        : report.status === "PASS" || results.every((result) => result.match),
    duration_ms:
      typeof report.duration_ms === "number"
        ? report.duration_ms
        : typeof report.validation_duration_ms === "number"
          ? report.validation_duration_ms
          : 0,
  };
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    completed: { label: "Concluído", variant: "default" },
    uploading: { label: "Enviando", variant: "secondary" },
    failed: { label: "Falhou", variant: "destructive" },
    expired: { label: "Expirado", variant: "outline" },
    running: { label: "Em execução", variant: "secondary" },
  };
  const info = map[status] || { label: status, variant: "outline" as const };
  return <Badge variant={info.variant}>{info.label}</Badge>;
}

export function AdminBackups() {
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState<string>("all");
  const [validatingId, setValidatingId] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ValidationReport | null>(null);
  const [showValidation, setShowValidation] = useState(false);

  // Fetch internal backup logs
  const { data: backupLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["admin-backup-logs", selectedOrg],
    queryFn: async () => {
      let query = supabase
        .from("backup_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (selectedOrg !== "all") {
        query = query.eq("organization_id", selectedOrg);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as BackupLog[];
    },
  });

  // Fetch external backup logs
  const { data: externalLogs = [], isLoading: extLoading } = useQuery({
    queryKey: ["admin-external-backup-logs", selectedOrg],
    queryFn: async () => {
      let query = supabase
        .from("external_backup_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);
      if (selectedOrg !== "all") {
        query = query.eq("organization_id", selectedOrg);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as ExternalBackupLog[];
    },
  });

  // Fetch organizations for filter
  const { data: orgs = [] } = useQuery({
    queryKey: ["admin-orgs-for-backup"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Validate backup mutation
  const validateMutation = useMutation({
    mutationFn: async (log: BackupLog) => {
      setValidatingId(log.id);
      toast.loading("Validando backup...", { id: "validate-backup" });

      const { data, error } = await supabase.functions.invoke("validate-backup", {
        body: {
          organization_id: log.organization_id,
          backup_path: log.backup_path,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return normalizeValidationResponse(data);
    },
    onSuccess: (data) => {
      setValidatingId(null);
      toast.dismiss("validate-backup");
      setValidationResult(data);
      setShowValidation(true);

      if (data.overall) {
        toast.success("Backup íntegro! Todos os dados conferem.");
      } else {
        toast.warning("Backup com divergências encontradas.");
      }
    },
    onError: (err: any) => {
      setValidatingId(null);
      toast.dismiss("validate-backup");
      toast.error(`Erro na validação: ${err.message}`);
    },
  });

  // Trigger manual backup
  const triggerBackupMutation = useMutation({
    mutationFn: async (orgId?: string) => {
      const { data, error } = await supabase.functions.invoke("auto-org-backup", {
        body: orgId ? { organization_id: orgId } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Backup iniciado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["admin-backup-logs"] });
    },
    onError: (err: any) => {
      toast.error(`Erro ao iniciar backup: ${err.message}`);
    },
  });

  // Trigger external sync
  const triggerSyncMutation = useMutation({
    mutationFn: async (orgId?: string) => {
      const { data, error } = await supabase.functions.invoke("external-backup-sync", {
        body: orgId ? { organization_id: orgId } : {},
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data?.error) {
        toast.warning(data.error);
      } else {
        toast.success(`Sync externo concluído! ${data?.total || 0} backup(s) processado(s).`);
      }
      queryClient.invalidateQueries({ queryKey: ["admin-external-backup-logs"] });
    },
    onError: (err: any) => {
      toast.error(`Erro no sync externo: ${err.message}`);
    },
  });

  const getOrgName = (orgId: string | null) => {
    if (!orgId) return "—";
    const org = orgs.find((o) => o.id === orgId);
    return org?.name || orgId.slice(0, 8) + "...";
  };

  const completedBackups = backupLogs.filter((l) => l.status === "completed").length;
  const failedBackups = backupLogs.filter((l) => l.status === "failed").length;
  const completedExternal = externalLogs.filter((l) => l.status === "completed").length;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <HardDrive className="h-4 w-4" />
              Internos
            </div>
            <p className="text-2xl font-bold">{completedBackups}</p>
            <p className="text-xs text-muted-foreground">concluídos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Cloud className="h-4 w-4" />
              Externos
            </div>
            <p className="text-2xl font-bold">{completedExternal}</p>
            <p className="text-xs text-muted-foreground">sincronizados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <XCircle className="h-4 w-4 text-destructive" />
              Falhas
            </div>
            <p className="text-2xl font-bold">{failedBackups}</p>
            <p className="text-xs text-muted-foreground">com erro</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
              <Database className="h-4 w-4" />
              Organizações
            </div>
            <p className="text-2xl font-bold">{orgs.length}</p>
            <p className="text-xs text-muted-foreground">cadastradas</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions bar */}
      <Card>
        <CardContent className="py-3 px-4 flex flex-wrap items-center gap-3">
          <Select value={selectedOrg} onValueChange={setSelectedOrg}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por organização" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as organizações</SelectItem>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            size="sm"
            onClick={() => triggerBackupMutation.mutate(selectedOrg !== "all" ? selectedOrg : undefined)}
            disabled={triggerBackupMutation.isPending}
          >
            <Download className="h-4 w-4 mr-2" />
            {triggerBackupMutation.isPending ? "Executando..." : "Backup Agora"}
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerSyncMutation.mutate(selectedOrg !== "all" ? selectedOrg : undefined)}
            disabled={triggerSyncMutation.isPending}
          >
            <Cloud className="h-4 w-4 mr-2" />
            {triggerSyncMutation.isPending ? "Sincronizando..." : "Sync Externo"}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["admin-backup-logs"] });
              queryClient.invalidateQueries({ queryKey: ["admin-external-backup-logs"] });
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Internal backups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Backups Internos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logsLoading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : backupLogs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">Nenhum backup encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Organização</th>
                    <th className="text-left py-2 px-3 font-medium">Data</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Tamanho</th>
                    <th className="text-left py-2 px-3 font-medium">Tabelas</th>
                    <th className="text-left py-2 px-3 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {backupLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 max-w-[150px] truncate">{getOrgName(log.organization_id)}</td>
                      <td className="py-2 px-3 whitespace-nowrap">
                        {new Date(log.started_at).toLocaleDateString("pt-BR")}
                        <span className="text-muted-foreground ml-1">
                          {new Date(log.started_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>
                      <td className="py-2 px-3"><StatusBadge status={log.status} /></td>
                      <td className="py-2 px-3">{formatBytes(log.size_bytes)}</td>
                      <td className="py-2 px-3">{log.tables_included?.length || 0}</td>
                      <td className="py-2 px-3">
                        {log.status === "completed" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => validateMutation.mutate(log)}
                            disabled={validatingId !== null}
                            className="h-7 text-xs"
                          >
                            {validatingId === log.id ? (
                              <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <FileCheck className="h-3 w-3 mr-1" />
                            )}
                            {validatingId === log.id ? "Validando..." : "Validar"}
                          </Button>
                        )}
                        {log.error_message && (
                          <span className="text-xs text-destructive truncate max-w-[200px] inline-block" title={log.error_message}>
                            {log.error_message}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* External backups */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            Backups Externos (S3)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {extLoading ? (
            <div className="p-6 text-center text-muted-foreground">Carregando...</div>
          ) : externalLogs.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              Nenhum backup externo registrado. Configure os secrets S3 para ativar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left py-2 px-3 font-medium">Organização</th>
                    <th className="text-left py-2 px-3 font-medium">Data</th>
                    <th className="text-left py-2 px-3 font-medium">Status</th>
                    <th className="text-left py-2 px-3 font-medium">Tamanho</th>
                    <th className="text-left py-2 px-3 font-medium">Caminho S3</th>
                  </tr>
                </thead>
                <tbody>
                  {externalLogs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/30">
                      <td className="py-2 px-3 max-w-[150px] truncate">{getOrgName(log.organization_id)}</td>
                      <td className="py-2 px-3 whitespace-nowrap">{log.backup_date}</td>
                      <td className="py-2 px-3"><StatusBadge status={log.status} /></td>
                      <td className="py-2 px-3">{formatBytes(log.size_bytes)}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground max-w-[200px] truncate" title={log.s3_key}>
                        {log.s3_key}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation dialog */}
      <Dialog open={showValidation} onOpenChange={setShowValidation}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Resultado da Validação
            </DialogTitle>
            <DialogDescription>
              {validationResult?.overall
                ? "✅ Backup íntegro — todos os dados conferem com o banco atual."
                : "⚠️ Divergências encontradas entre o backup e os dados atuais."}
              {validationResult && (
                <span className="ml-2 text-xs">({validationResult.duration_ms}ms)</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {(validationResult?.results ?? []).map((r) => (
              <div
                key={r.table}
                className={`flex items-center justify-between p-2 rounded text-sm ${
                  r.match ? "bg-green-50 dark:bg-green-950/20" : "bg-amber-50 dark:bg-amber-950/20"
                }`}
              >
                <div className="flex items-center gap-2">
                  {r.match ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : (
                    <XCircle className="h-4 w-4 text-amber-600" />
                  )}
                  <div>
                    <span className="font-medium">{r.table}</span>
                    {r.issues.length > 0 && (
                      <p className="text-xs text-muted-foreground">{r.issues[0]}</p>
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
                  Backup: {r.backup_count} | Atual: {r.live_count}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
