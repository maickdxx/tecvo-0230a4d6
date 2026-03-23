import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(142, 76%, 36%)",
  "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(262, 83%, 58%)",
];

interface Props {
  report: {
    isLoading: boolean;
    perDay: { date: string; count: number }[];
    byChannel: { id: string; name: string; count: number }[];
    byAssignee: { name: string; count: number; converted: number }[];
  };
}

export function ReportCharts({ report }: Props) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Conversations per day */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversas por dia</CardTitle>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-[250px]" />
          ) : (
            <ChartContainer config={{ count: { label: "Conversas", color: "hsl(var(--primary))" } }} className="h-[250px]">
              <BarChart data={report.perDay}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <ChartTooltip content={<ChartTooltipContent hideLabel={false} />} labelFormatter={(label) => label} />
                <Bar dataKey="count" name="Conversas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      {/* By channel - fixed pie chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Conversas por número de WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-[250px]" />
          ) : report.byChannel.length === 0 || report.byChannel.every((c) => c.count === 0) ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum dado disponível</p>
          ) : (
            <div className="h-[250px] flex items-center gap-4">
              <div className="flex-1 h-full">
                <ChartContainer
                  config={Object.fromEntries(
                    report.byChannel
                      .filter((ch) => ch.count > 0)
                      .map((ch, i) => [ch.name, { label: ch.name, color: CHART_COLORS[i % CHART_COLORS.length] }])
                  )}
                  className="h-full"
                >
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie
                      data={report.byChannel.filter((ch) => ch.count > 0)}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {report.byChannel
                        .filter((ch) => ch.count > 0)
                        .map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              </div>
              <div className="space-y-2 min-w-[140px]">
                {report.byChannel
                  .filter((ch) => ch.count > 0)
                  .map((ch, i) => (
                    <div key={ch.id} className="flex items-center gap-2 text-sm">
                      <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground truncate max-w-[100px]">{ch.name}</span>
                      <span className="font-semibold text-foreground ml-auto">{ch.count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* By assignee with conversion */}
      <Card className="lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Desempenho por atendente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {report.isLoading ? (
            <Skeleton className="h-[200px]" />
          ) : report.byAssignee.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Nenhum atendente atribuído</p>
          ) : (
            <ChartContainer
              config={{
                count: { label: "Conversas", color: "hsl(var(--primary))" },
                converted: { label: "Convertidas", color: "hsl(142, 76%, 36%)" },
              }}
              className="h-[250px]"
            >
              <BarChart data={report.byAssignee} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" name="Conversas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                <Bar dataKey="converted" name="Convertidas" fill="hsl(142, 76%, 36%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
