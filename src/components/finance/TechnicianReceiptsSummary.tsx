import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TechnicianSummary } from "@/hooks/useRecebimentosTecnico";
import { formatPaymentMethod } from "@/lib/formatPaymentMethod";
import { User } from "lucide-react";

interface Props {
  summaries: TechnicianSummary[];
}

export function TechnicianReceiptsSummary({ summaries }: Props) {
  if (summaries.length === 0) return null;

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {summaries.map((s) => (
        <Card key={s.technician_id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              {s.technician_name}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            <p className="text-lg font-bold text-primary">
              {formatCurrency(s.total)}
            </p>
            <div className="space-y-0.5">
              {Object.entries(s.byMethod).map(([method, amount]) => (
                <div
                  key={method}
                  className="flex justify-between text-xs text-muted-foreground"
                >
                  <span>{formatPaymentMethod(method)}</span>
                  <span className="font-medium">{formatCurrency(amount)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
