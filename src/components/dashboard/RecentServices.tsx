import React from "react";
import { Clock, CheckCircle2, AlertCircle, XCircle, Wrench, CircleDollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRecentServices } from "@/hooks/useDashboardStats";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const statusConfig = {
  scheduled: {
    label: "Agendado",
    icon: Clock,
    className: "bg-info/10 text-info",
  },
  in_progress: {
    label: "Em andamento",
    icon: AlertCircle,
    className: "bg-warning/10 text-warning",
  },
  completed: {
    label: "Concluído",
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
  cancelled: {
    label: "Cancelado",
    icon: XCircle,
    className: "bg-muted text-muted-foreground",
  },
};

export const RecentServices = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  (props, ref) => {
    const { recentServices, isLoading } = useRecentServices(5);

    if (isLoading) {
      return (
        <div ref={ref} {...props} className="rounded-xl border border-border bg-card shadow-card">
          <div className="border-b border-border p-4">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-32" />
          </div>
          <div className="divide-y divide-border">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div>
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
                <div className="text-right">
                  <Skeleton className="h-5 w-20 mb-1" />
                  <Skeleton className="h-4 w-16" />
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const hasServices = recentServices.length > 0;

    return (
      <div ref={ref} {...props} className="rounded-xl border border-border bg-card shadow-card">
        <div className="border-b border-border p-4">
          <h3 className="text-lg font-semibold text-card-foreground">Serviços Recentes</h3>
          <p className="text-sm text-muted-foreground">Últimos atendimentos</p>
        </div>
        {!hasServices ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <div className="rounded-full bg-muted p-3 mb-3">
              <Wrench className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">Nenhum serviço cadastrado ainda.</p>
            <Link 
              to="/servicos" 
              className="mt-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Cadastrar primeiro serviço
            </Link>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border">
              {recentServices.map((service) => {
                const status = statusConfig[service.status];
                const StatusIcon = status.icon;
                return (
                  <div key={service.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={cn("rounded-lg p-2", status.className)}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-medium text-card-foreground">{service.client}</p>
                        <p className="text-sm text-muted-foreground">
                          {service.type} • {service.date}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      {service.value === 0 ? (
                        <CircleDollarSign className="h-4 w-4 text-muted-foreground ml-auto" />
                      ) : (
                        <p className="font-semibold text-card-foreground">
                          R$ {service.value.toLocaleString('pt-BR')}
                        </p>
                      )}
                      <p className={cn("text-xs font-medium", status.className.replace("bg-", "text-").split(" ")[1])}>
                        {service.statusLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="border-t border-border p-4">
              <Link 
                to="/servicos"
                className="block w-full text-center text-sm font-medium text-primary hover:text-primary/80 transition-colors"
              >
                Ver todos os serviços
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }
);

RecentServices.displayName = "RecentServices";
