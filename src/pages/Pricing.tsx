import { useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { buildCheckoutSuccessPath, saveCheckoutContext } from "@/lib/checkoutReturn";
import { trackFBEvent } from "@/lib/fbPixel";
import { Check, X, Crown, Star, Zap, Gift, LogOut, Loader2 } from "lucide-react";
import { PAID_PLANS, PLAN_CONFIG } from "@/lib/planConfig";
import type { PlanSlug } from "@/lib/planConfig";

const ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="h-4 w-4 text-primary" />,
  essential: <Star className="h-4 w-4 text-primary" />,
  pro: <Crown className="h-4 w-4 text-primary" />,
};

const PLAN_ORDER: Record<PlanSlug, number> = { free: 0, teste: 0, starter: 1, essential: 2, pro: 3 };

export default function Pricing() {
  const { user, signOut } = useAuth();
  const { plan, isFreePlan, isTrial, isTrialExpired, isLoading } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const hasPaidPlan = !isFreePlan && !isTrial && !isTrialExpired;

  if (!isLoading && !isFreePlan && !isTrial && !isTrialExpired) {
    if (plan === "pro") {
      return <Navigate to="/dashboard" replace />;
    }
  }

  const handleSelectPlan = async (planId: string, useStripe = false) => {
    setLoadingPlan(planId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ variant: "destructive", title: "Sessão expirada", description: "Faça login novamente para continuar." });
        setLoadingPlan(null);
        return;
      }

      const fnName = "stripe-create-checkout";
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { plan: planId },
      });

      if (error) throw error;

      if (data?.url) {
        const planPrice = PLAN_CONFIG[planId]?.pricePerMonth ?? 0;
        trackFBEvent("InitiateCheckout", { content_name: planId, currency: "BRL", value: planPrice });
        saveCheckoutContext({ plan: planId, returnTo: buildCheckoutSuccessPath(planId) });
        window.open(data.url, "_blank");
        window.dispatchEvent(new CustomEvent("tecvo:checkout-started", { detail: { plan: planId } }));
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao iniciar checkout",
        description: (error as Error).message,
      });
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-primary">Tecvo</h1>
          <Button variant="ghost" size="sm" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Sair
          </Button>
        </div>

        {/* Title */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            {hasPaidPlan ? "Gerencie seu plano" : "Escolha seu plano para continuar"}
          </h2>
          <p className="text-lg text-muted-foreground">
            {hasPaidPlan
              ? "Você pode fazer upgrade para ter acesso a mais recursos."
              : "Teste grátis por 7 dias. Sem cobrança imediata. Cancele a qualquer momento."}
          </p>
          {!hasPaidPlan && (
            <Badge variant="secondary" className="mt-4">
              <Gift className="h-3 w-3 mr-1" />
              7 dias de teste grátis em todos os planos
            </Badge>
          )}
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {PAID_PLANS.map((p) => {
            const isCurrentPlan = plan === p.slug;
            const currentOrder = PLAN_ORDER[plan];
            const cardOrder = PLAN_ORDER[p.slug];
            const isUpgrade = cardOrder > currentOrder;
            const isDowngrade = cardOrder < currentOrder && hasPaidPlan;

            let buttonLabel = p.cta;
            let buttonDisabled = false;
            let buttonVariant: "default" | "outline" = p.featured ? "default" : "outline";

            if (hasPaidPlan) {
              if (isCurrentPlan) {
                buttonLabel = "Plano atual";
                buttonDisabled = true;
                buttonVariant = "outline";
              } else if (isUpgrade) {
                buttonLabel = "Fazer upgrade";
                buttonVariant = "default";
              } else if (isDowngrade) {
                buttonLabel = "—";
                buttonDisabled = true;
                buttonVariant = "outline";
              }
            }

            return (
              <Card
                key={p.slug}
                className={cn(
                  "relative overflow-hidden transition-all",
                  isCurrentPlan && hasPaidPlan
                    ? "border-2 border-primary shadow-lg scale-105 md:scale-105"
                    : p.featured && !hasPaidPlan
                      ? "border-2 border-primary shadow-lg scale-105 md:scale-105"
                      : "hover:shadow-md"
                )}
              >
                {isCurrentPlan && hasPaidPlan && (
                  <div className="absolute top-0 left-0">
                    <div className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-br-lg flex items-center gap-1">
                      <Check className="h-3 w-3" />
                      Plano Atual
                    </div>
                  </div>
                )}
                {!isCurrentPlan && p.featured && !hasPaidPlan && (
                  <div className="absolute top-0 left-0">
                    <div className="bg-primary text-primary-foreground px-3 py-1 text-xs font-medium rounded-br-lg flex items-center gap-1">
                      <Star className="h-3 w-3" />
                      Mais Popular
                    </div>
                  </div>
                )}
                <CardHeader className="pb-4 pt-8">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {ICONS[p.slug]}
                    {p.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{p.description}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold text-foreground">{p.price}</span>
                    <span className="text-muted-foreground text-sm">{p.period}</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2.5 mb-6">
                    {p.features.map((feature) => (
                      <li key={feature.text} className="flex items-center gap-2.5">
                        {feature.included ? (
                          <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/40 flex-shrink-0" />
                        )}
                        <span
                          className={cn(
                            "text-sm",
                            feature.included ? "text-foreground" : "text-muted-foreground"
                          )}
                        >
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={buttonVariant}
                    className={cn(
                      "w-full",
                      buttonVariant === "default" && "bg-primary hover:bg-primary/90"
                    )}
                    onClick={() => handleSelectPlan(p.slug, false)}
                    disabled={!!loadingPlan || buttonDisabled}
                  >
                    {loadingPlan === p.slug ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Preparando...
                      </>
                    ) : (
                      buttonLabel
                    )}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          {hasPaidPlan
            ? "Cancele a qualquer momento."
            : "Sem cobrança nos primeiros 7 dias. Cancele a qualquer momento."}
        </p>

        <div className="flex justify-center gap-4 mt-4 flex-wrap">
          <Link to="/termos-de-uso" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Termos de Uso
          </Link>
          <Link to="/politica-de-privacidade" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Política de Privacidade
          </Link>
          <Link to="/lgpd" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            LGPD
          </Link>
        </div>
      </div>
    </div>
  );
}
