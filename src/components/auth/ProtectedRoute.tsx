import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useSubscription } from "@/hooks/useSubscription";
import { Loader2 } from "lucide-react";

// Routes that require the "Empresa" plan (hasTimeClock)
const EMPRESA_ONLY_ROUTES = ["/ponto", "/ponto-admin"];

// Routes that require WhatsApp (Pro+ plans)
const WHATSAPP_ROUTES = ["/whatsapp"];

// Routes that require recurrence/automation (Pro+ plans)
const RECURRENCE_ROUTES = ["/recorrencia"];

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowEmployee?: boolean;
}

// Routes employees (Técnico de Rua) can access
const EMPLOYEE_ROUTES = ["/meu-dia", "/ponto", "/historico-ponto", "/espelho-ponto", "/comunicados"];

// Routes field workers (any role) can additionally access
const FIELD_WORKER_ROUTES = ["/meu-dia"];

// Routes blocked for members (Atendente)
const MEMBER_BLOCKED_ROUTES = [
  "/financeiro",
  "/contas-pagar",
  "/contas-receber",
  "/financeiro/relatorios",
  "/financeiro/formas-pagamento",
  "/financeiro/categorias",
  "/financeiro/transferencias",
  "/fornecedores",
  "/lixeira",
  "/admin",
  "/ia/",
];

// Routes accessible without an active paid plan
const PLAN_EXEMPT_ROUTES = ["/planos", "/configuracoes"];

export function ProtectedRoute({ children, allowEmployee = false }: ProtectedRouteProps) {
  const { user, isLoading: authLoading } = useAuth();
  const { isEmployee, isFieldWorker, isMember, isAdmin, isOwner, isLoading: roleLoading } = useUserRole();
  const { isOnboardingCompleted, isLoading: onboardingLoading } = useOnboarding();
  const { isFreePlan, isTrial, isTrialExpired, welcomeShown, hasTimeClock, hasWhatsAppFull, isLoading: subscriptionLoading } = useSubscription();
  const location = useLocation();

  if (authLoading || roleLoading || onboardingLoading || subscriptionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Onboarding is no longer mandatory — user enters dashboard directly
  // Onboarding page (/onboarding) remains accessible for completing company data later

  // Welcome page: show once after plan activation
  if (!isEmployee && !welcomeShown && !isFreePlan && location.pathname !== "/assinatura/parabens") {
    return <Navigate to="/assinatura/parabens" replace />;
  }

  // Plan gate: redirect free users to /pricing ONLY if not on trial and trial is not expired
  if (!isEmployee && isFreePlan && !isTrial && !isTrialExpired) {
    const isExemptRoute = PLAN_EXEMPT_ROUTES.some(route =>
      location.pathname.startsWith(route)
    );
    if (!isExemptRoute) {
      return <Navigate to="/planos" replace />;
    }
  }

  // Employee (Técnico de Rua): only /meu-dia and /atualizacoes
  if (isEmployee) {
    const isEmployeeRoute = EMPLOYEE_ROUTES.some(route => 
      location.pathname.startsWith(route)
    );
    
    // If employee is NOT a field worker, block /meu-dia too
    if (!isFieldWorker && location.pathname.startsWith("/meu-dia")) {
      return <Navigate to="/comunicados" replace />;
    }
    
    if (!isEmployeeRoute && !allowEmployee) {
      return <Navigate to={isFieldWorker ? "/meu-dia" : "/comunicados"} replace />;
    }
  }

  // Non-employee trying to access /meu-dia without being a field worker (owners/admins always allowed)
  if (!isEmployee && !isFieldWorker && !isOwner && !isAdmin && location.pathname.startsWith("/meu-dia")) {
    return <Navigate to="/dashboard" replace />;
  }

  // Member (Atendente): block financial, admin, and AI routes
  if (isMember) {
    const isBlockedRoute = MEMBER_BLOCKED_ROUTES.some(route =>
      location.pathname.startsWith(route)
    );
    if (isBlockedRoute) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Block WhatsApp routes for plans without WhatsApp (Start plan)
  const isWhatsAppRoute = WHATSAPP_ROUTES.some(route =>
    location.pathname.startsWith(route)
  );
  if (isWhatsAppRoute && !hasWhatsAppFull) {
    return <Navigate to="/planos" replace />;
  }

  // Block recurrence routes for plans without recurrence (Start plan)
  const isRecurrenceRoute = RECURRENCE_ROUTES.some(route =>
    location.pathname.startsWith(route)
  );
  if (isRecurrenceRoute && !hasWhatsAppFull) {
    return <Navigate to="/planos" replace />;
  }

  // Block ponto routes for non-Empresa plans
  const isEmpresaOnlyRoute = EMPRESA_ONLY_ROUTES.some(route =>
    location.pathname.startsWith(route)
  );
  if (isEmpresaOnlyRoute && !hasTimeClock) {
    return <Navigate to="/planos" replace />;
  }

  return <>{children}</>;
}
