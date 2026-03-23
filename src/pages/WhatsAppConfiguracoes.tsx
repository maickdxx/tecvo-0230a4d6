import { useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Radio,
  Tag,
  Bot,
  MessageSquareText,
  Users,
  BarChart3,
  Bell,
  ChevronRight,
  Settings2,
  Activity,
} from "lucide-react";

const MENU_ITEMS = [
  {
    title: "Canais",
    description: "Gerencie seus WhatsApps conectados",
    icon: Radio,
    path: "/whatsapp/canais",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    title: "Etiquetas",
    description: "Organize conversas com etiquetas coloridas",
    icon: Tag,
    path: "/whatsapp/etiquetas",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    title: "Respostas rápidas",
    description: "Atalhos para mensagens frequentes",
    icon: MessageSquareText,
    path: "/whatsapp/respostas-rapidas",
    color: "text-accent-foreground",
    bg: "bg-accent/10",
  },
  {
    title: "Chatbots",
    description: "Automações e fluxos de atendimento",
    icon: Bot,
    path: "/whatsapp/bots",
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    title: "Atendentes",
    description: "Equipe e atribuição de conversas",
    icon: Users,
    path: "/whatsapp/atendentes",
    color: "text-info",
    bg: "bg-info/10",
  },
  {
    title: "Relatório",
    description: "Métricas e desempenho do atendimento",
    icon: BarChart3,
    path: "/whatsapp/relatorio",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  {
    title: "Monitor de Envios",
    description: "Controle de limites, bloqueios e proteções",
    icon: Activity,
    path: "/whatsapp/monitor",
    color: "text-info",
    bg: "bg-info/10",
  },
  {
    title: "Notificações",
    description: "Configure alertas de novas mensagens",
    icon: Bell,
    path: "/configuracoes?tab=notifications",
    color: "text-warning",
    bg: "bg-warning/10",
  },
];

export default function WhatsAppConfiguracoes() {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto px-4 py-6 sm:px-6 sm:py-8 space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/whatsapp")}
            className="gap-1.5 mb-2 -ml-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Settings2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-foreground">
                Configurações
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie canais, automações e preferências do WhatsApp.
              </p>
            </div>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className="group flex items-center gap-3.5 rounded-xl border border-border/60 bg-card p-4 text-left transition-all duration-200 hover:border-primary/30 hover:shadow-sm active:scale-[0.98]"
            >
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${item.bg} transition-colors group-hover:scale-105`}>
                <item.icon className={`h-5 w-5 ${item.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                <p className="text-xs text-muted-foreground leading-snug mt-0.5">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-primary/60" />
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}