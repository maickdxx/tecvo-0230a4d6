import { Link } from "react-router-dom";
import { analytics } from "@/lib/analytics";
import { Check, X, ArrowRight, Star, Crown, Zap, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PAID_PLANS } from "@/lib/planConfig";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const ICONS: Record<string, React.ReactNode> = {
  starter: <Zap className="h-5 w-5" />,
  essential: <Sparkles className="h-5 w-5" />,
  pro: <Crown className="h-5 w-5" />,
};

const PLAN_TAGLINE: Record<string, string> = {
  starter: "Ideal para técnico autônomo",
  essential: "Para quem quer crescer com IA e WhatsApp",
  pro: "Controle total para empresas com equipe",
};

export function PricingSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="planos" className="py-20 md:py-28 scroll-mt-16 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_30%,hsl(var(--primary)/0.06),transparent)]" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        {/* Header */}
        <div
          className={cn(
            "max-w-3xl mx-auto text-center mb-14 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5 border border-primary/15">
            Planos simples, sem surpresa
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Quanto custa organizar{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
              sua empresa?
            </span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
            Menos que um serviço de manutenção por mês. Comece por apenas R$1 no primeiro mês.
          </p>
        </div>

        {/* Plans grid */}
        <div className="grid md:grid-cols-3 gap-5 lg:gap-6 max-w-5xl mx-auto items-start mb-10">
          {PAID_PLANS.map((plan, i) => {
            const isFeatured = plan.featured;

            return (
              <div
                key={plan.slug}
                className={cn(
                  "group rounded-2xl flex flex-col transition-all duration-500 relative overflow-hidden",
                  isFeatured
                    ? "bg-card border-2 border-primary/40 shadow-[0_16px_50px_-10px_hsl(var(--primary)/0.25)] ring-1 ring-primary/10 md:scale-[1.05] z-10"
                    : "bg-card border border-border/60 hover:shadow-elevated hover:-translate-y-1 hover:border-border",
                  isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
                style={{ transitionDelay: isVisible ? `${150 + i * 100}ms` : "0ms" }}
              >
                {/* Featured glow & badge */}
                {isFeatured && (
                  <>
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.06] via-primary/[0.02] to-transparent" />
                    <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-60 h-40 bg-primary/[0.08] rounded-full blur-[60px]" />
                    <div className="relative z-10 bg-primary text-primary-foreground text-xs font-bold px-4 py-2 text-center tracking-wide uppercase">
                      <div className="flex items-center justify-center gap-1.5">
                        <Star className="h-3.5 w-3.5 fill-primary-foreground" />
                        Mais escolhido
                        <Star className="h-3.5 w-3.5 fill-primary-foreground" />
                      </div>
                    </div>
                  </>
                )}

                <div className={cn("relative z-10 flex-1 flex flex-col", isFeatured ? "p-7 pt-6" : "p-7")}>
                  {/* Plan icon & name */}
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <div className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg",
                      isFeatured ? "bg-primary text-primary-foreground" : "bg-primary/[0.08] text-primary"
                    )}>
                      {ICONS[plan.slug]}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mb-5 ml-[46px]">{PLAN_TAGLINE[plan.slug]}</p>

                  {/* Price */}
                  <div className="mb-6 pb-6 border-b border-border/60">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-black text-foreground tracking-tight">{plan.price}</span>
                      <span className="text-sm text-muted-foreground font-medium">{plan.period}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">Cobrado mensalmente • Cancele quando quiser</p>
                    <p className="text-xs font-semibold text-primary mt-1.5">
                      🚀 Primeiro mês por apenas R$1
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((feature) => (
                      <li key={feature.text} className="flex items-start gap-2.5">
                        {feature.included ? (
                          <div className={cn(
                            "flex h-5 w-5 items-center justify-center rounded-full mt-0.5 shrink-0",
                            isFeatured ? "bg-primary/15" : "bg-primary/10"
                          )}>
                            <Check className="h-3 w-3 text-primary" />
                          </div>
                        ) : (
                          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-muted/80 mt-0.5 shrink-0">
                            <X className="h-3 w-3 text-muted-foreground/50" />
                          </div>
                        )}
                        <span className={cn(
                          "text-sm",
                          feature.included ? "text-foreground" : "text-muted-foreground/60"
                        )}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    variant={isFeatured ? "default" : "outline"}
                    size="lg"
                    className={cn(
                      "w-full py-6 text-base font-semibold hover:scale-[1.02] transition-all duration-200",
                        isFeatured && "shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.4)] hover:shadow-[0_12px_35px_-5px_hsl(var(--primary)/0.5)] relative overflow-hidden group/btn"
                      )}
                      onClick={() => analytics.track("create_account_click", null, null, { plan: plan.slug, location: "pricing", page_section: "pricing", button_label: plan.cta, interaction_type: "click" })}
                      asChild
                    >
                    <Link to={`/cadastro?plan=${plan.slug}`}>
                      {isFeatured && (
                        <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700" />
                      )}
                      {plan.cta}
                      <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom note */}
        <div className={cn(
          "text-center space-y-2 transition-all duration-700",
          isVisible ? "opacity-100 translate-y-0 delay-500" : "opacity-0 translate-y-6"
        )}>
          <p className="text-sm text-muted-foreground">
            Todos os planos começam por <strong className="text-foreground">R$1 no primeiro mês</strong>. Cancele a qualquer momento.
          </p>
          <p className="text-xs text-muted-foreground">
            Precisa de mais números de WhatsApp? Adicione por <strong className="text-foreground">R$ 25/mês</strong> cada.
          </p>
        </div>
      </div>
    </section>
  );
}