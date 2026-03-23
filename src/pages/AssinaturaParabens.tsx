import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { getPlanDisplayInfo } from "@/lib/planConfig";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, useEffect } from "react";

export default function AssinaturaParabens() {
  const navigate = useNavigate();
  const { organizationId } = useAuth();
  const { plan, planExpiresAt, refetch } = useSubscription();
  const [saving, setSaving] = useState(false);
  const [showContent, setShowContent] = useState(false);

  const planInfo = getPlanDisplayInfo(plan);

  useEffect(() => {
    const t = setTimeout(() => setShowContent(true), 200);
    return () => clearTimeout(t);
  }, []);

  const handleContinue = async () => {
    if (!organizationId) return;
    setSaving(true);
    await supabase
      .from("organizations")
      .update({ welcome_shown: true } as any)
      .eq("id", organizationId);
    await refetch();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 overflow-hidden">
      {/* Confetti particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <div
            key={i}
            className="confetti-particle"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`,
              backgroundColor: [
                "hsl(var(--primary))",
                "hsl(var(--accent))",
                "#f59e0b",
                "#10b981",
                "#8b5cf6",
                "#ec4899",
              ][i % 6],
            }}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center gap-8 px-4 max-w-md w-full transition-all duration-700 ${
          showContent ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-8 scale-95"
        }`}
      >
        {/* Animated icon */}
        <div className="relative">
          <div className="absolute -inset-4 rounded-full bg-primary/20 animate-ping opacity-30" />
          <div className="relative flex items-center justify-center w-24 h-24 rounded-full bg-primary/10 border-2 border-primary/30">
            <Sparkles className="w-12 h-12 text-primary animate-pulse" />
          </div>
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground">
            🎉 Parabéns!
          </h1>
          <p className="text-lg text-muted-foreground">
            Seu plano está ativo e pronto para usar.
          </p>
        </div>

        {/* Plan card */}
        <Card className="w-full border-primary/30 shadow-lg shadow-primary/10">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Plano</p>
                <p className="text-xl font-bold text-foreground">{planInfo.name}</p>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/15">
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                Ativo
              </Badge>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <div>
                <p className="text-sm text-muted-foreground">Valor</p>
                <p className="font-semibold text-foreground">{planInfo.price}/mês</p>
              </div>
              {planExpiresAt && (
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Válido até</p>
                  <p className="font-semibold text-foreground">
                    {format(planExpiresAt, "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
              )}
            </div>

            <div className="text-sm text-muted-foreground">
              {planInfo.limitLabel}
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <Button
          size="lg"
          onClick={handleContinue}
          disabled={saving}
          className="w-full text-base gap-2 h-12"
        >
          {saving ? "Preparando..." : "Começar a usar a plataforma"}
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>

      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-100vh) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
        .confetti-particle {
          position: absolute;
          top: -10px;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          animation: confetti-fall linear infinite;
        }
      `}</style>
    </div>
  );
}
