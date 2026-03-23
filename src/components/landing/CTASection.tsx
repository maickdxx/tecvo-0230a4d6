import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";

const faqs = [
  { question: "Preciso instalar algum programa no computador?", answer: "Não. O Tecvo funciona direto no navegador — celular, tablet ou computador. Você pode adicionar na tela inicial do celular e usar como um app." },
  { question: "Meus dados ficam seguros?", answer: "Sim. Usamos criptografia de nível bancário com backup automático. Seus dados de clientes, serviços e financeiro estão protegidos 24h." },
  { question: "Tenho contrato ou fidelidade?", answer: "Não. Cancele quando quiser, sem multa, sem burocracia. Direto nas configurações da sua conta." },
  { question: "Funciona pra técnico autônomo também?", answer: "Sim. O plano Start é ideal para quem trabalha sozinho — organiza seus serviços, clientes e financeiro sem complicação." },
  { question: "Consigo controlar minha equipe pelo Tecvo?", answer: "Sim. Você convida seus técnicos, atribui serviços, acompanha o que cada um fez e controla os gastos da equipe." },
  { question: "O WhatsApp com IA funciona mesmo?", answer: "Funciona. A IA responde seus clientes automaticamente, sugere respostas e você pode criar ordem de serviço direto da conversa — sem sair do Tecvo." },
];

export function CTASection() {
  const { ref: ctaRef, isVisible: ctaVisible } = useScrollReveal();
  const { ref: faqRef, isVisible: faqVisible } = useScrollReveal();

  return (
    <>
      <section id="faq" className="py-20 md:py-28 scroll-mt-16 relative">
        <div className="container mx-auto px-4">
          <div
            ref={faqRef}
            className={cn(
              "max-w-2xl mx-auto transition-all duration-700",
              faqVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground text-center mb-10 tracking-tight">
              Dúvidas antes de começar?
            </h2>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border/60">
                  <AccordionTrigger className="text-left text-sm font-medium hover:text-primary transition-colors py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm leading-relaxed pb-5">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>

      <section className="py-20 md:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,hsl(var(--primary)/0.06),transparent)]" />

        <div className="container mx-auto px-4 relative z-10">
          <div
            ref={ctaRef}
            className={cn(
              "max-w-4xl mx-auto relative text-center p-10 md:p-14 rounded-3xl overflow-hidden transition-all duration-700",
              ctaVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            )}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.06] via-primary/[0.03] to-primary/[0.01]" />
            <div className="absolute inset-0 border border-primary/15 rounded-3xl" />
            <div className="absolute -top-20 -right-20 w-48 h-48 bg-primary/[0.06] rounded-full blur-[80px]" />
            <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-primary/[0.04] rounded-full blur-[80px]" />

            <div className="relative z-10">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-5 tracking-tight">
                Cada dia sem controle é{" "}
                <br className="hidden sm:block" />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
                  dinheiro que você não recupera
                </span>
              </h2>
              <p className="text-muted-foreground text-base md:text-lg mb-8 max-w-xl mx-auto">
                Comece agora, sem pagar nada. Em 2 minutos sua empresa já está rodando no Tecvo.
              </p>

              <Button
                size="lg"
                asChild
                className="text-base px-10 py-7 shadow-[0_8px_30px_-6px_hsl(var(--primary)/0.4)] hover:shadow-[0_14px_45px_-6px_hsl(var(--primary)/0.5)] hover:scale-[1.03] transition-all duration-300 relative overflow-hidden group"
              >
                <Link to="/cadastro">
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  Começar meu teste grátis
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>

              <div className="flex flex-wrap items-center justify-center gap-6 mt-7 text-sm text-muted-foreground">
                {["7 dias grátis", "Sem cartão de crédito", "Cancele quando quiser"].map((text) => (
                  <span key={text} className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    {text}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
