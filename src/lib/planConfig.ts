// Single source of truth for plan configuration.
// All UI surfaces (landing, pricing, settings, auth, onboarding) and the
// checkout Edge Function MUST derive their values from this file.
//
// Slug mapping (internal → display):
//   starter   → Start
//   essential → Pro
//   pro       → Empresa

export type PlanSlug = "free" | "starter" | "essential" | "pro" | "teste";

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanConfig {
  slug: PlanSlug;
  name: string;
  price: string; // formatted e.g. "R$ 49"
  pricePerMonth: number; // numeric value e.g. 49
  period: string;
  
  description: string;
  servicesLimit: number; // Infinity for unlimited
  maxUsers: number; // Infinity for unlimited
  maxWhatsAppChannels: number; // max WhatsApp numbers allowed
  featured: boolean;
  cta: string;
  features: PlanFeature[];
  // capability flags
  hasAI: boolean;
  hasAdvancedAI: boolean;
  hasTeamManagement: boolean;
  hasWhatsAppFull: boolean;
  hasRecurrence: boolean;
  hasDigitalSignature: boolean;
  hasFinance: boolean;
  hasAdvancedFinance: boolean;
  hasCatalog: boolean;
  hasAgenda: boolean;
  hasPermissions: boolean;
  hasTimeClock: boolean;
  hasClientPortal: boolean;
  mpValue: number;
  aiFranchise: number; // monthly AI interactions included in plan
}

export const PLAN_CONFIG: Record<Exclude<PlanSlug, "free">, PlanConfig> = {
  teste: {
    slug: "teste",
    name: "Teste Interno",
    price: "R$ 1",
    pricePerMonth: 1,
    period: "/mês",
    description: "Plano interno para validação de billing. Não visível para clientes.",
    servicesLimit: 10,
    maxUsers: 1,
    maxWhatsAppChannels: 0,
    featured: false,
    cta: "Teste interno",
    features: [
      { text: "Plano de teste interno", included: true },
    ],
    hasAI: false,
    hasAdvancedAI: false,
    hasTeamManagement: false,
    hasWhatsAppFull: false,
    hasRecurrence: false,
    hasDigitalSignature: false,
    hasFinance: true,
    hasAdvancedFinance: false,
    hasCatalog: true,
    hasAgenda: true,
    hasPermissions: false,
    hasTimeClock: false,
    hasClientPortal: true,
    mpValue: 1,
    aiFranchise: 0,
  },
  starter: {
    slug: "starter",
    name: "Start",
    price: "R$ 49",
    pricePerMonth: 49,
    period: "/mês",
    
    description: "Para técnicos que querem organizar serviços, clientes e finanças.",
    servicesLimit: Infinity,
    maxUsers: 1,
    maxWhatsAppChannels: 0,
    featured: false,
    cta: "Começar por R$1",
    features: [
      { text: "Agenda de serviços", included: true },
      { text: "Clientes", included: true },
      { text: "OS + PDF", included: true },
      { text: "Orçamentos", included: true },
      { text: "Financeiro", included: true },
      { text: "Portal do cliente", included: true },
      { text: "1 usuário", included: true },
      { text: "WhatsApp completo", included: false },
      { text: "IA e automação", included: false },
      { text: "Gestão de equipe e permissões", included: false },
    ],
    hasAI: false,
    hasAdvancedAI: false,
    hasTeamManagement: false,
    hasWhatsAppFull: false,
    hasRecurrence: false,
    hasDigitalSignature: false,
    hasFinance: true,
    hasAdvancedFinance: false,
    hasCatalog: true,
    hasAgenda: true,
    hasPermissions: false,
    hasTimeClock: false,
    hasClientPortal: true,
    mpValue: 49,
    aiFranchise: 0, // starter não inclui IA
  },
  essential: {
    slug: "essential",
    name: "Pro",
    price: "R$ 119",
    pricePerMonth: 119,
    period: "/mês",
    
    description: "Para técnicos que atendem clientes pelo WhatsApp e querem crescer.",
    servicesLimit: Infinity,
    maxUsers: 3,
    maxWhatsAppChannels: 2,
    featured: true,
    cta: "Começar por R$1",
    features: [
      { text: "Tudo do plano Start", included: true },
      { text: "WhatsApp completo (Inbox)", included: true },
      { text: "Chatbot", included: true },
      { text: "IA no atendimento", included: true },
      { text: "Recorrência automática", included: true },
      { text: "Relatórios de conversão", included: true },
      { text: "Assinatura digital", included: true },
      { text: "Até 3 usuários", included: true },
      { text: "Até 2 números de WhatsApp", included: true },
      { text: "Gestão de equipe e controle de ponto", included: false },
    ],
    hasAI: true,
    hasAdvancedAI: false,
    hasTeamManagement: false,
    hasWhatsAppFull: true,
    hasRecurrence: true,
    hasDigitalSignature: true,
    hasFinance: true,
    hasAdvancedFinance: false,
    hasCatalog: true,
    hasAgenda: true,
    hasPermissions: false,
    hasTimeClock: false,
    hasClientPortal: true,
    mpValue: 119,
    aiFranchise: 800, // ~800 interações/mês
  },
  pro: {
    slug: "pro",
    name: "Empresa",
    price: "R$ 229",
    pricePerMonth: 229,
    period: "/mês",
    
    description: "Para empresas com equipe que precisam de controle total.",
    servicesLimit: Infinity,
    maxUsers: Infinity,
    maxWhatsAppChannels: 5,
    featured: false,
    cta: "Começar por R$1",
    features: [
      { text: "Tudo do plano Pro", included: true },
      { text: "Usuários ilimitados", included: true },
      { text: "Até 5 números de WhatsApp", included: true },
      { text: "Gestão de equipe", included: true },
      { text: "Controle de ponto", included: true },
      { text: "Permissões por função", included: true },
      { text: "Financeiro avançado", included: true },
      { text: "Relatórios avançados", included: true },
      { text: "Suporte prioritário", included: true },
    ],
    hasAI: true,
    hasAdvancedAI: true,
    hasTeamManagement: true,
    hasWhatsAppFull: true,
    hasRecurrence: true,
    hasDigitalSignature: true,
    hasFinance: true,
    hasAdvancedFinance: true,
    hasCatalog: true,
    hasAgenda: true,
    hasPermissions: true,
    hasTimeClock: true,
    hasClientPortal: true,
    mpValue: 229,
  },
};

// Free plan info (not sellable, used only for display)
export const FREE_PLAN_INFO = {
  slug: "free" as const,
  name: "Gratuito",
  price: "R$ 0",
  servicesLimit: 10,
  maxUsers: 1,
  limitLabel: "10 serviços/mês",
};

// Helper: get plan display info by slug (including free)
export function getPlanDisplayInfo(slug: PlanSlug) {
  if (slug === "free") {
    return {
      name: FREE_PLAN_INFO.name,
      price: FREE_PLAN_INFO.price,
      limitLabel: FREE_PLAN_INFO.limitLabel,
    };
  }
  const plan = PLAN_CONFIG[slug];
  return {
    name: plan.name,
    price: plan.price,
    limitLabel: plan.servicesLimit === Infinity
      ? "Serviços ilimitados"
      : `${plan.servicesLimit} serviços/mês`,
  };
}

// All paid plans as ordered array (for rendering grids)
export const PAID_PLANS = [
  PLAN_CONFIG.starter,
  PLAN_CONFIG.essential,
  PLAN_CONFIG.pro,
] as const;
