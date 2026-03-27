/**
 * Central formatting/translation layer for analytics events.
 * Converts raw event_type + metadata into human-readable Portuguese descriptions.
 */

interface EventMetadata {
  location?: string;
  action?: string;
  target?: string;
  plan?: string;
  button_label?: string;
  interaction_type?: string;
  page_section?: string;
  page_path?: string;
  page_title?: string;
  [key: string]: any;
}

const LOCATION_LABELS: Record<string, string> = {
  hero: "seção principal",
  header: "cabeçalho",
  pricing: "seção de preços",
  cta_section: "seção de chamada para ação",
  solution_section: "seção de soluções",
  footer: "rodapé",
  nav: "menu de navegação",
  mobile_menu: "menu mobile",
};

const NAV_TARGET_LABELS: Record<string, string> = {
  funcionalidades: "Funcionalidades",
  beneficios: "Benefícios",
  precos: "Preços",
  depoimentos: "Depoimentos",
  faq: "FAQ",
  contato: "Contato",
  sobre: "Sobre",
};

const PLAN_LABELS: Record<string, string> = {
  starter: "Starter",
  essential: "Essencial",
  pro: "Profissional",
  free: "Gratuito",
};

function getLocationLabel(location?: string): string {
  if (!location) return "";
  return LOCATION_LABELS[location] || location;
}

function getTargetLabel(target?: string): string {
  if (!target) return "";
  return NAV_TARGET_LABELS[target] || target;
}

function getPlanLabel(plan?: string): string {
  if (!plan) return "";
  return PLAN_LABELS[plan] || plan;
}

/**
 * Formats a raw analytics event into a friendly Portuguese description.
 */
export function formatEventDescription(eventType: string, metadata?: EventMetadata | null): string {
  const meta = (metadata || {}) as EventMetadata;

  // If we have a button_label (new enriched events), prefer it
  if (meta.button_label) {
    const loc = getLocationLabel(meta.location || meta.page_section);
    return `Clicou em "${meta.button_label}"${loc ? ` na ${loc}` : ""}`;
  }

  switch (eventType) {
    case "page_view":
    case "landing_page_view":
      return `Visualizou página`;

    case "create_account_click": {
      const loc = getLocationLabel(meta.location || meta.page_section);
      const plan = getPlanLabel(meta.plan);
      if (plan && loc) return `Clicou para começar no plano ${plan} (${loc})`;
      if (plan) return `Clicou para começar no plano ${plan}`;
      if (loc) return `Clicou no botão de cadastro na ${loc}`;
      return "Clicou no botão de cadastro";
    }

    case "interaction": {
      const action = meta.action;
      const target = meta.target;
      const loc = getLocationLabel(meta.location || meta.page_section);

      if (action === "nav_click" && target) {
        return `Clicou em "${getTargetLabel(target)}" no menu`;
      }
      if (action === "login_click") {
        return `Clicou em "Entrar"${loc ? ` no ${loc}` : ""}`;
      }
      if (action === "scroll" && meta.scroll_depth) {
        return `Scrollou até ${meta.scroll_depth}% da página`;
      }
      if (action && target) {
        return `Interagiu com "${getTargetLabel(target)}"${loc ? ` na ${loc}` : ""}`;
      }
      if (action) {
        return `Interação: ${action}${loc ? ` na ${loc}` : ""}`;
      }
      return "Interação na página";
    }

    case "signup_started":
      return "Iniciou o cadastro";

    case "signup_completed":
      return "Completou o cadastro ✅";

    case "payment_initiated":
      return "Iniciou pagamento";

    case "payment_completed":
      return "Pagamento concluído 🎉";

    case "login":
      return "Fez login";

    case "logout":
      return "Fez logout";

    default:
      return eventType.replace(/_/g, " ");
  }
}

/**
 * Returns an appropriate icon type string for the event.
 */
export function getEventIconType(eventType: string): "page" | "cta" | "interaction" | "conversion" | "default" {
  switch (eventType) {
    case "page_view":
    case "landing_page_view":
      return "page";
    case "create_account_click":
      return "cta";
    case "signup_started":
    case "signup_completed":
    case "payment_initiated":
    case "payment_completed":
      return "conversion";
    case "interaction":
      return "interaction";
    default:
      return "default";
  }
}
