import { useState } from "react";
import { analytics } from "@/lib/analytics";
import { trackFBEvent } from "@/lib/fbPixel";
import { Crown, Check, Loader2, ExternalLink, Ticket, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { PLAN_CONFIG } from "@/lib/planConfig";
import { buildCheckoutSuccessPath, saveCheckoutContext } from "@/lib/checkoutReturn";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  servicesUsed?: number;
  servicesLimit?: number;
}

const NEXT_PLAN_BENEFITS: Record<string, string[]> = {
  starter: [
    "WhatsApp completo com conversas e etiquetas",
    "Chatbots simples",
    "Relatórios avançados",
    "Até 5 usuários",
    "Clientes e OS ilimitadas",
  ],
  essential: [
    "Usuários ilimitados",
    "Múltiplos números de WhatsApp",
    "Automação avançada",
    "Gestão de equipe e permissões",
    "Suporte prioritário",
  ],
  pro: [
    "Você já está no plano mais completo!",
  ],
};

interface CouponInfo {
  valid: boolean;
  coupon_type: string;
  discount_percent: number;
  ai_credits_amount: number;
  stripe_coupon_id: string | null;
  code: string;
}

export function UpgradeModal({ open, onOpenChange, servicesUsed = 15, servicesLimit = 15 }: UpgradeModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
  const [couponInfo, setCouponInfo] = useState<CouponInfo | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  const getNextPlan = () => {
    if (servicesLimit <= 10) return "starter";
    if (servicesLimit <= 30) return "essential";
    return "pro";
  };

  const nextPlan = getNextPlan();
  const nextPlanConfig = PLAN_CONFIG[nextPlan as keyof typeof PLAN_CONFIG];
  const benefits = NEXT_PLAN_BENEFITS[nextPlan] || NEXT_PLAN_BENEFITS.essential;

  const validateCoupon = async () => {
    if (!couponCode.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    setCouponInfo(null);

    try {
      const { data, error } = await supabase.functions.invoke("coupon-validate", {
        body: { code: couponCode.trim(), plan: nextPlan },
      });
      if (error) throw error;
      if (data?.error) {
        setCouponError(data.error);
        return;
      }
      if (data?.valid) {
        setCouponInfo(data);
        toast({ title: "Cupom aplicado!", description: getCouponDescription(data) });
      }
    } catch (err) {
      setCouponError((err as Error).message || "Erro ao validar cupom");
    } finally {
      setCouponLoading(false);
    }
  };

  const getCouponDescription = (info: CouponInfo) => {
    const parts: string[] = [];
    if (info.discount_percent > 0) parts.push(`${info.discount_percent}% de desconto`);
    if (info.ai_credits_amount > 0) parts.push(`+${info.ai_credits_amount} créditos IA`);
    return parts.join(" + ");
  };

  const removeCoupon = () => {
    setCouponInfo(null);
    setCouponCode("");
    setCouponError("");
  };

  const getDiscountedPrice = () => {
    if (!nextPlanConfig || !couponInfo?.discount_percent) return null;
    const original = nextPlanConfig.pricePerMonth;
    const discounted = original * (1 - couponInfo.discount_percent / 100);
    return `R$ ${Math.round(discounted)}`;
  };

  const handleUpgrade = async () => {
    setIsLoading(true);
    try {
      const body: any = { plan: nextPlan };
      if (couponInfo?.stripe_coupon_id) {
        body.coupon_id = couponInfo.stripe_coupon_id;
      }
      if (couponInfo) {
        body.coupon_code = couponInfo.code;
      }

      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body,
      });
      if (error) throw error;

      if (data?.url) {
        analytics.track("payment_initiated", null, null, {
          plan: nextPlan,
          page_section: "upgrade_modal",
          button_label: "Fazer upgrade",
          interaction_type: "click",
          coupon: couponInfo?.code || null,
        });
        const planPrice = PLAN_CONFIG[nextPlan]?.pricePerMonth ?? 0;
        trackFBEvent("InitiateCheckout", { content_name: nextPlan, currency: "BRL", value: planPrice });
        saveCheckoutContext({ plan: nextPlan, returnTo: buildCheckoutSuccessPath(nextPlan) });
        window.open(data.url, "_blank");
        window.dispatchEvent(new CustomEvent("tecvo:checkout-started", { detail: { plan: nextPlan } }));
        onOpenChange(false);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao iniciar pagamento",
        description: (error as Error).message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Limite de Serviços Atingido</DialogTitle>
          <DialogDescription className="text-base">
            Você já criou {servicesUsed} de {servicesLimit} serviços este mês.
            Faça upgrade para continuar crescendo!
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-4">
          {nextPlanConfig && (
            <div className="rounded-lg border-2 border-primary bg-primary/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-bold text-primary">Plano {nextPlanConfig.name}</span>
                <div className="text-right">
                  {couponInfo?.discount_percent ? (
                    <>
                      <span className="text-sm line-through text-muted-foreground mr-1">
                        {nextPlanConfig.price}
                      </span>
                      <span className="text-2xl font-bold text-green-600">
                        {getDiscountedPrice()}
                      </span>
                    </>
                  ) : (
                    <span className="text-2xl font-bold">{nextPlanConfig.price}</span>
                  )}
                  <span className="text-sm font-normal text-muted-foreground">{nextPlanConfig.period}</span>
                </div>
              </div>

              <ul className="space-y-2">
                {benefits.map((benefit) => (
                  <li key={benefit} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" />
                    <span>{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coupon Section */}
          <div className="space-y-2">
            {couponInfo ? (
              <div className="flex items-center justify-between rounded-lg border border-green-500/30 bg-green-50 dark:bg-green-950/20 px-3 py-2">
                <div className="flex items-center gap-2 text-sm">
                  <Ticket className="h-4 w-4 text-green-600" />
                  <span className="font-mono font-semibold text-green-700 dark:text-green-400">
                    {couponInfo.code}
                  </span>
                  <span className="text-green-600 dark:text-green-400">
                    — {getCouponDescription(couponInfo)}
                  </span>
                </div>
                <button onClick={removeCoupon} className="text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  value={couponCode}
                  onChange={(e) => {
                    setCouponCode(e.target.value.toUpperCase());
                    setCouponError("");
                  }}
                  placeholder="Cupom de desconto"
                  className="font-mono text-sm"
                  onKeyDown={(e) => e.key === "Enter" && validateCoupon()}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={validateCoupon}
                  disabled={couponLoading || !couponCode.trim()}
                  className="shrink-0"
                >
                  {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aplicar"}
                </Button>
              </div>
            )}
            {couponError && (
              <p className="text-xs text-destructive">{couponError}</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={handleUpgrade} disabled={isLoading} className="w-full gap-2">
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              {isLoading ? "Carregando..." : "Assinar agora"}
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full">
              Agora não
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            Cancele a qualquer momento. Sem compromisso.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
