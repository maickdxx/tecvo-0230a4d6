import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState } from "react";
import { AppLayout } from "@/components/layout";
import { BotFlowBuilder } from "@/components/whatsapp/bots/BotFlowBuilder";
import { useWhatsAppBots } from "@/hooks/useWhatsAppBots";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Save, Undo2 } from "lucide-react";

export default function WhatsAppBotEdit() {
  const { botId } = useParams<{ botId: string }>();
  const navigate = useNavigate();
  const { bots, loading } = useWhatsAppBots();
  const bot = bots.find((b) => b.id === botId);

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const saveRef = useRef<(() => Promise<void>) | null>(null);
  const cancelRef = useRef<(() => void) | null>(null);

  const handleSave = async () => {
    if (!saveRef.current) return;
    setSaving(true);
    await saveRef.current();
    setSaving(false);
  };

  const handleCancel = () => {
    cancelRef.current?.();
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  if (!bot) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-4rem)] gap-3">
          <p className="text-sm text-muted-foreground">Bot não encontrado</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/whatsapp/bots")}>
            Voltar para bots
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)] md:h-[calc(100vh-2rem)]">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-card shadow-sm">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/whatsapp/bots")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate">{bot.name}</h2>
            <p className="text-xs text-muted-foreground">Construtor de fluxo</p>
          </div>

          {/* Save / Cancel — only visible when dirty */}
          {isDirty && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleCancel}
                disabled={saving}
              >
                <Undo2 className="h-3.5 w-3.5" />
                Cancelar
              </Button>
              <Button
                size="sm"
                className="h-8 gap-1.5"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                Salvar
              </Button>
            </div>
          )}

          <Badge variant={bot.is_active ? "default" : "secondary"} className="text-[10px]">
            {bot.is_active ? "Ativo" : "Inativo"}
          </Badge>
        </div>

        {/* Flow builder */}
        <div className="flex-1 min-h-0">
          <BotFlowBuilder
            botId={bot.id}
            onDirtyChange={setIsDirty}
            saveRef={saveRef}
            cancelRef={cancelRef}
          />
        </div>
      </div>
    </AppLayout>
  );
}
