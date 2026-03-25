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
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      {/* Header */}
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="-ml-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black text-foreground tracking-tight">EXECUTAR SERVIÇO</h1>
            {clientName && (
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{clientName}</p>
            )}
          </div>
        </div>

        {/* Progress Card */}
        <Card className="border-none shadow-none bg-primary/5 rounded-2xl overflow-hidden">
          <CardContent className="p-5">
            <div className="flex items-end justify-between mb-3">
              <div className="space-y-0.5">
                <span className="text-2xl font-black text-primary leading-none">
                  {Math.round(progress)}%
                </span>
                <p className="text-[10px] font-bold text-primary/60 uppercase">CONCLUÍDO</p>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-background/50 px-2 py-1 rounded-full border">
                {completedCount} / {totalCount} EQUIPAMENTOS
              </span>
            </div>
            <div className="relative h-2 w-full bg-primary/10 rounded-full overflow-hidden">
              <div 
                className="absolute left-0 top-0 h-full bg-primary transition-all duration-700 ease-out rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content */}
      <div className="px-4 pb-32 space-y-4">
        <h2 className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Equipamentos</h2>
        
        {equipment.length === 0 && (
          <div className="py-12 text-center space-y-3 bg-muted/20 rounded-3xl border-2 border-dashed border-muted">
            <AlertCircle className="h-10 w-10 mx-auto text-muted-foreground/30" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-muted-foreground">Nenhum equipamento cadastrado</p>
              <p className="text-[10px] text-muted-foreground/60 max-w-[200px] mx-auto uppercase">Adicione equipamentos para iniciar o laudo técnico.</p>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {equipment.map((eq) => {
            const status = eq.reportData?.status || "pending";
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;
            const isCompleted = status === "completed";

            return (
              <Card
                key={eq.id}
                className={`group relative border-2 transition-all duration-300 active:scale-[0.97] rounded-3xl overflow-hidden ${
                  isCompleted 
                    ? "border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10" 
                    : status === "in_progress" 
                      ? "border-primary/20 bg-primary/5" 
                      : "border-muted hover:border-primary/30"
                }`}
                onClick={() => onSelectEquipment(eq.id)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={`flex items-center justify-center h-14 w-14 rounded-2xl shrink-0 transition-colors ${
                      isCompleted ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30" : "bg-background border-2 border-muted text-muted-foreground"
                    }`}>
                      {isCompleted ? <CheckCircle className="h-7 w-7" /> : <Wrench className="h-7 w-7" />}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-black text-sm uppercase tracking-tight truncate">
                          {eq.name || "Equipamento"}
                        </span>
                        <Badge className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border-none ${config.className}`}>
                          {config.label}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-3 text-xs text-muted-foreground/80 font-medium">
                        <span className="truncate">{[eq.brand, eq.model].filter(Boolean).join(" • ")}</span>
                      </div>

                      <div className="flex items-center gap-3 mt-2">
                        {eq.photoCount > 0 && (
                          <div className="flex items-center gap-1 bg-background/50 px-2 py-0.5 rounded-full border border-muted">
                            <Camera className="h-3 w-3 text-primary" />
                            <span className="text-[10px] font-bold text-primary">{eq.photoCount} FOTOS</span>
                          </div>
                        )}
                        {isCompleted && (
                          <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 uppercase">
                            <CheckCircle className="h-3 w-3" /> LAUDO OK
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="h-8 w-8 rounded-full bg-background border flex items-center justify-center text-muted-foreground group-hover:bg-primary group-hover:text-white group-hover:border-primary transition-all">
                      <ChevronRight className="h-5 w-5" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Finalize button */}
      {totalCount > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-border p-5 z-50">
          <Button
            className={`w-full h-16 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl transition-all duration-300 ${
              allCompleted 
                ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20" 
                : "bg-muted text-muted-foreground cursor-not-allowed opacity-80"
            }`}
            disabled={!allCompleted}
            onClick={onFinalize}
          >
            {allCompleted ? (
              <>
                <CheckCircle className="h-6 w-6 mr-3" />
                Finalizar Atendimento
              </>
            ) : (
              `Faltam ${totalCount - completedCount} equipamentos`
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
