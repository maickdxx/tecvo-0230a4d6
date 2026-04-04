import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  CreditCard,
  Users,
  MessageSquare,
  Sparkles,
  Shield,
  Database,
  Ticket,
} from "lucide-react";

interface AdminQuickActionsProps {
  onNavigate: (tab: string) => void;
}

export function AdminQuickActions({ onNavigate }: AdminQuickActionsProps) {
  const actions = [
    { label: "Financeiro", icon: CreditCard, tab: "financial", color: "text-emerald-600" },
    { label: "Empresas", icon: Users, tab: "organizations", color: "text-blue-600" },
    { label: "Usuários", icon: Users, tab: "users", color: "text-violet-600" },
    { label: "WhatsApp", icon: MessageSquare, tab: "whatsapp", color: "text-green-600" },
    { label: "Créditos IA", icon: Sparkles, tab: "ai-credits", color: "text-amber-600" },
    { label: "Admins", icon: Shield, tab: "superadmins", color: "text-red-600" },
    { label: "Auditoria", icon: Database, tab: "logs", color: "text-purple-600" },
    { label: "Backups", icon: Database, tab: "backups", color: "text-slate-600" },
    { label: "Cupons", icon: Ticket, tab: "coupons", color: "text-orange-600" },
  ];

  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex flex-wrap gap-2">
          {actions.map((a) => (
            <Button
              key={a.tab}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs h-8"
              onClick={() => onNavigate(a.tab)}
            >
              <a.icon className={`h-3.5 w-3.5 ${a.color}`} />
              {a.label}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
