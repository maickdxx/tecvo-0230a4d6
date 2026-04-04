import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { CONDITION_TYPES, DELAY_TYPES, CAPTURE_FIELDS } from "@/hooks/useWhatsAppBots";
import { X, Upload, FileText, Loader2, Plus, Trash2, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VariableInsertButton, VariableValidation, MessagePreviewToggle } from "@/components/shared/VariableInsertButton";
import { useOrganization } from "@/hooks/useOrganization";
import { useOperationalCapacityConfig } from "@/hooks/useOperationalCapacityConfig";
import { toast } from "sonner";

interface StepConfigPanelProps {
  stepId: string;
  stepType: string;
  label: string;
  config: Record<string, any>;
  onSave: (label: string, config: Record<string, any>) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function StepConfigPanel({ stepId, stepType, label: initialLabel, config: initialConfig, onSave, onDelete, onClose }: StepConfigPanelProps) {
  const [label, setLabel] = useState(initialLabel);
  const [config, setConfig] = useState<Record<string, any>>(initialConfig);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { organization } = useOrganization();
  const { config: capacityConfig } = useOperationalCapacityConfig();

  useEffect(() => {
    setLabel(initialLabel);
    setConfig(initialConfig);
  }, [stepId, initialLabel, initialConfig]);

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organization?.id) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "bin";
      const path = `${organization.id}/bot-media/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from("whatsapp-media")
        .upload(path, file, { contentType: file.type, upsert: false });

      if (error) {
        toast.error("Falha ao enviar arquivo");
        return;
      }

      const { data } = supabase.storage.from("whatsapp-media").getPublicUrl(path);
      updateConfig("media_url", data.publicUrl);
      updateConfig("file_name", file.name);
      toast.success("Arquivo enviado");
    } catch {
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isMediaStep = stepType === "send_image" || stepType === "send_video" || stepType === "send_document";
  const acceptMap: Record<string, string> = {
    send_image: "image/*",
    send_video: "video/*",
    send_document: ".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip",
  };

  // Buttons helpers
  const buttons: string[] = config.buttons || [];
  const addButton = () => {
    if (buttons.length >= 4) return;
    updateConfig("buttons", [...buttons, ""]);
  };
  const updateButton = (index: number, value: string) => {
    const updated = [...buttons];
    updated[index] = value;
    updateConfig("buttons", updated);
  };
  const removeButton = (index: number) => {
    updateConfig("buttons", buttons.filter((_, i) => i !== index));
  };

  // Business hours display
  const businessHoursInfo = capacityConfig ? {
    start: capacityConfig.start_time || "08:00",
    end: capacityConfig.end_time || "17:48",
    saturday: capacityConfig.works_saturday,
  } : null;

  return (
    <div className="w-72 border-l border-border bg-card flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <h3 className="text-sm font-semibold">Configurar etapa</h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <Label className="text-xs">Nome da etapa</Label>
          <Input value={label} onChange={e => setLabel(e.target.value)} className="mt-1" />
        </div>

        {/* ─── Send Message ─── */}
        {stepType === "send_message" && (
          <div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Mensagem</Label>
              <VariableInsertButton
                compact
                onInsert={(tag) => updateConfig("message", (config.message || "") + tag)}
              />
            </div>
            <Textarea
              value={config.message || ""}
              onChange={e => updateConfig("message", e.target.value)}
              className="mt-1"
              rows={4}
              placeholder="Digite a mensagem do bot..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">Use *texto* para negrito e {"{{variavel}}"} para dados dinâmicos</p>
            <VariableValidation message={config.message || ""} />
            <MessagePreviewToggle message={config.message || ""} />
          </div>
        )}

        {/* ─── Send Buttons (Question with options) ─── */}
        {stepType === "send_buttons" && (
          <>
            <div>
              <Label className="text-xs">Pergunta</Label>
              <Textarea
                value={config.question || ""}
                onChange={e => updateConfig("question", e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Ex: Como podemos ajudar?"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="text-xs">Opções de resposta</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-1"
                  onClick={addButton}
                  disabled={buttons.length >= 4}
                >
                  <Plus className="h-3 w-3" /> Adicionar
                </Button>
              </div>
              <div className="space-y-1.5">
                {buttons.map((btn, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                    <Input
                      value={btn}
                      onChange={e => updateButton(i, e.target.value)}
                      className="h-8 text-xs"
                      placeholder={`Opção ${i + 1}`}
                      maxLength={20}
                    />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeButton(i)}>
                      <Trash2 className="h-3 w-3 text-muted-foreground" />
                    </Button>
                  </div>
                ))}
                {buttons.length === 0 && (
                  <p className="text-[10px] text-muted-foreground">Clique em "Adicionar" para criar opções</p>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5">Máximo 4 botões, 20 caracteres cada</p>
            </div>
            <div>
              <Label className="text-xs">Rodapé (opcional)</Label>
              <Input
                value={config.footer || ""}
                onChange={e => updateConfig("footer", e.target.value)}
                className="mt-1 text-xs"
                placeholder="Ex: Selecione uma opção"
                maxLength={60}
              />
            </div>
          </>
        )}

        {/* ─── Capture Input ─── */}
        {stepType === "capture_input" && (
          <>
            <div>
              <Label className="text-xs">Informação a capturar</Label>
              <Select
                value={config.capture_field || ""}
                onValueChange={v => {
                  const fieldDef = CAPTURE_FIELDS.find(f => f.value === v);
                  updateConfig("capture_field", v);
                  updateConfig("field_label", fieldDef?.label || v);
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CAPTURE_FIELDS.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {config.capture_field === "custom" && (
              <div>
                <Label className="text-xs">Nome do campo</Label>
                <Input
                  value={config.custom_field_name || ""}
                  onChange={e => updateConfig("custom_field_name", e.target.value)}
                  className="mt-1"
                  placeholder="Ex: Modelo do equipamento"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Mensagem para o cliente</Label>
              <Textarea
                value={config.prompt_message || ""}
                onChange={e => updateConfig("prompt_message", e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Ex: Qual é o seu nome?"
              />
            </div>
            <div>
              <Label className="text-xs">Mensagem de confirmação (opcional)</Label>
              <Input
                value={config.confirmation_message || ""}
                onChange={e => updateConfig("confirmation_message", e.target.value)}
                className="mt-1 text-xs"
                placeholder="Ex: Obrigado! Anotei."
              />
            </div>
          </>
        )}

        {/* ─── Wait Response ─── */}
        {stepType === "wait_response" && (
          <>
            <div>
              <Label className="text-xs">Tempo máximo de espera (minutos)</Label>
              <Input
                type="number"
                value={config.timeout_minutes || 30}
                onChange={e => updateConfig("timeout_minutes", parseInt(e.target.value) || 30)}
                className="mt-1"
                min={1}
                max={10080}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Se o cliente não responder nesse prazo, segue pela saída "Timeout"</p>
            </div>
            <div>
              <Label className="text-xs">Mensagem de lembrete (opcional)</Label>
              <Textarea
                value={config.reminder_message || ""}
                onChange={e => updateConfig("reminder_message", e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Enviada antes do timeout..."
              />
            </div>
            <div>
              <Label className="text-xs">Enviar lembrete após (minutos)</Label>
              <Input
                type="number"
                value={config.reminder_after_minutes || ""}
                onChange={e => updateConfig("reminder_after_minutes", parseInt(e.target.value) || 0)}
                className="mt-1"
                min={1}
                placeholder="Opcional"
              />
            </div>
          </>
        )}

        {/* ─── Transfer to Human ─── */}
        {stepType === "transfer_human" && (
          <>
            <div>
              <Label className="text-xs">Mensagem antes de transferir</Label>
              <Textarea
                value={config.message || ""}
                onChange={e => updateConfig("message", e.target.value)}
                className="mt-1"
                rows={3}
                placeholder="Ex: Aguarde um momento, vou encaminhar você para um atendente."
              />
            </div>
            <div>
              <Label className="text-xs">Atribuir a atendente específico (opcional)</Label>
              <Input
                value={config.assign_to || ""}
                onChange={e => updateConfig("assign_to", e.target.value)}
                className="mt-1 text-xs"
                placeholder="UUID do atendente ou vazio para fila"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para entrar na fila de atendimento</p>
            </div>
          </>
        )}

        {/* ─── End Flow ─── */}
        {stepType === "end_flow" && (
          <>
            <div>
              <Label className="text-xs">Mensagem de encerramento (opcional)</Label>
              <Textarea
                value={config.message || ""}
                onChange={e => updateConfig("message", e.target.value)}
                className="mt-1"
                rows={2}
                placeholder="Ex: Obrigado pelo contato! Até a próxima."
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={config.mark_resolved ?? true}
                onCheckedChange={v => updateConfig("mark_resolved", v)}
              />
              <Label className="text-xs">Marcar conversa como resolvida</Label>
            </div>
          </>
        )}

        {/* ─── Image/Video/Document ─── */}
        {isMediaStep && (
          <>
            <div>
              <Label className="text-xs">Arquivo</Label>
              <div className="mt-1 space-y-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full flex items-center gap-2.5 p-3 rounded-lg border-2 border-dashed border-border hover:border-primary/40 hover:bg-muted/30 transition-colors"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Upload className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">
                      {uploading ? "Enviando..." : "Clique para enviar arquivo"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {stepType === "send_image" && "JPG, PNG, WEBP"}
                      {stepType === "send_video" && "MP4, MOV, AVI"}
                      {stepType === "send_document" && "PDF, DOC, XLS, CSV"}
                    </p>
                  </div>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept={acceptMap[stepType] || "*"}
                  className="hidden"
                  onChange={handleFileUpload}
                />

                {config.media_url && (
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 border border-border/40">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium truncate">{config.file_name || "Arquivo enviado"}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{config.media_url}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => { updateConfig("media_url", ""); updateConfig("file_name", ""); }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                {!config.media_url && (
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Ou cole um link direto:</p>
                    <Input
                      value={config.media_url || ""}
                      onChange={e => updateConfig("media_url", e.target.value)}
                      placeholder="https://..."
                      className="text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Legenda (opcional)</Label>
              <Input
                value={config.caption || ""}
                onChange={e => updateConfig("caption", e.target.value)}
                className="mt-1"
              />
            </div>
          </>
        )}

        {/* ─── Tag ─── */}
        {(stepType === "add_tag" || stepType === "remove_tag") && (
          <div>
            <Label className="text-xs">Nome da etiqueta</Label>
            <Input
              value={config.tag_name || ""}
              onChange={e => updateConfig("tag_name", e.target.value)}
              className="mt-1"
              placeholder="Ex: Orçamento"
            />
          </div>
        )}

        {/* ─── Assign ─── */}
        {stepType === "assign" && (
          <div>
            <Label className="text-xs">ID do atendente (user_id)</Label>
            <Input
              value={config.assign_to || ""}
              onChange={e => updateConfig("assign_to", e.target.value)}
              className="mt-1"
              placeholder="UUID do atendente"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Deixe vazio para atribuir ao primeiro disponível</p>
          </div>
        )}

        {/* ─── Internal Note ─── */}
        {stepType === "internal_note" && (
          <div>
            <Label className="text-xs">Nota interna</Label>
            <Textarea
              value={config.note || ""}
              onChange={e => updateConfig("note", e.target.value)}
              className="mt-1"
              rows={3}
              placeholder="Nota visível apenas para a equipe..."
            />
          </div>
        )}

        {/* ─── Delay ─── */}
        {stepType === "delay" && (
          <>
            <div>
              <Label className="text-xs">Tipo de espera</Label>
              <Select value={config.delay_type || "minutes"} onValueChange={v => updateConfig("delay_type", v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DELAY_TYPES.map(d => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(config.delay_type === "minutes" || config.delay_type === "hours" || config.delay_type === "days" || !config.delay_type) && (
              <div>
                <Label className="text-xs">Quantidade</Label>
                <Input
                  type="number"
                  value={config.delay_value || ""}
                  onChange={e => updateConfig("delay_value", parseInt(e.target.value) || 0)}
                  className="mt-1"
                  min={1}
                />
              </div>
            )}
            {config.delay_type === "until_time" && (
              <div>
                <Label className="text-xs">Horário</Label>
                <Input
                  type="time"
                  value={config.delay_time || "08:00"}
                  onChange={e => updateConfig("delay_time", e.target.value)}
                  className="mt-1"
                />
              </div>
            )}
          </>
        )}

        {/* ─── Condition ─── */}
        {stepType === "condition" && (
          <>
            <div>
              <Label className="text-xs">Condição</Label>
              <Select
                value={config.condition_type || ""}
                onValueChange={v => {
                  const condLabel = CONDITION_TYPES.find(c => c.value === v)?.label || v;
                  updateConfig("condition_type", v);
                  updateConfig("condition_label", condLabel);
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {CONDITION_TYPES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(config.condition_type === "has_tag" || config.condition_type === "not_has_tag") && (
              <div>
                <Label className="text-xs">Nome da etiqueta</Label>
                <Input
                  value={config.condition_tag || ""}
                  onChange={e => updateConfig("condition_tag", e.target.value)}
                  className="mt-1"
                />
              </div>
            )}

            {/* Business hours info */}
            {(config.condition_type === "within_business_hours" || config.condition_type === "outside_business_hours") && (
              <div className="rounded-lg bg-muted/50 border border-border/40 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-foreground">Horário comercial configurado</span>
                </div>
                {businessHoursInfo ? (
                  <>
                    <p className="text-[10px] text-muted-foreground">
                      ⏰ {businessHoursInfo.start} — {businessHoursInfo.end}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      📅 Seg–Sex {businessHoursInfo.saturday ? "+ Sábado" : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground italic">
                      Baseado na configuração da Agenda
                    </p>
                  </>
                ) : (
                  <p className="text-[10px] text-muted-foreground">
                    Nenhuma configuração encontrada. Usando padrão: 08:00–18:00, Seg–Sex.
                  </p>
                )}

                <div className="pt-1.5 border-t border-border/40">
                  <div className="flex items-center gap-2 mb-1">
                    <Switch
                      checked={config.use_custom_hours ?? false}
                      onCheckedChange={v => updateConfig("use_custom_hours", v)}
                    />
                    <Label className="text-[10px]">Usar horário personalizado</Label>
                  </div>
                  {config.use_custom_hours && (
                    <div className="space-y-1.5 mt-2">
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Label className="text-[10px]">Início</Label>
                          <Input
                            type="time"
                            value={config.custom_start_time || "08:00"}
                            onChange={e => updateConfig("custom_start_time", e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="flex-1">
                          <Label className="text-[10px]">Fim</Label>
                          <Input
                            type="time"
                            value={config.custom_end_time || "18:00"}
                            onChange={e => updateConfig("custom_end_time", e.target.value)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={config.custom_works_saturday ?? false}
                          onCheckedChange={v => updateConfig("custom_works_saturday", v)}
                        />
                        <Label className="text-[10px]">Sábado é dia útil</Label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="p-4 border-t border-border space-y-2">
        <Button className="w-full" size="sm" onClick={() => onSave(label, config)}>
          Salvar etapa
        </Button>
        <Button variant="outline" size="sm" className="w-full text-destructive" onClick={onDelete}>
          Apagar etapa
        </Button>
      </div>
    </div>
  );
}
