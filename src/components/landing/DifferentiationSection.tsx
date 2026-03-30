import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const comparisons = [
  { before: "Anota serviço no papel e perde", after: "Tudo registrado com histórico e fotos" },
  { before: "Não sabe se deu lucro no mês", after: "Financeiro mostra o resultado em tempo real" },
  { before: "Cliente esperou e chamou o concorrente", after: "WhatsApp integrado — responda de qualquer lugar sem perder conversa" },
  { before: "Orçamento mandado por áudio", after: "PDF profissional com sua marca pronto em 10s" },
  { before: "Técnico em campo sem acompanhamento", after: "Sabe o que cada um fez, gastou e rendeu" },
  { before: "Manutenção preventiva esquecida", after: "Cliente recebe aviso automático e agenda sozinho" },
];

export function DifferentiationSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,hsl(var(--primary)/0.05),transparent)]" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        <div
          className={cn(
            "max-w-3xl mx-auto text-center mb-14 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5 border border-primary/15">
            Antes vs. Depois do Tecvo
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Sem sistema vs.{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
              com o Tecvo
            </span>
          </h2>
        </div>

        <div className="max-w-3xl mx-auto space-y-3">
          {comparisons.map((c, i) => (
            <div
              key={c.before}
              className={cn(
                "grid grid-cols-[1fr_auto_1fr] items-center gap-4 transition-all duration-500",
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              )}
              style={{ transitionDelay: isVisible ? `${100 + i * 60}ms` : "0ms" }}
            >
              <div className="text-right p-4 rounded-xl bg-destructive/[0.04] border border-destructive/10">
                <span className="text-sm text-muted-foreground line-through decoration-destructive/40">{c.before}</span>
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold shrink-0">→</div>
              <div className="p-4 rounded-xl bg-success/[0.04] border border-success/10">
                <span className="text-sm text-foreground font-medium">{c.after}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
