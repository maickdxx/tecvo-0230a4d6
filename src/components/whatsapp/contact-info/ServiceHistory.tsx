import { useNavigate } from "react-router-dom";
import { Calendar, Hash, Clock, FileText, ChevronRight, Wrench, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ServiceRecord {
  id: string;
  quote_number: number;
  service_type: string;
  status: string;
  scheduled_date: string | null;
  completed_date: string | null;
  value: number | null;
  description: string | null;
}

interface ServiceHistoryProps {
  stats: { count: number; firstDate: string | null; lastDate: string | null; lastServiceType: string | null } | null;
  openServices: ServiceRecord[];
  recentServices: ServiceRecord[];
  clientId: string;
  onShowCreateOS?: () => void;
}

const SERVICE_TYPE_LABELS: Record<string, string> = {
  installation: "Instalação",
  maintenance: "Manutenção",
  cleaning: "Limpeza",
  repair: "Reparo",
  inspection: "Inspeção",
  other: "Outro",
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pendente", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  scheduled: { label: "Agendado", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  in_progress: { label: "Em andamento", className: "bg-purple-500/10 text-purple-700 border-purple-200" },
  completed: { label: "Concluído", className: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
  cancelled: { label: "Cancelado", className: "bg-muted text-muted-foreground border-border" },
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); } catch { return "—"; }
};

export function ServiceHistory({ stats, openServices, recentServices, clientId, onShowCreateOS }: ServiceHistoryProps) {
  const navigate = useNavigate();

  if (!stats) return null;

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      {stats.count > 0 && (
        <div className="rounded-lg border border-border p-3 space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Resumo de atendimentos
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/50 p-2 text-center">
              <p className="text-lg font-bold text-foreground">{stats.count}</p>
              <p className="text-[10px] text-muted-foreground">Total de OS</p>
            </div>
            <div className="rounded-md bg-muted/50 p-2 text-center">
              <p className="text-xs font-semibold text-foreground">{formatDate(stats.lastDate)}</p>
              <p className="text-[10px] text-muted-foreground">Último atend.</p>
            </div>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Primeiro atendimento</span>
              <span className="font-medium text-foreground">{formatDate(stats.firstDate)}</span>
            </div>
            {stats.lastServiceType && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Último tipo</span>
                <span className="font-medium text-foreground">
                  {SERVICE_TYPE_LABELS[stats.lastServiceType] || stats.lastServiceType}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Open services */}
      {openServices.length > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/[0.03] p-3 space-y-2">
          <h4 className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1">
            <Clock className="h-3 w-3" /> OS em andamento ({openServices.length})
          </h4>
          <div className="space-y-1.5">
            {openServices.map((svc) => (
              <ServiceRow key={svc.id} service={svc} onClick={() => navigate(`/ordens-servico/${svc.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Recent services */}
      {recentServices.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <FileText className="h-3 w-3" /> Últimas ordens de serviço
          </h4>
          <div className="space-y-1.5">
            {recentServices.map((svc) => (
              <ServiceRow key={svc.id} service={svc} onClick={() => navigate(`/ordens-servico/${svc.id}`)} />
            ))}
          </div>
        </div>
      )}

      {/* Create OS button */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5 text-xs h-8"
        onClick={() => onShowCreateOS?.()}
        disabled={!onShowCreateOS}
      >
        <Plus className="h-3 w-3" /> Criar nova OS
      </Button>

      {stats.count === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhuma ordem de serviço registrada para este cliente.
        </p>
      )}
    </div>
  );
}

function ServiceRow({ service, onClick }: { service: ServiceRecord; onClick: () => void }) {
  const statusCfg = STATUS_CONFIG[service.status] || STATUS_CONFIG.pending;
  const date = service.scheduled_date || service.completed_date;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2 text-xs py-2 px-2.5 rounded-md hover:bg-muted/60 transition-colors text-left border border-transparent hover:border-border"
    >
      <div className="flex-1 min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-foreground">OS #{service.quote_number}</span>
          <Badge variant="outline" className={`text-[9px] px-1 py-0 h-4 ${statusCfg.className}`}>
            {statusCfg.label}
          </Badge>
        </div>
        <p className="text-muted-foreground truncate">
          {service.description || SERVICE_TYPE_LABELS[service.service_type] || service.service_type}
        </p>
        {date && (
          <p className="text-[10px] text-muted-foreground/70">
            {formatDate(date)}
            {service.value != null && ` · R$ ${service.value.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`}
          </p>
        )}
      </div>
      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
    </button>
  );
}
