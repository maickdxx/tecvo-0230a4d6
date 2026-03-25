import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  Pencil,
  Wrench,
  Camera,
  AlertCircle,
} from "lucide-react";
import type { ServiceEquipmentWithReport } from "@/hooks/useServiceExecutionMode";

interface EquipmentListViewProps {
  equipment: ServiceEquipmentWithReport[];
  completedCount: number;
  totalCount: number;
  onSelectEquipment: (equipmentId: string) => void;
  onBack: () => void;
  onFinalize: () => void;
  allCompleted: boolean;
  serviceName?: string;
  clientName?: string;
}

const STATUS_CONFIG = {
  pending: {
    label: "Pendente",
    icon: Clock,
    className: "bg-muted text-muted-foreground",
  },
  in_progress: {
    label: "Em preenchimento",
    icon: Pencil,
    className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  completed: {
    label: "Concluído",
    icon: CheckCircle,
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
};

export function EquipmentListView({
  equipment,
  completedCount,
  totalCount,
  onSelectEquipment,
  onBack,
  onFinalize,
  allCompleted,
  serviceName,
  clientName,
}: EquipmentListViewProps) {
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  return (
    <div className="space-y-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-foreground">Execução do Serviço</h1>
          {clientName && (
            <p className="text-sm text-muted-foreground truncate">{clientName}</p>
          )}
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Progresso</span>
            <span className="text-sm text-muted-foreground">
              {completedCount} de {totalCount}
            </span>
          </div>
          <Progress value={progress} className="h-2" />
        </CardContent>
      </Card>

      {/* No equipment warning */}
      {equipment.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground text-sm">
              Nenhum equipamento cadastrado neste serviço.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Adicione equipamentos ao serviço para iniciar a execução.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Equipment cards */}
      <div className="space-y-3">
        {equipment.map((eq) => {
          const status = eq.reportData?.status || "pending";
          const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
          const StatusIcon = config.icon;

          return (
            <Card
              key={eq.id}
              className="cursor-pointer hover:bg-muted/30 transition-colors active:scale-[0.99]"
              onClick={() => onSelectEquipment(eq.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shrink-0">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium text-sm truncate">
                        {eq.name || "Equipamento"}
                      </span>
                      <Badge className={`text-[10px] shrink-0 ${config.className}`}>
                        <StatusIcon className="h-2.5 w-2.5 mr-0.5" />
                        {config.label}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {[eq.brand, eq.model].filter(Boolean).join(" — ") || "Sem detalhes"}
                    </p>
                    {eq.photoCount > 0 && (
                      <div className="flex items-center gap-1 mt-1">
                        <Camera className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] text-muted-foreground">
                          {eq.photoCount} foto{eq.photoCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Finalize button */}
      {totalCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4 z-50">
          <Button
            className="w-full"
            disabled={!allCompleted}
            onClick={onFinalize}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            {allCompleted
              ? "Finalizar Atendimento"
              : `Conclua todos os equipamentos (${completedCount}/${totalCount})`}
          </Button>
        </div>
      )}
    </div>
  );
}
