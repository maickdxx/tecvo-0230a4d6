import React from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { Button } from "@/components/ui/button";

export const QuickActions = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const navigate = useNavigate();

    const actions = [
      {
        label: "Nova Entrada",
        icon: TrendingUp,
        variant: "default" as const,
        className: "bg-success hover:bg-success/90 text-success-foreground",
        onClick: () => navigate("/financeiro?type=income&create=true"),
      },
      {
        label: "Nova Saída",
        icon: TrendingDown,
        variant: "outline" as const,
        className: "border-destructive text-destructive hover:bg-destructive/10",
        onClick: () => navigate("/financeiro?type=expense&create=true"),
      },
      {
        label: "Novo Serviço",
        icon: Wallet,
        variant: "outline" as const,
        className: "",
        onClick: () => navigate("/ordens-servico?create=true"),
      },
      {
        label: "Pró-labore",
        icon: PiggyBank,
        variant: "outline" as const,
        className: "",
        onClick: () => navigate("/financeiro?type=expense&category=prolabore&create=true"),
      },
    ];

    return (
      <div ref={ref} {...props} className="rounded-xl border border-border bg-card p-4 shadow-card">
        <h3 className="mb-1 text-lg font-semibold text-card-foreground">Central Financeira</h3>
        <p className="mb-4 text-xs text-muted-foreground">Movimentações rápidas que impactam seu resultado</p>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant}
              className={`h-auto flex-col gap-2 py-4 ${action.className}`}
              onClick={action.onClick}
            >
              <action.icon className="h-5 w-5" />
              <span className="text-xs">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>
    );
  }
);

QuickActions.displayName = "QuickActions";
