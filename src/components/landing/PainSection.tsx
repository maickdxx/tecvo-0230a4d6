import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const pains = [
  { emoji: "📋", title: "Serviço anotado no papel que some no dia seguinte", color: "destructive" },
  { emoji: "💸", title: "Trabalha o mês inteiro e não sabe se deu lucro", color: "warning" },
  { emoji: "📱", title: "Cliente mandou mensagem e você demorou — ele chamou outro", color: "primary" },
  { emoji: "🗓️", title: "Manutenção marcada que ninguém lembrou de fazer", color: "destructive" },
  { emoji: "🧾", title: "Orçamento mandado por áudio sem nenhum padrão", color: "warning" },
  { emoji: "👥", title: "Técnico em campo e você sem saber o que ele fez", color: "primary" },
];

export function PainSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-muted/10 to-background" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        <div
          className={cn(
            "max-w-3xl mx-auto text-center mb-14 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-destructive/[0.08] text-destructive text-xs font-semibold mb-5 border border-destructive/15">
            <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
            Quantos desses acontecem na sua empresa?
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Você está{" "}
            <span className="text-destructive">deixando dinheiro na mesa</span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-lg mx-auto">
            Se marcou 2 ou mais, sua empresa precisa do Tecvo hoje.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {pains.map((pain, i) => (
            <div
              key={pain.title}
              className={cn(
                "group relative p-5 rounded-2xl border border-border/60 bg-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-400 overflow-hidden",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
              )}
              style={{ transitionDelay: isVisible ? `${100 + i * 60}ms` : "0ms" }}
            >
              <div className={cn(
                "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-400",
                pain.color === "destructive" && "from-destructive/[0.06] to-transparent",
                pain.color === "warning" && "from-warning/[0.06] to-transparent",
                pain.color === "primary" && "from-primary/[0.06] to-transparent",
              )} />
              <div className="relative z-10">
                <span className="text-3xl mb-3 block group-hover:scale-110 transition-transform duration-300">{pain.emoji}</span>
                <h3 className="font-semibold text-foreground text-sm leading-snug">{pain.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
