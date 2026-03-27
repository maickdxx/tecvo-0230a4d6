import { Link } from "react-router-dom";
import { analytics } from "@/lib/analytics";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const solutions = [
  "Cada serviço registrado com histórico, fotos e assinatura do cliente",
  "Agenda com lembretes — nenhuma manutenção esquecida",
  "WhatsApp com IA que responde seus clientes enquanto você está em campo",
  "Financeiro real: saiba quanto entrou, quanto saiu e quanto lucrou",
  "Orçamentos em PDF com a cara da sua empresa, prontos em segundos",
  "Seus clientes voltam automaticamente sem você precisar lembrar",
];

export function SolutionSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section className="py-20 md:py-28 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_50%,hsl(var(--primary)/0.05),transparent)]" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          <div
            className={cn(
              "relative rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] via-card to-card p-10 md:p-14 overflow-hidden transition-all duration-700",
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/[0.06] rounded-full blur-[80px]" />
            <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-primary/[0.04] rounded-full blur-[80px]" />

            <div className="relative z-10">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-success/[0.08] text-success text-xs font-semibold mb-6 border border-success/15">
                ✅ Como o Tecvo resolve
              </div>

              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
                Tudo que sua empresa precisa{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
                  para parar de perder dinheiro
                </span>
              </h2>
              <p className="text-muted-foreground text-base md:text-lg mb-10 max-w-xl">
                Um sistema feito para quem vive de climatização. Sem complicação, sem treinamento. Você abre e já sabe usar.
              </p>

              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-4 mb-10">
                {solutions.map((s, i) => (
                  <div
                    key={s}
                    className={cn(
                      "flex items-start gap-3 transition-all duration-500",
                      isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                    )}
                    style={{ transitionDelay: isVisible ? `${300 + i * 60}ms` : "0ms" }}
                  >
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 mt-0.5 shrink-0">
                      <Check className="h-3 w-3 text-primary" />
                    </div>
                    <span className="text-sm text-foreground font-medium">{s}</span>
                  </div>
                ))}
              </div>

              <Button
                size="lg"
                asChild
                className="text-base px-8 py-6 shadow-[0_8px_30px_-6px_hsl(var(--primary)/0.35)] hover:scale-[1.02] transition-all duration-300"
              >
                <Link to="/cadastro" onClick={() => analytics.track("create_account_click", null, null, { location: "solution_section", page_section: "solution_section", button_label: "Quero organizar minha empresa", interaction_type: "click" })}>
                  Quero organizar minha empresa
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
