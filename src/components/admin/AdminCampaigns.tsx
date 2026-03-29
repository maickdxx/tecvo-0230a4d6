import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Play, Pause, RotateCcw, Send, Settings, BarChart3 } from "lucide-react";

export function AdminCampaigns() {
  const queryClient = useQueryClient();
  const [messageTemplate, setMessageTemplate] = useState(
    "{{name}}, faz um tempo que você não entra na Tecvo.\n\nSeus clientes continuam precisando de manutenção e você pode estar perdendo receita.\n\nDá uma olhada rápida:\nhttps://tecvo.com.br/dashboard"
  );
  const [emailTemplate, setEmailTemplate] = useState(
    "{{name}}, faz um tempo que você não acessa a Tecvo.\n\nEnquanto isso, clientes podem estar esperando manutenção — e a receita que vem com isso está passando.\n\nAcesse e veja o que está pendente."
  );
  const [emailSubject, setEmailSubject] = useState("{{name}}, seus clientes estão esperando");

  // Fetch config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ["campaign-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_config")
        .select("*")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch queue stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["campaign-stats"],
    queryFn: async () => {
      const statuses = ["pending", "processing", "sent", "failed"];
      const counts: Record<string, number> = {};
      for (const s of statuses) {
        const { count } = await supabase
          .from("campaign_sends")
          .select("*", { count: "exact", head: true })
          .eq("status", s);
        counts[s] = count || 0;
      }
      return counts;
    },
    refetchInterval: 10000,
  });

  // Fetch recent sends
  const { data: recentSends } = useQuery({
    queryKey: ["campaign-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaign_sends")
        .select("*")
        .in("status", ["sent", "failed", "processing"])
        .order("processed_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // Toggle pause
  const togglePause = useMutation({
    mutationFn: async () => {
      const newPaused = !config?.is_paused;
      const { error } = await supabase
        .from("campaign_config")
        .update({ is_paused: newPaused, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-config"] });
      toast.success(config?.is_paused ? "Campanha retomada" : "Campanha pausada");
    },
  });

  // Update config
  const updateConfig = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase
        .from("campaign_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-config"] });
      toast.success("Configuração atualizada");
    },
  });

  // Populate queue
  const populateQueue = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("populate-campaign-queue", {
        body: {
          campaign_name: "reengagement",
          message_template: messageTemplate,
          email_template: emailTemplate,
          email_subject: emailSubject,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-stats"] });
      toast.success(`${data.queued} usuários adicionados à fila`);
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  // Process one
  const processOne = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-campaign-queue");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-stats", "campaign-recent"] });
      if (data.skipped) {
        toast.info(`Pulado: ${data.reason}`);
      } else if (data.processed) {
        toast.success(`Enviado para ${data.processed.user}: WA=${data.processed.whatsapp}, Email=${data.processed.email}`);
      }
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  // Reset failed
  const resetFailed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaign_sends")
        .update({ status: "pending", updated_at: new Date().toISOString() })
        .eq("status", "failed");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-stats"] });
      toast.success("Itens com falha voltaram para a fila");
    },
  });

  if (configLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-yellow-600">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">Na fila</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-blue-600">{stats?.processing || 0}</div>
            <p className="text-xs text-muted-foreground">Processando</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-green-600">{stats?.sent || 0}</div>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-red-600">{stats?.failed || 0}</div>
            <p className="text-xs text-muted-foreground">Falharam</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" /> Controles da Campanha
          </CardTitle>
          <CardDescription>
            Configuração de velocidade e pausa do envio controlado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Campanha {config?.is_paused ? "Pausada" : "Ativa"}</p>
              <p className="text-sm text-muted-foreground">
                {config?.is_paused ? "Nenhum envio será feito" : "Processando fila normalmente"}
              </p>
            </div>
            <Button
              variant={config?.is_paused ? "default" : "destructive"}
              size="sm"
              onClick={() => togglePause.mutate()}
              disabled={togglePause.isPending}
            >
              {config?.is_paused ? <Play className="h-4 w-4 mr-1" /> : <Pause className="h-4 w-4 mr-1" />}
              {config?.is_paused ? "Retomar" : "Pausar"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium">Envios/hora</label>
              <Input
                type="number"
                value={config?.sends_per_hour || 20}
                onChange={(e) =>
                  updateConfig.mutate({ sends_per_hour: parseInt(e.target.value) || 20 })
                }
                min={1}
                max={50}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Intervalo mín (seg)</label>
              <Input
                type="number"
                value={config?.min_interval_seconds || 120}
                onChange={(e) =>
                  updateConfig.mutate({ min_interval_seconds: parseInt(e.target.value) || 120 })
                }
                min={30}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Cooldown (horas)</label>
              <Input
                type="number"
                value={config?.cooldown_hours || 72}
                onChange={(e) =>
                  updateConfig.mutate({ cooldown_hours: parseInt(e.target.value) || 72 })
                }
                min={24}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Message Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" /> Template da Campanha
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">WhatsApp</label>
            <Textarea
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              rows={5}
              placeholder="Mensagem WhatsApp com {{name}}"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Subject do Email</label>
            <Input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              placeholder="Subject com {{name}}"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Textarea
              value={emailTemplate}
              onChange={(e) => setEmailTemplate(e.target.value)}
              rows={5}
              placeholder="Corpo do email com {{name}}"
            />
          </div>

          <div className="flex gap-2">
            <Button
              onClick={() => populateQueue.mutate()}
              disabled={populateQueue.isPending}
            >
              {populateQueue.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
              Popular Fila
            </Button>
            <Button
              variant="outline"
              onClick={() => processOne.mutate()}
              disabled={processOne.isPending}
            >
              {processOne.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Enviar Próximo
            </Button>
            {(stats?.failed || 0) > 0 && (
              <Button
                variant="outline"
                onClick={() => resetFailed.mutate()}
                disabled={resetFailed.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-1" />
                Resetar Falhas ({stats?.failed})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent Sends */}
      {recentSends && recentSends.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Envios Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentSends.map((send: any) => (
                  <TableRow key={send.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{send.user_name || "—"}</p>
                        <p className="text-xs text-muted-foreground">{send.phone || send.email || "—"}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={send.whatsapp_status === "sent" ? "default" : send.whatsapp_status === "error" ? "destructive" : "secondary"}>
                        {send.whatsapp_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={send.email_status === "sent" ? "default" : send.email_status === "error" ? "destructive" : "secondary"}>
                        {send.email_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={send.status === "sent" ? "default" : send.status === "failed" ? "destructive" : "outline"}>
                        {send.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {send.processed_at ? new Date(send.processed_at).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
