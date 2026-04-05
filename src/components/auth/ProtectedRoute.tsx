import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useSubscription } from "@/hooks/useSubscription";
import { useProfileSensitiveData } from "@/hooks/useProfileSensitiveData";
import { Loader2 } from "lucide-react";
import { getRoutePermission, STRUCTURAL_BLOCKED_ROUTES, matchAnyRoute, matchRoute } from "@/lib/routePermissions";

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

// Routes accessible without an active paid plan
const PLAN_EXEMPT_ROUTES = ["/planos", "/configuracoes"];

export function ProtectedRoute({ children, allowEmployee = false }: ProtectedRouteProps) {
  const { user, profile, isLoading: authLoading } = useAuth();
  const { isEmployee, isFieldWorker, isMember, isAdmin, isOwner, hasPermission, isLoading: roleLoading } = useUserRole();
  const { isOnboardingCompleted, isLoading: onboardingLoading } = useOnboarding();
  const { isFreePlan, isTrial, isTrialExpired, welcomeShown, hasTimeClock, hasWhatsAppFull, isLoading: subscriptionLoading } = useSubscription();
  const { sensitiveData, isLoading: sensitiveLoading } = useProfileSensitiveData();
  const location = useLocation();

  if (authLoading || roleLoading || onboardingLoading || subscriptionLoading || sensitiveLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Onboarding gate: new users must complete onboarding first
  // (employees and invited members skip onboarding)
  if (!isEmployee && !isOnboardingCompleted && location.pathname !== "/onboarding") {
    return <Navigate to="/onboarding" replace />;
  }

  // WhatsApp pessoal é opcional — não bloqueia acesso ao sistema.
  // Coleta posterior via WhatsAppPromptCard no dashboard.

  // Welcome page: Laura modal handles first-visit experience inside dashboard

  // Plan gate: redirect free users to /pricing
  if (!isEmployee && isFreePlan) {
    if (!matchAnyRoute(location.pathname, PLAN_EXEMPT_ROUTES)) {
      return <Navigate to="/planos" replace />;
    }
  }

  // Employee (Técnico de Rua): restricted routes
  if (isEmployee) {
    const isEmployeeRoute = matchAnyRoute(location.pathname, EMPLOYEE_ROUTES);

    if (!isFieldWorker && matchRoute(location.pathname, "/meu-dia")) {
      return <Navigate to="/comunicados" replace />;
    }

    if (!isEmployeeRoute && !allowEmployee) {
      return <Navigate to={isFieldWorker ? "/meu-dia" : "/comunicados"} replace />;
    }
  }

  // "Meu Dia" is now accessible to all authenticated non-employee users

  // Member (Atendente): check structural blocks first, then permission-based access
  if (isMember) {
    if (matchAnyRoute(location.pathname, STRUCTURAL_BLOCKED_ROUTES)) {
      return <Navigate to="/dashboard" replace />;
    }

    const requiredPermission = getRoutePermission(location.pathname);
    if (requiredPermission && !hasPermission(requiredPermission)) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Block WhatsApp routes for plans without WhatsApp (Start plan)
  if (matchAnyRoute(location.pathname, WHATSAPP_ROUTES) && !hasWhatsAppFull) {
    return <Navigate to="/planos" replace />;
  }

  // Block recurrence routes for plans without recurrence (Start plan)
  if (matchAnyRoute(location.pathname, RECURRENCE_ROUTES) && !hasWhatsAppFull) {
    return <Navigate to="/planos" replace />;
  }

  // Block ponto routes for non-Empresa plans
  if (matchAnyRoute(location.pathname, EMPRESA_ONLY_ROUTES) && !hasTimeClock) {
    return <Navigate to="/planos" replace />;
  }

  return <>{children}</>;
}
