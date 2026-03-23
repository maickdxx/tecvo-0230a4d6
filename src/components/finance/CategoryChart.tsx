import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Transaction } from "@/hooks/useTransactions";
import { useTransactionCategories } from "@/hooks/useTransactionCategories";

interface CategoryChartProps {
  transactions: Transaction[];
  type: "income" | "expense";
}

const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", 
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16",
  "#f97316", "#6366f1", "#14b8a6",
];

export function CategoryChart({ transactions, type }: CategoryChartProps) {
  const { categories, groupedIncomeCategories, groupedExpenseCategories } = useTransactionCategories();
  const grouped = type === "income" ? groupedIncomeCategories : groupedExpenseCategories;

  // Build slug -> parent name map
  const slugToParentName = useMemo(() => {
    const map: Record<string, string> = {};
    grouped.forEach((g) => {
      g.children.forEach((child) => {
        map[child.slug] = g.parent.name;
      });
    });
    return map;
  }, [grouped]);

  const data = useMemo(() => {
    const filtered = transactions.filter((t) => t.type === type);
    // Group by parent category
    const parentGrouped: Record<string, number> = {};
    filtered.forEach((t) => {
      const parentName = slugToParentName[t.category] || t.category;
      parentGrouped[parentName] = (parentGrouped[parentName] || 0) + Number(t.amount);
    });

    return Object.entries(parentGrouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, type, slugToParentName]);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            {type === "income" ? "Entradas por Categoria" : "Saídas por Categoria"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            Sem dados para exibir
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {type === "income" ? "Entradas por Categoria" : "Saídas por Categoria"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
            >
              {data.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend
              formatter={(value) => {
                const item = data.find((d) => d.name === value);
                const percentage = item ? ((item.value / total) * 100).toFixed(0) : 0;
                return `${value} (${percentage}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
