import { Building2, Users, Crown, Sparkles, CreditCard, XCircle, Activity, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface AdminStatsProps {
  stats: {
    total: number;
    free: number;
    essential: number;
    pro: number;
    totalUsers: number;
    totalSuperAdmins?: number;
    starter?: number;
    inTrial?: number;
    activeSubscribers?: number;
    cancelledCount?: number;
  };
  engagementSummary?: {
    active: number;
    warm: number;
    risk: number;
  };
}

export function AdminStats({ stats, engagementSummary }: AdminStatsProps) {
  const statCards = [
    {
      title: "Total de Clientes",
      value: stats.total,
      icon: Building2,
      color: "text-blue-600 bg-blue-100 dark:bg-blue-900/30",
    },
    {
      title: "Plano Free",
      value: stats.free,
      icon: Users,
      color: "text-gray-600 bg-gray-100 dark:bg-gray-800",
    },
    {
      title: "Plano Essencial",
      value: stats.essential,
      icon: Sparkles,
      color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
    },
    {
      title: "Plano Pro",
      value: stats.pro,
      icon: Crown,
      color: "text-purple-600 bg-purple-100 dark:bg-purple-900/30",
    },
    {
      title: "Total de Usuários",
      value: stats.totalUsers,
      icon: Users,
      color: "text-green-600 bg-green-100 dark:bg-green-900/30",
    },
    ...(stats.totalSuperAdmins !== undefined ? [{
      title: "Super Admins",
      value: stats.totalSuperAdmins,
      icon: Crown,
      color: "text-red-600 bg-red-100 dark:bg-red-900/30",
    }] : []),
    ...(stats.starter !== undefined ? [{
      title: "Plano Starter",
      value: stats.starter,
      icon: Users,
      color: "text-cyan-600 bg-cyan-100 dark:bg-cyan-900/30",
    }] : []),
    ...(stats.inTrial !== undefined ? [{
      title: "Em Trial",
      value: stats.inTrial,
      icon: Sparkles,
      color: "text-orange-600 bg-orange-100 dark:bg-orange-900/30",
    }] : []),
    ...(stats.activeSubscribers !== undefined ? [{
      title: "Assinantes Ativos",
      value: stats.activeSubscribers,
      icon: CreditCard,
      color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
    }] : []),
    ...(stats.cancelledCount !== undefined ? [{
      title: "Cancelados",
      value: stats.cancelledCount,
      icon: XCircle,
      color: "text-rose-600 bg-rose-100 dark:bg-rose-900/30",
    }] : []),
    // Engagement summary cards
    ...(engagementSummary ? [
      {
        title: "Usuários Ativos",
        value: engagementSummary.active,
        icon: TrendingUp,
        color: "text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30",
      },
      {
        title: "Usuários Mornos",
        value: engagementSummary.warm,
        icon: Activity,
        color: "text-amber-600 bg-amber-100 dark:bg-amber-900/30",
      },
      {
        title: "Risco de Churn",
        value: engagementSummary.risk,
        icon: AlertTriangle,
        color: "text-red-600 bg-red-100 dark:bg-red-900/30",
      },
    ] : []),
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {statCards.map((stat) => (
        <Card key={stat.title}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.title}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
