import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Settings2 } from "lucide-react";
import { useOperationalCapacityConfig } from "@/hooks/useOperationalCapacityConfig";
import { OperationalCapacityModal } from "@/components/agenda/OperationalCapacityModal";

interface OperationalCapacitySettingsProps {
  onBack: () => void;
}

export function OperationalCapacitySettings({ onBack }: OperationalCapacitySettingsProps) {
  const { config, isLoading, save, isSaving } = useOperationalCapacityConfig();
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Estrutura Operacional</h2>
          <p className="text-sm text-muted-foreground">Configure equipes e jornada para cálculo de ocupação</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Carregando...</div>
      ) : config ? (
        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-card-foreground">Configuração atual</h3>
              <p className="text-sm text-muted-foreground">
                {config.active_teams} equipe{config.active_teams > 1 ? "s" : ""} •{" "}
                {Math.floor(config.total_minutes_per_day / 60)}h
                {config.total_minutes_per_day % 60 > 0 ? `${config.total_minutes_per_day % 60}min` : ""} por equipe •{" "}
                {config.works_saturday ? "Trabalha sábado" : "Sem sábado"} •{" "}
                {config.default_travel_minutes}min deslocamento padrão
              </p>
            </div>
          </div>
          <Button onClick={() => setModalOpen(true)}>Editar Configuração</Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center space-y-3">
          <p className="text-sm text-muted-foreground">Nenhuma configuração definida ainda.</p>
          <Button onClick={() => setModalOpen(true)}>Configurar Agora</Button>
        </div>
      )}

      <OperationalCapacityModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        config={config ?? null}
        onSave={async (data) => { await save(data); setModalOpen(false); }}
        isSaving={isSaving}
      />
    </div>
  );
}
