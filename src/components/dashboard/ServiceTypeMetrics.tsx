import { useMemo } from "react";
import { Snowflake, Droplets, Wrench, FileText, Eye, Calculator, MoreHorizontal } from "lucide-react";
import { useServices, SERVICE_TYPE_LABELS } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { getServicosAtivos } from "@/lib/coreServiceEngine";

interface Transaction {
  id: string;
  amount: number;
  status: string;
  service_id?: string | null;
  type: string;
}

interface ServiceTypeMetricsProps {
  startDate: string;
  endDate: string;
  incomeTransactions?: Transaction[];
}

const ENUM_TO_PT: Record<string, string> = {
  limpeza: "Limpeza",
  instalacao: "Instalação",
  manutencao: "Manutenção",
  reparo: "Reparo",
  contratos: "Contratos",
  pmoc: "PMOC",
  visita: "Visita Técnica",
  orcamento: "Orçamento",
  desinstalacao: "Desinstalação",
  outros: "Outros",
  // Legacy
  cleaning: "Limpeza",
  installation: "Instalação",
  maintenance: "Manutenção",
  maintenance_contract: "Contratos",
  repair: "Reparo",
  other: "Outros",
};

const ICON_MAP: Record<string, typeof Snowflake> = {
  instalacao: Snowflake,
  installation: Snowflake,
  limpeza: Droplets,
  cleaning: Droplets,
  manutencao: Wrench,
  maintenance: Wrench,
  contratos: FileText,
  maintenance_contract: FileText,
  reparo: Wrench,
  repair: Wrench,
  pmoc: Calculator,
  visita: Eye,
  orcamento: Calculator,
  desinstalacao: Wrench,
  outros: MoreHorizontal,
  other: MoreHorizontal,
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ServiceTypeMetrics({ startDate, endDate, incomeTransactions = [] }: ServiceTypeMetricsProps) {
  const { services, isLoading } = useServices();
  const { typeLabels } = useServiceTypes();

  const metricas = useMemo(() => {
    const ativos = getServicosAtivos(services, startDate, endDate);

    const serviceTypeMap = new Map<string, string>();
    for (const s of services) {
      serviceTypeMap.set(s.id, s.service_type || "outros");
    }

    const counts: Record<string, number> = {};
    for (const s of ativos) {
      const tipo = s.service_type || "outros";
      counts[tipo] = (counts[tipo] || 0) + 1;
    }

    const faturamento: Record<string, number> = {};
    const txCount: Record<string, number> = {};

    const paidIncome = incomeTransactions.filter(
      (t) => t.status === "paid" && t.service_id
    );

    for (const t of paidIncome) {
      const tipo = serviceTypeMap.get(t.service_id!) || "outros";
      faturamento[tipo] = (faturamento[tipo] || 0) + Number(t.amount);
      txCount[tipo] = (txCount[tipo] || 0) + 1;
    }

    const allSlugs = new Set([...Object.keys(counts), ...Object.keys(faturamento)]);
    const tiposAtivos = Array.from(allSlugs).filter(
      (tipo) => (counts[tipo] || 0) > 0 || (faturamento[tipo] || 0) > 0
    );

    tiposAtivos.sort((a, b) => {
      const fatA = faturamento[a] || 0;
      const fatB = faturamento[b] || 0;
      if (fatB !== fatA) return fatB - fatA;
      return (counts[b] || 0) - (counts[a] || 0);
    });

    const total = Object.values(counts).reduce((sum, c) => sum + c, 0);

    return { counts, faturamento, txCount, tiposAtivos, total };
  }, [services, startDate, endDate, incomeTransactions]);

  if (isLoading || metricas.tiposAtivos.length === 0) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        Por tipo de serviço
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {metricas.tiposAtivos.map((tipo) => {
          const count = metricas.counts[tipo] || 0;
          const fat = metricas.faturamento[tipo] || 0;
          const ticket = metricas.txCount[tipo] ? fat / metricas.txCount[tipo] : 0;
          const pct = metricas.total > 0 ? Math.round((count / metricas.total) * 100) : 0;
          const label = typeLabels[tipo] || ENUM_TO_PT[tipo] || SERVICE_TYPE_LABELS[tipo] || tipo;
          const Icon = ICON_MAP[tipo] || MoreHorizontal;

          return (
            <div
              key={tipo}
              className="rounded-xl border border-border bg-card p-3 shadow-card hover:shadow-card-hover transition-shadow"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
                  <p className="text-xl font-bold text-card-foreground">{count}</p>
                  <p className="text-[11px] text-muted-foreground">{pct}% do total</p>
                  {fat > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/40">
                      <p className="text-sm font-semibold text-success">
                        {formatCurrency(fat)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Ticket médio: {formatCurrency(ticket)}
                      </p>
                    </div>
                  )}
                </div>
                <div className="rounded-xl p-2.5 bg-muted text-muted-foreground">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
