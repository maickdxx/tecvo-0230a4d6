import { useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useServices } from "@/hooks/useServices";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ServiceStatusBadge } from "@/components/services/ServiceStatusBadge";
import { formatDateInTz, getTodayInTz, formatDateObjInTz, getDatePartInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";

export default function IAReceitaPrevista() {
  const navigate = useNavigate();
  const { services } = useServices();
  const tz = DEFAULT_TIMEZONE;

  const { data, total } = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayInTz(tz);
    const limite30 = new Date();
    limite30.setDate(now.getDate() + 30);
    const limite30Str = formatDateObjInTz(limite30, tz);

    const filtered = (services || [])
      .filter(
        (s) =>
          (s.status === "scheduled" || s.status === "in_progress") &&
          s.scheduled_date &&
          getDatePartInTz(s.scheduled_date, tz) >= todayStr &&
          getDatePartInTz(s.scheduled_date, tz) <= limite30Str &&
          Number(s.value) > 0
      )
      .sort((a, b) => (a.scheduled_date! > b.scheduled_date! ? 1 : -1));

    const total = filtered.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

    return { data: filtered, total };
  }, [services]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Receita Prevista — 30 dias</h1>
            <p className="text-sm text-muted-foreground">
              Serviços agendados e em andamento que compõem a projeção de receita
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                {data.length} serviço{data.length !== 1 ? "s" : ""}
              </CardTitle>
              <Badge className="text-sm bg-primary/10 text-primary border-0">
                Total: R$ {total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {data.length === 0 ? (
              <p className="text-muted-foreground text-sm p-6">Nenhum serviço previsto nos próximos 30 dias.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {formatDateInTz(s.scheduled_date!, tz)}
                      </TableCell>
                      <TableCell className="font-medium">{s.client?.name || "—"}</TableCell>
                      <TableCell>{s.assigned_profile?.full_name || "—"}</TableCell>
                      <TableCell><ServiceStatusBadge status={s.status} /></TableCell>
                      <TableCell className="text-right font-medium">
                        R$ {Number(s.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
