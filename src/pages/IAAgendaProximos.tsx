import { useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useServices } from "@/hooks/useServices";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ServiceStatusBadge } from "@/components/services/ServiceStatusBadge";
import { formatDateInTz, getTodayInTz, formatDateObjInTz, getDatePartInTz, DEFAULT_TIMEZONE } from "@/lib/timezone";

export default function IAAgendaProximos() {
  const navigate = useNavigate();
  const { services } = useServices();
  const tz = DEFAULT_TIMEZONE;

  const data = useMemo(() => {
    const now = new Date();
    const todayStr = getTodayInTz(tz);
    const sevenDaysAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const sevenStr = formatDateObjInTz(sevenDaysAhead, tz);

    return (services || [])
      .filter(
        (s) =>
          s.status === "scheduled" &&
          s.scheduled_date &&
          getDatePartInTz(s.scheduled_date, tz) >= todayStr &&
          getDatePartInTz(s.scheduled_date, tz) <= sevenStr
      )
      .sort((a, b) => (a.scheduled_date! > b.scheduled_date! ? 1 : -1));
  }, [services]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Agenda — Próximos 7 dias</h1>
            <p className="text-sm text-muted-foreground">
              Serviços agendados para a próxima semana
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {data.length} serviço{data.length !== 1 ? "s" : ""} agendado{data.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.length === 0 ? (
              <p className="text-muted-foreground text-sm p-6">Nenhum serviço agendado nos próximos 7 dias.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
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
                      <TableCell className="text-right">
                        {s.value ? `R$ ${Number(s.value).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const docType = s.document_type;
                            if (docType === "service_order") {
                              navigate(`/ordens-servico/${s.id}`);
                            } else {
                              navigate(`/orcamentos/editar/${s.id}`);
                            }
                          }}
                        >
                          Editar
                        </Button>
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
