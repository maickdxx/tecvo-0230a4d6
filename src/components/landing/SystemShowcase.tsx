import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, MessageCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import { cn } from "@/lib/utils";
import screenshotServicos from "@/assets/screenshot-servicos.jpg";
import screenshotWhatsapp from "@/assets/screenshot-whatsapp.jpg";
import screenshotFinanceiro from "@/assets/screenshot-financeiro.jpg";

const showcases = [
  {
    tag: "Serviços & Agenda",
    icon: CalendarDays,
    title: "Acabou o \"esqueci de ir no cliente\"",
    description: "Crie ordens de serviço em segundos, agende visitas e receba lembretes automáticos. Cada serviço tem histórico completo, fotos do antes e depois e assinatura digital do cliente. Nada se perde.",
    image: screenshotServicos,
    alt: "Tela de ordens de serviço e agenda do Tecvo",
  },
  {
    tag: "WhatsApp integrado",
    icon: MessageCircle,
    title: "Todas as conversas organizadas num só lugar",
    description: "Todas as conversas do WhatsApp organizadas em um só lugar. Crie ordens de serviço direto do chat sem sair da tela. Respostas rápidas e chatbot para atender mais clientes sem perder nenhuma mensagem — mesmo em campo.",
    image: screenshotWhatsapp,
    alt: "WhatsApp integrado do Tecvo",
  },
  {
    tag: "Financeiro",
    icon: Wallet,
    title: "Saiba exatamente quanto sobrou no final do mês",
    description: "Chega de planilha bagunçada. Controle receitas, despesas, contas a pagar e receber em tempo real. Veja seu fluxo de caixa e tome decisões com números — não com achismo.",
    image: screenshotFinanceiro,
    alt: "Controle financeiro do Tecvo",
  },
];

function ShowcaseItem({ item, index }: { item: (typeof showcases)[0]; index: number }) {
  const { ref, isVisible } = useScrollReveal(0.1);
  const reversed = index % 2 === 1;

  return (
    <div
      ref={ref}
      className={cn(
        "flex flex-col gap-10 items-center transition-all duration-700",
        reversed ? "md:flex-row-reverse" : "md:flex-row",
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      )}
    >
      <div className="flex-1 text-center md:text-left">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5 border border-primary/15">
          <item.icon className="h-3.5 w-3.5" />
          {item.tag}
        </div>
        <h3 className="text-2xl sm:text-3xl font-bold text-foreground mb-4 leading-tight tracking-tight">
          {item.title}
        </h3>
        <p className="text-muted-foreground leading-relaxed mb-6 text-base">{item.description}</p>
        <Button size="lg" variant="outline" asChild className="hover:scale-[1.02] transition-all duration-200">
          <Link to="/cadastro">
            Testar grátis
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="flex-1 w-full" style={{ perspective: "1000px" }}>
        <div
          className={cn(
            "rounded-2xl border border-border/40 shadow-elevated overflow-hidden bg-card ring-1 ring-white/5 transition-all duration-500 hover:shadow-[0_25px_60px_-12px_rgba(0,0,0,0.18)]",
            reversed ? "hover:[transform:rotateY(2deg)]" : "hover:[transform:rotateY(-2deg)]"
          )}
        >
          <div className="h-9 bg-gradient-to-b from-muted/70 to-muted/40 flex items-center gap-1.5 px-3.5 border-b border-border/40">
            <div className="flex gap-1.5">
              <div className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#FFBD2E]" />
              <div className="h-2.5 w-2.5 rounded-full bg-[#28CA41]" />
            </div>
          </div>
          <img src={item.image} alt={item.alt} className="w-full" loading="lazy" />
        </div>
      </div>
    </div>
  );
}

export function SystemShowcase() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="funcionalidades" className="py-20 md:py-28 scroll-mt-16 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_50%,hsl(var(--primary)/0.04),transparent)]" />

      <div className="container mx-auto px-4 relative z-10">
        <div
          ref={ref}
          className={cn(
            "max-w-3xl mx-auto text-center mb-16 transition-all duration-700",
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          )}
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/[0.08] text-primary text-xs font-semibold mb-5 border border-primary/15">
            Veja na prática
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
            Feito para quem vive de{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-primary/70">
              climatização
            </span>
          </h2>
          <p className="text-muted-foreground text-base md:text-lg max-w-xl mx-auto">
            Não é sistema genérico adaptado. O Tecvo foi criado do zero para técnicos e empresas de ar-condicionado.
          </p>
        </div>

        <div className="max-w-5xl mx-auto space-y-20 md:space-y-28">
          {showcases.map((item, i) => (
            <ShowcaseItem key={item.tag} item={item} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
