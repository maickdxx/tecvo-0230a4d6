import { TrendingUp, ShieldCheck, Zap, Target, Clock, BarChart3 } from "lucide-react";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const benefits = [
  { icon: TrendingUp, title: "Fature mais sem trabalhar mais", description: "Encontre onde você está perdendo dinheiro e recupere receita que hoje escapa do seu controle." },
  { icon: Clock, title: "Ganhe 3 horas por dia de volta", description: "Orçamentos, OS e cobranças que você fazia na mão agora saem com 2 cliques." },
  { icon: Zap, title: "Atenda antes do concorrente", description: "WhatsApp integrado com todas as conversas organizadas. Responda clientes entre um serviço e outro sem perder nenhuma mensagem." },
  { icon: Target, title: "Nenhum serviço cai no esquecimento", description: "A agenda avisa sua equipe automaticamente. Manutenção preventiva nunca mais passa batido." },
  { icon: ShieldCheck, title: "Passe credibilidade de empresa grande", description: "Orçamentos em PDF, portal do cliente e assinatura digital. Seu cliente percebe a diferença." },
  { icon: BarChart3, title: "Tome decisão com número, não com feeling", description: "Veja quanto faturou, quais serviços rendem mais e onde cortar custos — tudo em tempo real." },
];

export function BenefitsSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/20 via-background to-background" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        <div
          className={cn(
            "max-w-3xl mx-auto text-center mb-14 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/[0.08] text-success text-xs font-semibold mb-5 border border-success/15">
            Resultados comprovados
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            O que muda na sua empresa{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-success to-success/70">
              no primeiro mês
            </span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {benefits.map((b, i) => (
            <div
              key={b.title}
              className={cn(
                "group relative p-6 rounded-2xl border border-border/60 bg-card overflow-hidden transition-all duration-500 hover:shadow-card-hover hover:-translate-y-1 hover:border-primary/20",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: isVisible ? `${100 + i * 60}ms` : "0ms" }}
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-400" />
              <div className="relative z-10">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/[0.08] text-primary mb-4 group-hover:bg-primary/[0.12] group-hover:scale-110 transition-all duration-300">
                  <b.icon className="h-5 w-5" />
                </div>
                <h3 className="font-bold text-foreground mb-1.5 text-base">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
