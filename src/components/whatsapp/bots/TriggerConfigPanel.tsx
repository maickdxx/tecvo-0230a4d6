import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Play } from "lucide-react";
import { TRIGGER_TYPES } from "@/hooks/useWhatsAppBots";
import { useWhatsAppChannels, type WhatsAppChannelInfo } from "@/hooks/useWhatsAppChannels";

interface TriggerConfigPanelProps {
  triggerType: string;
  triggerConfig: Record<string, any>;
  onSave: (triggerType: string, triggerConfig: Record<string, any>) => void;
  onClose: () => void;
}

export function TriggerConfigPanel({ triggerType: initialType, triggerConfig: initialConfig, onSave, onClose }: TriggerConfigPanelProps) {
  const [triggerType, setTriggerType] = useState(initialType);
  const [config, setConfig] = useState<Record<string, any>>(initialConfig);
  const { channels } = useWhatsAppChannels();

  useEffect(() => {
    setTriggerType(initialType);
    setConfig(initialConfig);
  }, [initialType, initialConfig]);

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const showChannelFilter = triggerType === "new_message" || triggerType === "new_conversation";

  const selectedChannelIds: string[] = config.channel_ids || [];
  const allChannels = selectedChannelIds.length === 0;

  const toggleChannel = (channelId: string) => {
    if (selectedChannelIds.includes(channelId)) {
      updateConfig("channel_ids", selectedChannelIds.filter(id => id !== channelId));
    } else {
      updateConfig("channel_ids", [...selectedChannelIds, channelId]);
    }
  };

  const toggleAll = () => {
    if (allChannels) return; // already all
    updateConfig("channel_ids", []);
  };

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Play className="h-3.5 w-3.5 text-emerald-600" />
          Início do fluxo
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <Label className="text-xs font-semibold">Gatilho</Label>
          <p className="text-[10px] text-muted-foreground mb-1.5">O que inicia este fluxo?</p>
          <Select value={triggerType} onValueChange={setTriggerType}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRIGGER_TYPES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Channel filter for message-based triggers */}
        {showChannelFilter && channels.length > 0 && (
          <div>
            <Label className="text-xs font-semibold">Canal</Label>
            <p className="text-[10px] text-muted-foreground mb-2">De qual canal este fluxo deve responder?</p>
            
            <div className="space-y-2">
              <label className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors cursor-pointer">
                <Checkbox
                  checked={allChannels}
                  onCheckedChange={() => toggleAll()}
                />
                <span className="text-xs font-medium">Todos os canais</span>
              </label>

              {channels.map((ch) => (
                <label
                  key={ch.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border/60 hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <Checkbox
                    checked={selectedChannelIds.includes(ch.id)}
                    onCheckedChange={() => toggleChannel(ch.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium truncate block">{ch.name}</span>
                    {ch.phone_number && (
                      <span className="text-[10px] text-muted-foreground">{ch.phone_number}</span>
                    )}
                  </div>
                  <span className={`h-2 w-2 rounded-full shrink-0 ${ch.is_connected ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                </label>
              ))}
            </div>

            <p className="text-[10px] text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">
              💡 A resposta será sempre enviada pelo mesmo canal que recebeu a mensagem.
            </p>
          </div>
        )}

        {/* Tag config for tag triggers */}
        {(triggerType === "tag_added" || triggerType === "tag_removed") && (
          <div>
            <Label className="text-xs">Nome da etiqueta</Label>
            <Input
              value={config.tag_name || ""}
              onChange={e => updateConfig("tag_name", e.target.value)}
              placeholder="Ex: Orçamento"
              className="mt-1"
            />
          </div>
        )}

        {/* Timeout config */}
        {(triggerType === "no_team_reply" || triggerType === "no_client_reply") && (
          <div>
            <Label className="text-xs">Tempo de espera (minutos)</Label>
            <Input
              type="number"
              value={config.timeout_minutes || 30}
              onChange={e => updateConfig("timeout_minutes", parseInt(e.target.value) || 30)}
              className="mt-1"
            />
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border">
        <Button className="w-full" size="sm" onClick={() => onSave(triggerType, config)}>
          Salvar gatilho
        </Button>
      </div>
    </div>
  );
}
