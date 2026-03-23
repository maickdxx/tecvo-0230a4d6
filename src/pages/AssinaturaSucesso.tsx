import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { PartyPopper, CheckCircle2, ArrowRight, Loader2, LogIn } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getPlanDisplayInfo, type PlanSlug } from "@/lib/planConfig";
import { buildCheckoutSuccessPath, clearCheckoutContext, saveCheckoutContext } from "@/lib/checkoutReturn";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const POLL_INTERVAL = 3000;
const POLL_MAX = 10 * 60 * 1000;
const VALID_PLANS = new Set<PlanSlug>(["teste", "starter", "essential", "pro"]);

export default function AssinaturaSucesso() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, organizationId, isLoading: authLoading } = useAuth();

  const rawPlan = searchParams.get("plan") as PlanSlug | null;
  const planSlug: PlanSlug = rawPlan && VALID_PLANS.has(rawPlan) ? rawPlan : "starter";
  const checkoutSessionId = searchParams.get("checkout_session_id");
  const returnPath = useMemo(
    () => buildCheckoutSuccessPath(planSlug, checkoutSessionId),
    [planSlug, checkoutSessionId],
  );

  const [isActive, setIsActive] = useState(false);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollStartRef = useRef(Date.now());

  useEffect(() => {
    saveCheckoutContext({
      plan: planSlug,
      checkoutSessionId,
      returnTo: returnPath,
    });
  }, [planSlug, checkoutSessionId, returnPath]);

  useEffect(() => {
    if (authLoading || !user) return;

    pollStartRef.current = Date.now();
    setChecking(true);

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const confirmSuccess = async (plan: string | null) => {
      setIsActive(true);
      setActivePlan(plan);
      setChecking(false);
      clearCheckoutContext();
      stopPolling();
      await queryClient.invalidateQueries({ queryKey: ["subscription"] });
      await queryClient.invalidateQueries({ queryKey: ["organization"] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
    };

    const check = async () => {
      try {
        if (organizationId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("plan, subscription_status, stripe_subscription_id")
            .eq("id", organizationId)
            .single();

          if (
            org &&
            org.plan &&
            org.plan !== "free" &&
            (org.subscription_status === "active" ||
              org.subscription_status === "trialing" ||
              !!org.stripe_subscription_id)
          ) {
            await confirmSuccess(org.plan);
            return;
          }
        }

        const { data, error } = await supabase.functions.invoke("check-subscription");
        if (!error && data?.subscribed && data?.plan && data.plan !== "free") {
          await confirmSuccess(data.plan);
          return;
        }
      } catch {
        // retry silently while polling
      }

      if (Date.now() - pollStartRef.current > POLL_MAX) {
        setChecking(false);
        stopPolling();
      }
    };

    check();
    pollRef.current = setInterval(check, POLL_INTERVAL);

    return () => stopPolling();
  }, [authLoading, organizationId, queryClient, user]);

  const displayPlan = (activePlan || planSlug) as PlanSlug;
  const planInfo = getPlanDisplayInfo(displayPlan);
  const loginHref = `/login?returnTo=${encodeURIComponent(returnPath)}`;

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <Card className="w-full border-border bg-card shadow-sm">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
              {authLoading || (user && checking) ? (
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              ) : isActive ? (
                <PartyPopper className="h-10 w-10 text-primary" />
              ) : (
                <LogIn className="h-10 w-10 text-primary" />
              )}
            </div>

            <div className="space-y-2">
              <CardTitle className="text-2xl font-bold text-foreground">
                {authLoading
                  ? "Restaurando sua sessão..."
                  : !user
                    ? "Seu pagamento foi recebido"
                    : checking
                      ? "Processando pagamento..."
                      : isActive
                        ? "Pagamento aprovado com sucesso 🎉"
                        : "Pagamento ainda em processamento"}
              </CardTitle>
              <CardDescription className="text-base text-muted-foreground">
                {authLoading
                  ? "Estamos reestabelecendo sua autenticação para concluir o retorno do checkout."
                  : !user
                    ? "Entre novamente para concluir a ativação da assinatura sem perder o contexto do checkout."
                    : checking
                      ? "Estamos validando sua assinatura e atualizando seu acesso automaticamente."
                      : isActive
                        ? `Seu plano ${planInfo.name} já está ativo e pronto para uso.`
                        : "O pagamento já voltou do checkout, mas a confirmação final ainda não apareceu. Você pode tentar novamente em instantes."}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            <div className="rounded-lg border border-border bg-background p-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Plano</span>
                <span className="font-semibold text-foreground">{planInfo.name}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Retorno do checkout</span>
                <span className="font-medium text-foreground">{checkoutSessionId ? "Recebido" : "Sem ID da sessão"}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-muted-foreground">Status</span>
                <span className="inline-flex items-center gap-2 font-medium text-foreground">
                  {authLoading || (user && checking) ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      Processando
                    </>
                  ) : isActive ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      Ativo
                    </>
                  ) : !user ? (
                    "Login necessário"
                  ) : (
                    "Aguardando confirmação"
                  )}
                </span>
              </div>
            </div>

            {!authLoading && !user && (
              <Button asChild size="lg" className="w-full gap-2">
                <Link to={loginHref}>
                  <LogIn className="h-4 w-4" />
                  Entrar para concluir ativação
                </Link>
              </Button>
            )}

            {!authLoading && user && !checking && !isActive && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="flex-1" onClick={() => window.location.reload()}>
                  Verificar novamente
                </Button>
                <Button variant="outline" size="lg" className="flex-1" onClick={() => navigate("/dashboard", { replace: true })}>
                  Ir para o dashboard
                </Button>
              </div>
            )}

            {!authLoading && user && isActive && (
              <Button
                size="lg"
                className="w-full gap-2"
                onClick={() => navigate("/dashboard", { replace: true })}
              >
                Ir para a plataforma
                <ArrowRight className="h-4 w-4" />
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
