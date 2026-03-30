import { Star, Quote } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const testimonials = [
  {
    quote: "Antes eu perdia 3 horas por dia organizando papel. Agora abro o Tecvo no celular e tá tudo lá — OS, agenda, financeiro. Mudou minha rotina.",
    author: "Carlos Silva",
    role: "Técnico autônomo, Campinas/SP",
    avatar: "CS",
    metric: "+3h livres por dia",
  },
  {
    quote: "Descobri que estava com 40% de serviço sem cobrar. Depois que passei a controlar pelo Tecvo, meu faturamento subiu no mesmo mês.",
    author: "Ana Costa",
    role: "Dona da RefriAr Climatização",
    avatar: "AC",
    metric: "+40% de faturamento",
  },
  {
    quote: "O WhatsApp integrado é absurdo. Todas as conversas organizadas num lugar só. Consigo responder cliente entre um serviço e outro sem perder nada.",
    author: "Roberto Mendes",
    role: "Empresa com 4 técnicos, BH/MG",
    avatar: "RM",
    metric: "2x mais clientes atendidos",
  },
];

const stats = [
  { value: "500+", label: "Empresas de climatização" },
  { value: "50k+", label: "Serviços gerenciados" },
  { value: "98%", label: "Recomendam o Tecvo" },
  { value: "4.9", label: "Nota de satisfação", icon: true },
];

export function SocialProof() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/20 via-background to-background" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        <div
          className={cn(
            "grid grid-cols-2 md:grid-cols-4 gap-6 max-w-3xl mx-auto mb-16 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-3xl md:text-4xl font-black text-foreground tracking-tight">{s.value}</span>
                {s.icon && <Star className="h-5 w-5 fill-warning text-warning" />}
              </div>
              <span className="text-sm text-muted-foreground mt-1 block">{s.label}</span>
            </div>
          ))}
        </div>

        <div
          className={cn(
            "max-w-3xl mx-auto text-center mb-12 transition-all duration-700 delay-100",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Quem usa, não volta pro papel
          </h2>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {testimonials.map((t, i) => (
            <div
              key={t.author}
              className={cn(
                "group relative bg-card rounded-2xl p-7 border border-border/60 overflow-hidden hover:shadow-card-hover hover:-translate-y-1 transition-all duration-500",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: isVisible ? `${200 + i * 80}ms` : "0ms" }}
            >
              <Quote className="absolute top-4 right-4 h-8 w-8 text-primary/[0.06]" />
              <div className="relative z-10">
                <div className="inline-flex items-center px-3 py-1 rounded-full bg-success/[0.08] text-success text-[11px] font-semibold mb-4 border border-success/15">
                  {t.metric}
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-foreground text-sm leading-relaxed mb-5">"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-4 border-t border-border/50">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xs font-bold text-primary ring-2 ring-primary/10">
                    {t.avatar}
                  </div>
                  <div>
                    <div className="font-semibold text-foreground text-sm">{t.author}</div>
                    <div className="text-xs text-muted-foreground">{t.role}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
