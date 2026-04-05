import { useState, useRef } from "react";
import { analytics } from "@/lib/analytics";
import { trackFBEvent } from "@/lib/fbPixel";
import { ArrowLeft, Crown, Check, Loader2, ExternalLink, Settings2, Star, Zap, Gift, AlertTriangle, CreditCard, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { buildCheckoutSuccessPath, saveCheckoutContext } from "@/lib/checkoutReturn";
import { getPlanDisplayInfo, PLAN_CONFIG } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface SubscriptionSettingsProps {
  onBack: () => void;
}

const PLAN_BENEFITS: Record<Exclude<PlanSlug, "free">, string[]> = {
  teste: PLAN_CONFIG.teste.features.filter(f => f.included).map(f => f.text),
  starter: PLAN_CONFIG.starter.features.filter(f => f.included).map(f => f.text),
  essential: PLAN_CONFIG.essential.features.filter(f => f.included).map(f => f.text),
  pro: PLAN_CONFIG.pro.features.filter(f => f.included).map(f => f.text),
};

const PLAN_ORDER: Record<PlanSlug, number> = { free: 0, teste: 0, starter: 1, essential: 2, pro: 3 };

export function SubscriptionSettings({ onBack }: SubscriptionSettingsProps) {
  const {
    plan,
    isFreePlan,
    isStarterPlan,
    isEssentialPlan,
    isProPlan,
    isTrial,
    isTrialExpired,
    servicesUsed,
    servicesLimit,
    usagePercentage,
    planExpiresAt,
    isCancelledAtPeriodEnd,
    daysUntilExpiration,
    hasActiveStripeSubscription,
    isPastDue,
    isPastDueGraceExpired,
    pastDueDaysLeft,
    subscriptionStatus,
    refetch
  } = useSubscription();
  const { organizationId } = useAuth();

  const [isLoadingCheckout, setIsLoadingCheckout] = useState<string | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const plansRef = useRef<HTMLDivElement>(null);

  const hasPaidPlan = !isFreePlan && !isTrial && !isTrialExpired;

  const handleUpgrade = async (targetPlan: "starter" | "essential" | "pro") => {
    setIsLoadingCheckout(targetPlan);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: "destructive", title: "Sessão expirada", description: "Faça login novamente para continuar." });
        setIsLoadingCheckout(null);
        return;
      }

      if (hasActiveStripeSubscription) {
        const { data, error } = await supabase.functions.invoke("stripe-change-plan", {
          body: { plan: targetPlan },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast({
          title: data.is_upgrade ? "Upgrade realizado!" : "Plano alterado!",
          description: data.is_upgrade
            ? `Seu plano foi atualizado para ${PLAN_CONFIG[targetPlan].name}. A diferença será cobrada proporcionalmente.`
            : `Seu plano foi alterado para ${PLAN_CONFIG[targetPlan].name}.`,
        });
        await refetch();
      } else {
        const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
          body: { plan: targetPlan },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.url) {
          analytics.track("payment_initiated", null, null, { plan: targetPlan, page_section: "settings", button_label: "Assinar plano", interaction_type: "click" });
          const planPrice = PLAN_CONFIG[targetPlan]?.pricePerMonth ?? 0;
          trackFBEvent("InitiateCheckout", { content_name: targetPlan, currency: "BRL", value: planPrice });
          saveCheckoutContext({ plan: targetPlan, returnTo: buildCheckoutSuccessPath(targetPlan) });
          window.open(data.url, "_blank");
          window.dispatchEvent(new CustomEvent("tecvo:checkout-started", { detail: { plan: targetPlan } }));
        }
      }
    } catch (error) {
      const msg = (error as Error).message;
      toast({
        variant: "destructive",
        title: "Erro ao alterar plano",
        description: msg.includes("SAME_PLAN") ? "Você já está neste plano." : msg,
      });
    } finally {
      setIsLoadingCheckout(null);
    }
  };

  const handleManageSubscription = () => {
    plansRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleOpenPortal = async () => {
    setIsOpeningPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-customer-portal");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao abrir portal",
        description: (error as Error).message,
      });
    } finally {
      setIsOpeningPortal(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!organizationId) return;
    setIsCancelling(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-cancel-subscription");
      if (error) throw error;

      toast({
        title: "Cancelamento agendado",
        description: data?.current_period_end
          ? `Seu plano continua ativo até ${format(new Date(data.current_period_end), "dd/MM/yyyy")}. Após essa data, será encerrado automaticamente.`
          : "Seu plano será encerrado ao final do período.",
      });
      await refetch();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao cancelar",
        description: (error as Error).message,
      });
    } finally {
      setIsCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const handleRefreshStatus = async () => {
    await refetch();
    toast({
      title: "Status atualizado",
      description: "O status da sua assinatura foi verificado",
    });
  };

  const currentPlanInfo = getPlanDisplayInfo(plan);
  const currentPlanPrice = plan !== "free" ? PLAN_CONFIG[plan as Exclude<PlanSlug, "free">] : null;

  const getButtonProps = (cardPlan: Exclude<PlanSlug, "free">) => {
    const cardOrder = PLAN_ORDER[cardPlan];
    const currentOrder = PLAN_ORDER[plan];

    if (hasPaidPlan && cardPlan === plan) {
      return { label: "Plano atual", disabled: true, variant: "outline" as const };
    }
    if (hasPaidPlan && cardOrder > currentOrder) {
      return { label: "Fazer upgrade", disabled: false, variant: "default" as const };
    }
    if (hasPaidPlan && cardOrder < currentOrder) {
      return { label: "Fazer downgrade", disabled: false, variant: "outline" as const };
    }
    if (isTrial && cardPlan === plan) {
      return { label: "Plano atual (trial)", disabled: true, variant: "outline" as const };
    }
    if (isTrial && cardOrder > currentOrder) {
      return { label: "Fazer upgrade", disabled: false, variant: "default" as const };
    }
    return { label: "Começar agora", disabled: false, variant: cardPlan === "essential" ? "default" as const : "outline" as const };
  };

  const showCard = (cardPlan: Exclude<PlanSlug, "free">) => {
    return true; // Show all plans so user can upgrade or downgrade
  };

  // Status label for display
  const getStatusBadge = () => {
    if (isPastDue) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Pagamento pendente
        </Badge>
      );
    }
    if (isCancelledAtPeriodEnd) {
      return (
        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
          <Clock className="h-3 w-3 mr-1" />
          Cancelamento agendado
        </Badge>
      );
    }
    if (subscriptionStatus === "active") {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
          Ativo
        </Badge>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planos</h1>
          <p className="text-muted-foreground">Gerencie sua assinatura</p>
        </div>
      </div>

      {/* Past Due Warning */}
      {isPastDue && (
        <Card className="border-red-200 bg-red-50/50">
          <CardContent className="pt-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">
                  Pagamento pendente
                </p>
                <p className="text-red-700 text-sm mt-1">
                  {isPastDueGraceExpired
                    ? "Seu acesso premium foi suspenso por inadimplência. Atualize seu método de pagamento para restaurar o acesso."
                    : `Há um problema com seu pagamento. Você tem ${pastDueDaysLeft} dia${pastDueDaysLeft !== 1 ? "s" : ""} para regularizar antes de perder o acesso premium.`}
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3 border-red-300 text-red-700 hover:bg-red-100"
                  onClick={handleOpenPortal}
                  disabled={isOpeningPortal}
                >
                  {isOpeningPortal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  Atualizar pagamento
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current Plan Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Seu Plano Atual
            {isProPlan && <Crown className="h-5 w-5 text-primary" />}
            {isEssentialPlan && <Star className="h-5 w-5 text-primary" />}
            {isStarterPlan && <Zap className="h-5 w-5 text-primary" />}
            {getStatusBadge()}
          </CardTitle>
          <CardDescription>
            {isFreePlan 
              ? "Você está no plano gratuito" 
              : isCancelledAtPeriodEnd && planExpiresAt
                ? `Cancelamento agendado. Acesso até ${format(planExpiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })} (${daysUntilExpiration} dias restantes)`
                : `Seu plano ${currentPlanInfo.name} ${planExpiresAt ? `renova em ${format(planExpiresAt, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}` : ""}`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className={cn(
              "rounded-lg px-4 py-2 font-bold",
              isFreePlan && "bg-muted text-muted-foreground",
              isStarterPlan && "bg-primary/10 text-primary",
              isEssentialPlan && "bg-primary/20 text-primary",
              isProPlan && "bg-primary text-primary-foreground"
            )}>
              {currentPlanInfo.name.toUpperCase()}
            </div>
            <span className="text-sm text-muted-foreground">{currentPlanInfo.limitLabel}</span>
          </div>

          {currentPlanPrice && (
            <div className="flex flex-col gap-1 text-sm">
              <span className="text-muted-foreground">
                Valor: <span className="font-semibold text-foreground">{currentPlanPrice.price}{currentPlanPrice.period}</span>
              </span>
              {planExpiresAt && (
                <span className="text-muted-foreground">
                  {isCancelledAtPeriodEnd ? "Acesso até" : "Próxima cobrança"}: <span className="font-semibold text-foreground">{format(planExpiresAt, "dd/MM/yyyy")}</span>
                  {isCancelledAtPeriodEnd && <span className="ml-1 text-amber-600">({daysUntilExpiration} dias restantes)</span>}
                </span>
              )}
            </div>
          )}

          {!isProPlan && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviços este mês</span>
                <span className="font-medium">{servicesUsed} / {servicesLimit}</span>
              </div>
              <Progress value={usagePercentage} className="h-2" />
              {usagePercentage >= 80 && (
                <p className="text-sm text-amber-600">
                  ⚠️ Você está se aproximando do limite mensal
                </p>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 flex-wrap">
            {hasPaidPlan && (
              <>
                <Button variant="outline" size="sm" onClick={handleOpenPortal} disabled={isOpeningPortal}>
                  {isOpeningPortal ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CreditCard className="h-4 w-4 mr-2" />}
                  Gerenciar pagamento
                </Button>
                <Button variant="outline" size="sm" onClick={handleManageSubscription}>
                  <Settings2 className="h-4 w-4 mr-2" />
                  Trocar plano
                </Button>
                {!isCancelledAtPeriodEnd && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setShowCancelDialog(true)}>
                    Cancelar assinatura
                  </Button>
                )}
              </>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefreshStatus}>
              Atualizar status
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Upgrade Options */}
      <div ref={plansRef} className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(["starter", "essential", "pro"] as const).filter(showCard).map((slug) => {
          const config = PLAN_CONFIG[slug];
          const btnProps = getButtonProps(slug);
          const isCurrentPlan = plan === slug;
          const showTrialBadge = false;

          return (
            <Card
              key={slug}
              className={cn(
                isCurrentPlan && hasPaidPlan && "border-2 border-primary",
                !isCurrentPlan && config.featured && !hasPaidPlan && "border-2 border-primary"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    {slug === "starter" && <Zap className="h-5 w-5 text-primary" />}
                    {slug === "essential" && <Star className="h-5 w-5 text-primary" />}
                    {slug === "pro" && <Crown className="h-5 w-5 text-primary" />}
                    {config.name}
                  </CardTitle>
                  <div className="text-right">
                    <span className="text-2xl font-bold">{config.price}</span>
                    <span className="text-muted-foreground text-sm">{config.period}</span>
                  </div>
                </div>
                <CardDescription className="flex items-center gap-2">
                  {config.description}
                  {showTrialBadge && (
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">
                      <Gift className="h-3 w-3 mr-1" />
                      7 dias grátis
                    </Badge>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-2">
                  {PLAN_BENEFITS[slug].map((benefit) => (
                    <li key={benefit} className="flex items-center gap-3">
                      <Check className="h-4 w-4 text-primary" />
                      <span className="text-sm">{benefit}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => !btnProps.disabled && handleUpgrade(slug)}
                  disabled={isLoadingCheckout !== null || btnProps.disabled}
                  className="w-full gap-2"
                  variant={btnProps.variant}
                >
                  {isLoadingCheckout === slug ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : !btnProps.disabled ? (
                    <ExternalLink className="h-4 w-4" />
                  ) : null}
                  {isLoadingCheckout === slug ? "Carregando..." : btnProps.label}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground">
        {hasPaidPlan
          ? "Cancele a qualquer momento."
          : "Sem cobrança nos primeiros 7 dias. Cancele a qualquer momento."}
      </p>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelar assinatura
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>Tem certeza que deseja cancelar sua assinatura do plano <strong>{currentPlanInfo.name}</strong>?</p>
              {planExpiresAt && (
                <p>Seu plano continuará ativo até <strong>{format(planExpiresAt, "dd/MM/yyyy")}</strong>. Após essa data, você será movido para o plano gratuito.</p>
              )}
              <p>Você perderá acesso aos recursos exclusivos do seu plano atual.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter plano</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelSubscription}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
