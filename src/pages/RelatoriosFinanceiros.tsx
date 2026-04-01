import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AppLayout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, FileText } from "lucide-react";
import { useTransactions, CATEGORY_LABELS } from "@/hooks/useTransactions";
import { useTransactionCategories } from "@/hooks/useTransactionCategories";
import { useOrganization } from "@/hooks/useOrganization";
import { generateFinanceReportPDF } from "@/lib/generateFinanceReportPDF";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";

export default function RelatoriosFinanceiros() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { organization } = useOrganization();
  const { categories, groupedIncomeCategories, groupedExpenseCategories } = useTransactionCategories();

  const startDate = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const endDate = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const { transactions, totals, isLoading } = useTransactions({
    startDate,
    endDate,
  });

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  // Build a category label map
  const categoryLabelMap = useMemo(() => {
    const map: Record<string, string> = { ...CATEGORY_LABELS };
    categories.forEach((cat) => {
      map[cat.slug] = cat.name;
    });
    return map;
  }, [categories]);

  // Build slug -> parent_id map
  const slugToParentId = useMemo(() => {
    const map: Record<string, string | null> = {};
    categories.forEach((cat) => {
      map[cat.slug] = cat.parent_id;
    });
    return map;
  }, [categories]);

  // Build id -> category map
  const idToCategory = useMemo(() => {
    const map: Record<string, { name: string; id: string }> = {};
    categories.forEach((cat) => {
      map[cat.id] = { name: cat.name, id: cat.id };
    });
    return map;
  }, [categories]);

  // Helper to get grouped categories by type
  const getGroupedCategories = (txType: "income" | "expense") =>
    txType === "income" ? groupedIncomeCategories : groupedExpenseCategories;

  // Group transactions by parent category
  const groupedByParent = (txType: "income" | "expense") => {
    const filtered = transactions.filter((t) => t.type === txType);
    const grouped = getGroupedCategories(txType);
    const totalAmount = filtered.reduce((sum, t) => sum + Number(t.amount), 0);

    return grouped.map((group) => {
      const childSlugs = group.children.map((c) => c.slug);
      const groupTransactions = filtered.filter((t) => childSlugs.includes(t.category));
      const groupTotal = groupTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

      const childBreakdown = group.children
        .map((child) => {
          const childTotal = filtered
            .filter((t) => t.category === child.slug)
            .reduce((sum, t) => sum + Number(t.amount), 0);
          return { slug: child.slug, name: child.name, value: childTotal };
        })
        .filter((c) => c.value > 0)
        .sort((a, b) => b.value - a.value);

      return {
        parentName: group.parent.name,
        parentId: group.parent.id,
        total: groupTotal,
        percentage: totalAmount > 0 ? (groupTotal / totalAmount) * 100 : 0,
        children: childBreakdown,
      };
    }).filter((g) => g.total > 0).sort((a, b) => b.total - a.total);
  };

  const expenseGroups = useMemo(() => groupedByParent("expense"), [transactions, groupedExpenseCategories, categories]);
  const incomeGroups = useMemo(() => groupedByParent("income"), [transactions, groupedIncomeCategories, categories]);

  const handleExportPDF = () => {
    generateFinanceReportPDF({
      transactions,
      month: currentMonth,
      totals,
      organizationName: organization?.name || "Empresa",
    });
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios Financeiros</h1>
          <p className="text-muted-foreground">Análise detalhada de receitas e despesas</p>
        </div>
        <Button onClick={handleExportPDF} className="gap-2">
          <FileText className="h-4 w-4" />
          Exportar PDF
        </Button>
      </div>

      {/* Month selector */}
      <div className="mb-6 flex items-center justify-center gap-4">
        <Button variant="ghost" size="icon" onClick={handlePrevMonth}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="text-lg font-semibold min-w-[150px] text-center capitalize">
          {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
        </span>
        <Button variant="ghost" size="icon" onClick={handleNextMonth}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Receitas</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(totals.income)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {incomeGroups.length} grupos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Despesas</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(totals.expense)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {expenseGroups.length} grupos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Saldo Líquido</CardTitle>
            <Wallet className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totals.balance >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(totals.balance)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {totals.balance >= 0 ? "Positivo" : "Negativo"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Expenses by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-500" />
              Despesas por Categoria
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : expenseGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma despesa registrada neste período
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[120px]">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenseGroups.map((group) => (
                    <React.Fragment key={group.parentId}>
                      <TableRow className="bg-muted/30">
                        <TableCell className="font-semibold">{group.parentName}</TableCell>
                        <TableCell className="text-right font-semibold text-red-600">
                          {formatCurrency(group.total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={group.percentage} className="h-2" />
                            <span className="text-xs text-muted-foreground w-10">
                              {group.percentage.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.children.map((child) => (
                        <TableRow key={child.slug}>
                          <TableCell className="pl-8 text-sm text-muted-foreground">{child.name}</TableCell>
                          <TableCell className="text-right text-sm text-red-500">
                            {formatCurrency(child.value)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Income by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-500" />
              Receitas por Origem
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : incomeGroups.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma receita registrada neste período
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Origem</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="w-[120px]">%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {incomeGroups.map((group) => (
                    <>
                      <TableRow key={group.parentId} className="bg-muted/30">
                        <TableCell className="font-semibold">{group.parentName}</TableCell>
                        <TableCell className="text-right font-semibold text-green-600">
                          {formatCurrency(group.total)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Progress value={group.percentage} className="h-2" />
                            <span className="text-xs text-muted-foreground w-10">
                              {group.percentage.toFixed(0)}%
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.children.map((child) => (
                        <TableRow key={child.slug}>
                          <TableCell className="pl-8 text-sm text-muted-foreground">{child.name}</TableCell>
                          <TableCell className="text-right text-sm text-green-500">
                            {formatCurrency(child.value)}
                          </TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </>
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
