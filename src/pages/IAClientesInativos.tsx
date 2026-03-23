import { useMemo } from "react";
import { AppLayout } from "@/components/layout";
import { useServices } from "@/hooks/useServices";
import { useClients } from "@/hooks/useClients";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, UserCheck, Plus, MessageCircle, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function IAClientesInativos() {
  const navigate = useNavigate();
  const { services } = useServices();
  const { clients } = useClients();

  const data = useMemo(() => {
    const now = new Date();
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const clientLastService: Record<string, { date: Date; total: number }> = {};
    (services || []).forEach((s) => {
      if (s.status !== "completed") return;
      const d = s.completed_date || s.scheduled_date || s.created_at;
      if (!d) return;
      const date = new Date(d);
      const val = Number(s.value) || 0;
      if (!clientLastService[s.client_id]) {
        clientLastService[s.client_id] = { date, total: val };
      } else {
        clientLastService[s.client_id].total += val;
        if (date > clientLastService[s.client_id].date) {
          clientLastService[s.client_id].date = date;
        }
      }
    });

    return (clients || [])
      .filter((c) => {
        const info = clientLastService[c.id];
        return info && info.date < sixMonthsAgo;
      })
      .map((c) => ({
        ...c,
        lastServiceDate: clientLastService[c.id].date,
        totalSpent: clientLastService[c.id].total,
      }))
      .sort((a, b) => a.lastServiceDate.getTime() - b.lastServiceDate.getTime());
  }, [services, clients]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <UserCheck className="h-5 w-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Clientes para Reativar</h1>
            <p className="text-sm text-muted-foreground">
              Clientes cujo último serviço concluído foi há mais de 6 meses
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">
              {data.length} cliente{data.length !== 1 ? "s" : ""} inativo{data.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data.length === 0 ? (
              <p className="text-muted-foreground text-sm p-6">Nenhum cliente inativo encontrado. 🎉</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Último Serviço</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>
                        {format(c.lastServiceDate, "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {c.totalSpent.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => navigate(`/ordens-servico/nova?client=${c.id}`)}
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" /> Criar OS
                          </Button>
                          <Button size="sm" variant="ghost" title="Enviar WhatsApp (em breve)">
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/servicos?client=${c.id}`)}
                            title="Ver histórico"
                          >
                            <History className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
