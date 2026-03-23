import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWhatsAppBots, WhatsAppBot, TRIGGER_TYPES } from "@/hooks/useWhatsAppBots";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Bot, Plus, MoreVertical, Copy, Trash2, Pencil, Zap, Clock, ArrowLeft, Activity,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useWhatsAppChannels } from "@/hooks/useWhatsAppChannels";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export function BotManager() {
  const navigate = useNavigate();
  const { bots, loading, createBot, updateBot, deleteBot, duplicateBot, toggleBot } = useWhatsAppBots();
  const { channels } = useWhatsAppChannels();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingBot, setEditingBot] = useState<WhatsAppBot | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [triggerType, setTriggerType] = useState("manual");
  const [triggerConfig, setTriggerConfig] = useState<Record<string, any>>({});

  const resetForm = () => { setName(""); setDescription(""); setTriggerType("manual"); setTriggerConfig({}); };

  const handleCreate = async () => {
    if (!name.trim()) return;
    const bot = await createBot(name, description, triggerType, triggerConfig);
    setCreateOpen(false);
    resetForm();
    if (bot?.id) navigate(`/whatsapp/bots/${bot.id}`);
  };

  const handleEdit = (bot: WhatsAppBot) => {
    setEditingBot(bot);
    setName(bot.name);
    setDescription(bot.description || "");
    setTriggerType(bot.trigger_type);
    setTriggerConfig(bot.trigger_config || {});
  };

  const handleSaveEdit = async () => {
    if (!editingBot || !name.trim()) return;
    await updateBot(editingBot.id, {
      name, description, trigger_type: triggerType, trigger_config: triggerConfig,
    } as any);
    setEditingBot(null);
    resetForm();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteBot(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border bg-card shrink-0">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/whatsapp")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Chatbots & Automações
          </h1>
          <p className="text-xs text-muted-foreground">
            Crie bots para automatizar atendimento, follow-ups e ações operacionais.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" /> Novo bot
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {loading ? (
          <div className="text-center py-8 text-sm text-muted-foreground">Carregando...</div>
        ) : bots.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
              <Bot className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhum bot criado ainda</p>
            <p className="text-xs text-muted-foreground/60">Automatize atendimentos com chatbots inteligentes</p>
            <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" /> Criar primeiro bot
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 max-w-3xl mx-auto">
            {bots.map((bot) => {
              const triggerLabel = TRIGGER_TYPES.find(t => t.value === bot.trigger_type)?.label || bot.trigger_type;

              return (
                <div
                  key={bot.id}
                  className={cn(
                    "group rounded-xl border bg-card hover:shadow-sm transition-all p-4",
                    bot.is_active ? "border-border/60 hover:border-border" : "border-border/40 opacity-70"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      bot.is_active ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Bot className={cn("h-5 w-5", bot.is_active ? "text-primary" : "text-muted-foreground")} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold truncate">{bot.name}</span>
                        <Badge variant={bot.is_active ? "default" : "secondary"} className="text-[9px] shrink-0">
                          {bot.is_active ? "Ativo" : "Inativo"}
                        </Badge>
                      </div>
                      {bot.description && (
                        <p className="text-xs text-muted-foreground truncate">{bot.description}</p>
                      )}

                      {/* Stats row */}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3 text-amber-500" />
                          <span className="font-medium">{triggerLabel}</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Activity className="h-3 w-3" />
                          <span>{bot.execution_count} execuções</span>
                        </div>
                        {bot.last_executed_at && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground hidden sm:flex">
                            <Clock className="h-3 w-3" />
                            <span>
                              {formatDistanceToNow(new Date(bot.last_executed_at), { addSuffix: true, locale: ptBR })}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <Switch checked={bot.is_active} onCheckedChange={() => toggleBot(bot.id)} />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs hidden sm:inline-flex"
                        onClick={() => navigate(`/whatsapp/bots/${bot.id}`)}
                      >
                        Editar fluxo
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem onClick={() => navigate(`/whatsapp/bots/${bot.id}`)} className="sm:hidden">
                            <Pencil className="h-4 w-4 mr-2" /> Editar fluxo
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(bot)}>
                            <Pencil className="h-4 w-4 mr-2" /> Configurações
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicateBot(bot.id)}>
                            <Copy className="h-4 w-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(bot.id)}>
                            <Trash2 className="h-4 w-4 mr-2" /> Apagar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Bot Dialog */}
      <Dialog open={createOpen || !!editingBot} onOpenChange={(v) => { if (!v) { setCreateOpen(false); setEditingBot(null); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBot ? "Configurações do bot" : "Criar novo bot"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Nome do bot</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Follow-up orçamento" className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">Descrição</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva o que este bot faz..." className="mt-1" rows={2} />
            </div>
            <div>
              <Label className="text-xs">Gatilho</Label>
              <Select value={triggerType} onValueChange={setTriggerType}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TRIGGER_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(triggerType === "tag_added" || triggerType === "tag_removed") && (
              <div>
                <Label className="text-xs">Nome da etiqueta</Label>
                <Input value={triggerConfig.tag_name || ""} onChange={e => setTriggerConfig({ ...triggerConfig, tag_name: e.target.value })} placeholder="Ex: Orçamento" className="mt-1" />
              </div>
            )}
            {(triggerType === "no_team_reply" || triggerType === "no_client_reply") && (
              <div>
                <Label className="text-xs">Tempo de espera (minutos)</Label>
                <Input type="number" value={triggerConfig.timeout_minutes || 30} onChange={e => setTriggerConfig({ ...triggerConfig, timeout_minutes: parseInt(e.target.value) || 30 })} className="mt-1" />
              </div>
            )}
            {(triggerType === "new_message" || triggerType === "new_conversation") && channels.length > 0 && (
              <div>
                <Label className="text-xs">Filtro de canal</Label>
                <p className="text-[10px] text-muted-foreground mb-2">Selecione os canais que ativam este bot</p>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={!triggerConfig.channel_ids || triggerConfig.channel_ids.length === 0} onCheckedChange={() => setTriggerConfig({ ...triggerConfig, channel_ids: [] })} />
                    <span className="text-xs">Todos os canais</span>
                  </label>
                  {channels.map(ch => (
                    <label key={ch.id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={(triggerConfig.channel_ids || []).includes(ch.id)}
                        onCheckedChange={() => {
                          const current: string[] = triggerConfig.channel_ids || [];
                          const next = current.includes(ch.id) ? current.filter((id: string) => id !== ch.id) : [...current, ch.id];
                          setTriggerConfig({ ...triggerConfig, channel_ids: next });
                        }}
                      />
                      <span className="text-xs">{ch.name}</span>
                      {ch.phone_number && <span className="text-[10px] text-muted-foreground">{ch.phone_number}</span>}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Button className="w-full" onClick={editingBot ? handleSaveEdit : handleCreate} disabled={!name.trim()}>
              {editingBot ? "Salvar alterações" : "Criar bot"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar bot?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Todas as etapas e histórico de execução serão perdidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
