import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout";
import { User, Bell, Shield, Palette, CreditCard, Tags, Users, Wallet, PenLine, Landmark, UserCircle, Settings2, Clock, Globe } from "lucide-react";
import { ProfileSettings, SubscriptionSettings, AppearanceSettings } from "@/components/settings";
import { TransactionCategoriesSettings } from "@/components/settings/TransactionCategoriesSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import { PaymentMethodsSettings } from "@/components/settings/PaymentMethodsSettings";

import { SignatureSettings } from "@/components/settings/SignatureSettings";
import { FinancialAccountsSettings } from "@/components/settings/FinancialAccountsSettings";
import { SecuritySettings } from "@/components/settings/SecuritySettings";
import { MyAccountSettings } from "@/components/settings/MyAccountSettings";
import { OperationalCapacitySettings } from "@/components/settings/OperationalCapacitySettings";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { TimeClockSettings } from "@/components/settings/TimeClockSettings";
import { ClientPortalSettings } from "@/components/settings/ClientPortalSettings";
import { toast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/useSubscription";

type SettingsView = "main" | "profile" | "my-account" | "subscription" | "transaction-categories" | "team" | "payment-methods" | "appearance" | "signature" | "security" | "financial-accounts" | "operational-capacity" | "notifications" | "time-clock" | "client-portal";

interface SettingItem {
  id: SettingsView;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  enabled: boolean;
}

interface SettingsGroup {
  label: string;
  items: SettingItem[];
}

const settingsGroups: SettingsGroup[] = [
  {
    label: "EMPRESA",
    items: [
      { id: "profile", title: "Perfil", description: "Informações da empresa para orçamentos e OS", icon: User, enabled: true },
      { id: "team", title: "Equipe", description: "Gerencie membros e funções", icon: Users, enabled: true },
      { id: "signature", title: "Assinatura da Empresa", description: "Assinatura digital para ordens de serviço", icon: PenLine, enabled: true },
      { id: "operational-capacity", title: "Estrutura Operacional", description: "Equipes, jornada e capacidade da agenda", icon: Settings2, enabled: true },
      { id: "time-clock", title: "Controle de Ponto", description: "Ative e configure o sistema de ponto", icon: Clock, enabled: true },
      { id: "client-portal", title: "Área do Cliente", description: "Portal, branding e link de acesso", icon: Globe, enabled: true },
    ],
  },
  {
    label: "ASSINATURA E COBRANÇA",
    items: [
      { id: "subscription", title: "Planos", description: "Gerencie sua assinatura", icon: CreditCard, enabled: true },
    ],
  },
  {
    label: "FINANCEIRO",
    items: [
      { id: "payment-methods", title: "Formas de Pagamento", description: "Defina quais formas sua empresa aceita e as taxas aplicadas", icon: Wallet, enabled: true },
      { id: "transaction-categories", title: "Plano Financeiro", description: "Categorias de receitas e despesas da empresa", icon: Tags, enabled: true },
      { id: "financial-accounts", title: "Contas Financeiras", description: "Caixas, bancos e carteiras da empresa", icon: Landmark, enabled: true },
    ],
  },
  {
    label: "SISTEMA",
    items: [
      { id: "my-account", title: "Minha Conta", description: "Seu nome, telefone e WhatsApp pessoal", icon: UserCircle, enabled: true },
      { id: "security", title: "Segurança", description: "Senha, sessões e verificação", icon: Shield, enabled: true },
      { id: "appearance", title: "Aparência", description: "Tema e personalização", icon: Palette, enabled: true },
      { id: "notifications", title: "Notificações", description: "Configure alertas e lembretes", icon: Bell, enabled: true },
    ],
  },
];

export default function Configuracoes() {
  const [currentView, setCurrentView] = useState<SettingsView>("main");
  const [searchParams] = useSearchParams();
  const { refetch } = useSubscription();

  useEffect(() => {
    const view = searchParams.get("view");
    if (view && view !== "main") {
      setCurrentView(view as SettingsView);
    }

    const subscriptionStatus = searchParams.get("subscription");
    if (subscriptionStatus === "success") {
      toast({ title: "Assinatura ativada!", description: "Bem-vindo ao TechFlow PRO! Aproveite todos os benefícios." });
      refetch();
    } else if (subscriptionStatus === "cancelled") {
      toast({ title: "Assinatura cancelada", description: "Você pode tentar novamente a qualquer momento." });
    }
  }, [searchParams, refetch]);

  const handleSettingClick = (id: SettingsView, enabled: boolean) => {
    if (!enabled) return;
    if (id !== "main") setCurrentView(id);
  };

  const viewComponents: Record<Exclude<SettingsView, "main">, React.ReactNode> = {
    profile: <ProfileSettings onBack={() => setCurrentView("main")} />,
    "my-account": <MyAccountSettings onBack={() => setCurrentView("main")} />,
    team: <TeamSettings onBack={() => setCurrentView("main")} />,
    signature: <SignatureSettings onBack={() => setCurrentView("main")} />,
    subscription: <SubscriptionSettings onBack={() => setCurrentView("main")} />,
    "payment-methods": <PaymentMethodsSettings onBack={() => setCurrentView("main")} />,
    "transaction-categories": <TransactionCategoriesSettings onBack={() => setCurrentView("main")} />,
    appearance: <AppearanceSettings onBack={() => setCurrentView("main")} />,
    security: <SecuritySettings onBack={() => setCurrentView("main")} />,
    "financial-accounts": <FinancialAccountsSettings onBack={() => setCurrentView("main")} />,
    "operational-capacity": <OperationalCapacitySettings onBack={() => setCurrentView("main")} />,
    notifications: <NotificationSettings onBack={() => setCurrentView("main")} />,
    "time-clock": <TimeClockSettings onBack={() => setCurrentView("main")} />,
    "client-portal": <ClientPortalSettings onBack={() => setCurrentView("main")} />,
  };

  if (currentView !== "main") {
    return (
      <AppLayout>
        {viewComponents[currentView]}
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="page-enter">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Configurações</h1>
        <p className="text-muted-foreground">Personalize sua experiência</p>
      </div>

      <div className="space-y-8 entrance-stagger">
        {settingsGroups.map((group) => (
          <div key={group.label}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {group.items.map((item) => (
                <button
                  key={item.id + item.title}
                  onClick={() => handleSettingClick(item.id, item.enabled)}
                  disabled={!item.enabled}
                  className={`flex items-center gap-4 rounded-xl border border-border bg-card p-4 text-left shadow-card transition-all ${
                    item.enabled
                      ? "hover:shadow-card-hover hover:border-primary/50 cursor-pointer"
                      : "opacity-60 cursor-not-allowed"
                  }`}
                >
                  <div className="rounded-lg bg-primary/10 p-3">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-card-foreground">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  {!item.enabled && (
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">Em breve</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      </div>
    </AppLayout>
  );
}
