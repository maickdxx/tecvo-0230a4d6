import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { useRecebimentosTecnico, RecebimentosFilters } from "@/hooks/useRecebimentosTecnico";
import { TechnicianReceiptsSummary } from "@/components/finance/TechnicianReceiptsSummary";
import { useUserRole } from "@/hooks/useUserRole";
import { useOrganization } from "@/hooks/useOrganization";
import { formatPaymentMethod } from "@/lib/formatPaymentMethod";
import { generateRecebimentosTecnicoPDF } from "@/lib/generateRecebimentosTecnicoPDF";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Download, Filter } from "lucide-react";
import { toast } from "sonner";

export default function RecebimentosTecnico() {
  const [filters, setFilters] = useState<RecebimentosFilters>({});
  const { organization } = useOrganization();

  const { recebimentos, summaries, technicians, isLoading } =
    useRecebimentosTecnico(filters);

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const handleExportPDF = () => {
    if (recebimentos.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }
    const selectedTech = technicians.find((t) => t.id === filters.technicianId);
    generateRecebimentosTecnicoPDF({
      recebimentos,
      summaries,
      organizationName: organization?.name ?? "Empresa",
      filters: {
        technicianName: selectedTech?.name,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        paymentMethod: filters.paymentMethod,
      },
    });
    toast.success("PDF exportado com sucesso");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Recebimentos por Técnico</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Serviços concluídos e a forma de pagamento informada pelo técnico
            </p>
          </div>
          <Button variant="outline" onClick={handleExportPDF} disabled={recebimentos.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar PDF
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl border border-border bg-card">
          <Filter className="h-4 w-4 text-muted-foreground mt-1" />

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Técnico</label>
            <Select
              value={filters.technicianId ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, technicianId: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data inicial</label>
            <Input
              type="date"
              className="w-[160px]"
              value={filters.dateFrom ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value || undefined }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Data final</label>
            <Input
              type="date"
              className="w-[160px]"
              value={filters.dateTo ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value || undefined }))}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Forma de pagamento</label>
            <Select
              value={filters.paymentMethod ?? "all"}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, paymentMethod: v === "all" ? undefined : v }))
              }
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credit_card_1x">Crédito 1x</SelectItem>
                <SelectItem value="credit_card_2x">Crédito 2x</SelectItem>
                <SelectItem value="credit_card_3x">Crédito 3x</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Summary cards */}
        <TechnicianReceiptsSummary summaries={summaries} />

        {/* Data table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>N° OS</TableHead>
                <TableHead>Técnico</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Forma de Pagamento</TableHead>
                <TableHead>Concluído em</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando...
                  </TableCell>
                </TableRow>
              ) : recebimentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum serviço concluído encontrado
                  </TableCell>
                </TableRow>
              ) : (
                recebimentos.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.client_name}</TableCell>
                    <TableCell>#{r.quote_number}</TableCell>
                    <TableCell>{r.technician_name ?? "Não atribuído"}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(r.amount)}
                    </TableCell>
                    <TableCell>
                      {r.payment_method ? (
                        <Badge variant="outline">{formatPaymentMethod(r.payment_method)}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">Não informado</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.completed_date
                        ? format(new Date(r.completed_date), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
