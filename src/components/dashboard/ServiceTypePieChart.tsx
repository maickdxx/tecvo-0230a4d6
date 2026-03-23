import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useServices } from "@/hooks/useServices";
import { useServiceTypes } from "@/hooks/useServiceTypes";
import { getServicosAtivos } from "@/lib/coreServiceEngine";

interface ServiceTypePieChartProps {
  startDate: string;
  endDate: string;
}

const ENUM_TO_PT: Record<string, string> = {
  cleaning: "Limpeza",
  installation: "Instalação",
  maintenance: "Manutenção",
  maintenance_contract: "Contratos",
  other: "Outros",
  repair: "Reparo",
  
};

const LABEL_COLORS: Record<string, string> = {
  "Limpeza": "hsl(158 65% 42%)",
  "Manutenção": "hsl(38 92% 50%)",
  "Instalação": "hsl(210 85% 45%)",
  "Contratos": "hsl(280 50% 55%)",
  "Reparo": "hsl(0 75% 55%)",
  
  "Outros": "hsl(215 15% 55%)",
};

const FALLBACK_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function getColorForLabel(label: string, index: number): string {
  return LABEL_COLORS[label] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

export function ServiceTypePieChart({ startDate, endDate }: ServiceTypePieChartProps) {
  const { services, isLoading } = useServices();
  const { typeLabels } = useServiceTypes();

  const chartData = useMemo(() => {
    const ativos = getServicosAtivos(services, startDate, endDate);
    const counts: Record<string, number> = {};
    for (const s of ativos) {
      const tipo = s.service_type || "outros";
      const label = typeLabels[tipo] || ENUM_TO_PT[tipo] || tipo;
      counts[label] = (counts[label] || 0) + 1;
    }
    return Object.entries(counts)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value }));
  }, [services, startDate, endDate, typeLabels]);

  const total = chartData.reduce((s, d) => s + d.value, 0);

  if (isLoading || chartData.length === 0) {
    return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
        <h3 className="text-base font-semibold text-card-foreground mb-1">Tipos de Serviço</h3>
        <p className="text-xs text-muted-foreground">Distribuição no período</p>
        <div className="flex h-52 items-center justify-center text-muted-foreground text-sm">
          Nenhum serviço no período.
        </div>
      </div>
    );
  }

  return (
      <div className="rounded-xl border border-border/60 bg-card p-5 shadow-card">
      <h3 className="text-base font-semibold text-card-foreground mb-1">Tipos de Serviço</h3>
      <p className="text-xs text-muted-foreground mb-3">Distribuição no período</p>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="h-52 w-full sm:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={getColorForLabel(entry.name, i)} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
                formatter={(value: number, name: string) => [
                  `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`,
                  name,
                ]}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex flex-col gap-1.5 sm:w-1/2">
          {chartData.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-sm">
              <div
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: getColorForLabel(d.name, i) }}
              />
              <span className="text-muted-foreground truncate">{d.name}</span>
              <span className="ml-auto font-semibold text-card-foreground">
                {d.value} ({total > 0 ? Math.round((d.value / total) * 100) : 0}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
