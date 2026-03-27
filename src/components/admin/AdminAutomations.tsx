import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Zap, Play, History, Loader2, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Automation {
  id: string;
  name: string;
  description: string;
  trigger_type: string;
  enabled: boolean;
  delay_minutes: number;
  message_template: string;
  created_at: string;
}

interface AutomationLog {
  id: string;
  automation_id: string;
  user_id: string | null;
  email: string | null;
  status: string;
  sent_at: string;
  error_message: string | null;
  metadata: any;
  automation: { name: string } | null;
}

export function AdminAutomations() {
  const queryClient = useQueryClient();
  const [isRunningManual, setIsRunningManual] = useState(false);

  const { data: automations, isLoading } = useQuery({
    queryKey: ["analytics-automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_automations")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Automation[];
    },
  });

  const { data: logs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ["analytics-automation-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analytics_automation_logs")
        .select("*, automation:analytics_automations(name)")
        .order("sent_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as (AutomationLog & { automation: { name: string } })[];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("analytics_automations")
        .update({ enabled })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["analytics-automations"] });
      toast.success("Automação atualizada");
    },
  });

  const runManualMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("analytics-automation-engine", {
        body: { mode: "manual" },
      });
      if (error) throw error;
    },
    onMutate: () => setIsRunningManual(true),
    onSuccess: () => {
      toast.success("Processamento manual concluído");
      queryClient.invalidateQueries({ queryKey: ["analytics-automation-logs"] });
    },
    onError: (err) => {
      toast.error("Erro ao processar manual: " + err.message);
    },
    onSettled: () => setIsRunningManual(false),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Motor de Automações</h2>
          <p className="text-muted-foreground">Transforme eventos em ações automáticas de crescimento</p>
        </div>
        <Button 
          onClick={() => runManualMutation.mutate()} 
          disabled={isRunningManual}
          className="gap-2"
        >
          {isRunningManual ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Processar Agora
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {automations?.map((automation) => (
          <Card key={automation.id} className={!automation.enabled ? "opacity-75" : ""}>
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className={`h-4 w-4 ${automation.enabled ? "text-amber-500" : "text-muted-foreground"}`} />
                  {automation.name}
                </CardTitle>
                <Switch 
                  checked={automation.enabled} 
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: automation.id, enabled: checked })}
                />
              </div>
              <CardDescription className="line-clamp-2 min-h-[40px]">{automation.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Gatilho:</span>
                  <Badge variant="outline" className="capitalize">{automation.trigger_type.replace('_', ' ')}</Badge>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Atraso:</span>
                  <span>{automation.delay_minutes >= 60 ? `${automation.delay_minutes / 60}h` : `${automation.delay_minutes}min`}</span>
                </div>
                <div className="mt-4 p-3 bg-muted rounded-md">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold mb-1">Preview WhatsApp</p>
                  <p className="text-xs text-foreground italic">"{automation.message_template.substring(0, 100)}..."</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Logs de Execução
            </CardTitle>
            <CardDescription>Últimas automações disparadas pelo sistema</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Automação</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                    Nenhuma execução registrada
                  </TableCell>
                </TableRow>
              ) : (
                logs?.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.automation?.name || "Desconhecida"}</TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {log.email || (log.user_id ? "Usuário Registrado" : "Desconhecido")}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(new Date(log.sent_at), "dd/MM HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={log.status === "sent" ? "default" : "destructive"} className="gap-1">
                        {log.status === "sent" ? (
                          "Enviado"
                        ) : (
                          <>
                            <AlertCircle className="h-3 w-3" />
                            Erro
                          </>
                        )}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
