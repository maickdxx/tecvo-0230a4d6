import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, Play, Pause, RotateCcw, Send, Settings, BarChart3, Search, Phone, Mail, Filter } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "pending", label: "Pendentes" },
  { value: "processing", label: "Processando" },
  { value: "sent", label: "Enviados" },
  { value: "failed", label: "Falharam" },
];

const CHANNEL_OPTIONS = [
  { value: "all", label: "Todos canais" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "email", label: "Email" },
  { value: "none", label: "Sem canal" },
];

function ChannelBadge({ status }: { status: string | null }) {
  if (!status || status === "skipped") return <Badge variant="secondary" className="text-xs">—</Badge>;
  if (status === "sent") return <Badge className="bg-green-600 text-xs">sent</Badge>;
  if (status === "error") return <Badge variant="destructive" className="text-xs">erro</Badge>;
  return <Badge variant="outline" className="text-xs">{status}</Badge>;
}

function PrimaryChannelIcon({ channel }: { channel: string | null }) {
  if (channel === "whatsapp") return <Phone className="h-3.5 w-3.5 text-green-600" />;
  if (channel === "email") return <Mail className="h-3.5 w-3.5 text-blue-600" />;
  return <span className="text-xs text-muted-foreground">—</span>;
}

export function AdminCampaigns() {
  const queryClient = useQueryClient();
  const [messageTemplate, setMessageTemplate] = useState(
    "{{name}}, faz um tempo que você não entra na Tecvo.\n\nSeus clientes continuam precisando de manutenção e você pode estar perdendo receita.\n\nDá uma olhada rápida:\nhttps://tecvo.com.br/dashboard"
  );
  const [emailTemplate, setEmailTemplate] = useState(
    "{{name}}, faz um tempo que você não acessa a Tecvo.\n\nEnquanto isso, clientes podem estar esperando manutenção — e a receita que vem com isso está passando.\n\nAcesse e veja o que está pendente."
  );
  const [emailSubject, setEmailSubject] = useState("{{name}}, seus clientes estão esperando");

  // Filters
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

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
  const { data: stats } = useQuery({
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

      // Channel breakdown for sent
      const { data: channelData } = await supabase
        .from("campaign_sends")
        .select("primary_channel")
        .eq("status", "sent");

      const channels: Record<string, number> = { whatsapp: 0, email: 0, none: 0 };
      for (const row of channelData || []) {
        const ch = (row as any).primary_channel || "none";
        channels[ch] = (channels[ch] || 0) + 1;
      }
      return { ...counts, channels };
    },
    refetchInterval: 10000,
  });

  // Fetch sends with filters
  const { data: sends, isLoading: sendsLoading } = useQuery({
    queryKey: ["campaign-sends", statusFilter, channelFilter, searchTerm],
    queryFn: async () => {
      let query = supabase
        .from("campaign_sends")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      if (channelFilter !== "all") {
        query = query.eq("primary_channel", channelFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (!searchTerm) return data;

      const term = searchTerm.toLowerCase();
      return (data || []).filter((s: any) =>
        (s.user_name || "").toLowerCase().includes(term) ||
        (s.email || "").toLowerCase().includes(term) ||
        (s.phone || "").includes(term)
      );
    },
    refetchInterval: 10000,
  });

  // Toggle pause
  const togglePause = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaign_config")
        .update({ is_paused: !config?.is_paused, updated_at: new Date().toISOString() })
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
        body: { campaign_name: "reengagement", message_template: messageTemplate, email_template: emailTemplate, email_subject: emailSubject },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["campaign-stats", "campaign-sends"] });
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
      queryClient.invalidateQueries({ queryKey: ["campaign-stats", "campaign-sends"] });
      if (data.skipped) {
        toast.info(`Pulado: ${data.reason}`);
      } else if (data.processed) {
        toast.success(`${data.processed.user}: Canal=${data.processed.primary_channel} | WA=${data.processed.whatsapp} | Email=${data.processed.email}`);
      }
    },
    onError: (err: any) => toast.error(`Erro: ${err.message}`),
  });

  // Reset failed
  const resetFailed = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("campaign_sends")
        .update({ status: "pending", primary_channel: "none", updated_at: new Date().toISOString() })
        .eq("status", "failed");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["campaign-stats", "campaign-sends"] });
      toast.success("Falhas resetadas para a fila");
    },
  });

  if (configLoading) return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Na fila", value: stats?.pending || 0, color: "text-yellow-600" },
          { label: "Processando", value: stats?.processing || 0, color: "text-blue-600" },
          { label: "Enviados", value: stats?.sent || 0, color: "text-green-600" },
          { label: "Falharam", value: stats?.failed || 0, color: "text-red-600" },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardContent className="pt-4">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Channel breakdown */}
      {stats?.channels && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4 flex items-center gap-2">
              <Phone className="h-4 w-4 text-green-600" />
              <div>
                <div className="text-lg font-bold">{stats.channels.whatsapp || 0}</div>
                <p className="text-xs text-muted-foreground">via WhatsApp</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 flex items-center gap-2">
              <Mail className="h-4 w-4 text-blue-600" />
              <div>
                <div className="text-lg font-bold">{stats.channels.email || 0}</div>
                <p className="text-xs text-muted-foreground">via Email</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-lg font-bold">{stats.channels.none || 0}</div>
              <p className="text-xs text-muted-foreground">Sem canal</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" /> Controles</CardTitle>
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
              <Input type="number" value={config?.sends_per_hour || 20}
                onChange={(e) => updateConfig.mutate({ sends_per_hour: parseInt(e.target.value) || 20 })}
                min={1} max={50} />
            </div>
            <div>
              <label className="text-sm font-medium">Intervalo mín (seg)</label>
              <Input type="number" value={config?.min_interval_seconds || 120}
                onChange={(e) => updateConfig.mutate({ min_interval_seconds: parseInt(e.target.value) || 120 })}
                min={30} />
            </div>
            <div>
              <label className="text-sm font-medium">Cooldown (horas)</label>
              <Input type="number" value={config?.cooldown_hours || 72}
                onChange={(e) => updateConfig.mutate({ cooldown_hours: parseInt(e.target.value) || 72 })}
                min={24} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Template */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Template</CardTitle>
          <CardDescription>Regra de canal: WhatsApp é prioritário. Sem WhatsApp → email. Ambos disponíveis → envia os dois.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">WhatsApp</label>
            <Textarea value={messageTemplate} onChange={(e) => setMessageTemplate(e.target.value)} rows={4} />
          </div>
          <div>
            <label className="text-sm font-medium">Subject do Email</label>
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Email</label>
            <Textarea value={emailTemplate} onChange={(e) => setEmailTemplate(e.target.value)} rows={4} />
          </div>
          <div className="flex gap-2">
            <Button onClick={() => populateQueue.mutate()} disabled={populateQueue.isPending}>
              {populateQueue.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <BarChart3 className="h-4 w-4 mr-1" />}
              Popular Fila
            </Button>
            <Button variant="outline" onClick={() => processOne.mutate()} disabled={processOne.isPending}>
              {processOne.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              Enviar Próximo
            </Button>
            {(stats?.failed || 0) > 0 && (
              <Button variant="outline" onClick={() => resetFailed.mutate()} disabled={resetFailed.isPending}>
                <RotateCcw className="h-4 w-4 mr-1" /> Resetar Falhas ({stats?.failed})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Sends list with filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Filter className="h-5 w-5" /> Envios da Campanha</CardTitle>
          <CardDescription>Visibilidade completa: quem recebeu, por qual canal, e erros</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={channelFilter} onValueChange={setChannelFilter}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {sendsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : !sends || sends.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum envio encontrado</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Destinatário</TableHead>
                    <TableHead className="text-center">Canal</TableHead>
                    <TableHead className="text-center">WhatsApp</TableHead>
                    <TableHead className="text-center">Email</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Quando</TableHead>
                    <TableHead>Erro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sends.map((send: any) => (
                    <TableRow key={send.id}>
                      <TableCell>
                        <div className="min-w-[180px]">
                          <p className="font-medium text-sm">{send.user_name || "—"}</p>
                          {send.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" />{send.phone}</p>}
                          {send.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3" />{send.email}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <PrimaryChannelIcon channel={send.primary_channel} />
                          <span className="text-xs">{send.primary_channel || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center"><ChannelBadge status={send.whatsapp_status} /></TableCell>
                      <TableCell className="text-center"><ChannelBadge status={send.email_status} /></TableCell>
                      <TableCell className="text-center">
                        <Badge variant={send.status === "sent" ? "default" : send.status === "failed" ? "destructive" : send.status === "pending" ? "secondary" : "outline"}>
                          {send.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {send.processed_at ? new Date(send.processed_at).toLocaleString("pt-BR") : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {(send.whatsapp_error || send.email_error) ? (
                          <p className="text-xs text-destructive truncate" title={send.whatsapp_error || send.email_error}>
                            {send.whatsapp_error || send.email_error}
                          </p>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
