import { Link } from "react-router-dom";
import { analytics } from "@/lib/analytics";
import { ArrowRight, CheckCircle2, MessageCircle, CalendarCheck, Wallet, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import screenshotDashboard from "@/assets/screenshot-dashboard.jpg";
import screenshotWhatsapp from "@/assets/screenshot-whatsapp.jpg";

const highlights = [
  { icon: MessageCircle, label: "WhatsApp com IA" },
  { icon: CalendarCheck, label: "Agenda de serviços" },
  { icon: Wallet, label: "Controle financeiro" },
  { icon: Zap, label: "Recorrência automática" },
];

export function HeroSection() {
  return (
    <section className="relative pt-28 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.12),transparent)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-muted/20" />
      <div className="absolute top-20 left-[10%] w-72 h-72 bg-primary/[0.06] rounded-full blur-[100px]" />
      <div className="absolute bottom-0 right-[5%] w-96 h-96 bg-primary/[0.04] rounded-full blur-[120px]" />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "60px 60px",
        }}
      />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-primary/[0.08] border border-primary/20 text-primary text-xs font-semibold mb-7 animate-fade-in backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
              </span>
              Usado por mais de 500 empresas de climatização
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] font-black tracking-[-0.03em] text-foreground leading-[1.08] mb-5 animate-fade-in">
              Sua empresa de ar-condicionado{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-primary/90 to-primary/70">
                perde dinheiro todo mês
              </span>{" "}
              e você nem percebe.
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-8 animate-fade-in">
              Orçamento que não mandou, serviço que esqueceu, cliente que foi pro concorrente.{" "}
              <strong className="text-foreground font-semibold">
                O Tecvo coloca tudo no lugar — serviços, clientes, financeiro e WhatsApp — para você faturar mais com menos trabalho.
              </strong>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-8 animate-fade-in">
              <Button
                size="lg"
                asChild
                className="text-base px-8 py-6 shadow-[0_8px_30px_-6px_hsl(var(--primary)/0.4)] hover:shadow-[0_12px_40px_-6px_hsl(var(--primary)/0.5)] hover:scale-[1.02] transition-all duration-300 relative overflow-hidden group"
                onClick={() => analytics.track("create_account_click", null, null, { location: "hero" })}
              >
                <Link to="/cadastro">
                  <span className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                  Testar grátis por 7 dias
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                asChild
                className="text-base px-6 py-6 hover:scale-[1.02] transition-all duration-200"
              >
                <Link to="/login">Já tenho conta</Link>
              </Button>
            </div>

            <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground animate-fade-in">
              {["Sem cartão de crédito", "Funciona no celular", "Pronto em 2 minutos"].map((t) => (
                <span key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="relative animate-fade-in lg:pl-4">
            <div className="relative" style={{ perspective: "1200px" }}>
              <div className="absolute -inset-4 bg-gradient-to-b from-primary/15 via-primary/5 to-transparent rounded-3xl blur-2xl opacity-60" />
              <div className="relative rounded-2xl border border-border/40 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.15)] overflow-hidden bg-card ring-1 ring-white/10 [transform:rotateY(-3deg)_rotateX(2deg)] hover:[transform:rotateY(0deg)_rotateX(0deg)] transition-transform duration-700">
                <div className="h-10 bg-gradient-to-b from-muted/80 to-muted/50 flex items-center gap-2 px-4 border-b border-border/50">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                    <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                    <div className="h-3 w-3 rounded-full bg-[#28CA41]" />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-8 py-1 rounded-md bg-background/60 text-[11px] text-muted-foreground border border-border/40 flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-success/40 border border-success/60" />
                      app.tecvo.com.br
                    </div>
                  </div>
                  <div className="w-[52px]" />
                </div>
                <img src={screenshotDashboard} alt="Painel principal do Tecvo" className="w-full" loading="eager" />
              </div>

              <div className="absolute -bottom-6 -left-6 w-48 rounded-xl border border-border/50 shadow-elevated overflow-hidden bg-card/95 backdrop-blur-md animate-[float_6s_ease-in-out_infinite] hidden md:block">
                <div className="h-7 bg-muted/50 flex items-center gap-1 px-2.5 border-b border-border/30">
                  <div className="flex gap-1">
                    <div className="h-2 w-2 rounded-full bg-[#FF5F57]" />
                    <div className="h-2 w-2 rounded-full bg-[#FFBD2E]" />
                    <div className="h-2 w-2 rounded-full bg-[#28CA41]" />
                  </div>
                </div>
                <img src={screenshotWhatsapp} alt="WhatsApp integrado" className="w-full" loading="eager" />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-8 justify-center lg:justify-start">
              {highlights.map((h) => (
                <div key={h.label} className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-card border border-border/60 text-xs font-medium text-foreground shadow-xs">
                  <h.icon className="h-3.5 w-3.5 text-primary" />
                  {h.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
