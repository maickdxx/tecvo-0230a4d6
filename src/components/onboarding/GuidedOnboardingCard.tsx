import { useNavigate } from "react-router-dom";
import { Users, Wrench, CalendarDays, Rocket, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useGuidedOnboarding } from "@/hooks/useGuidedOnboarding";

const STEP_CONFIG = [
  {
    icon: Users,
    title: "Criar primeiro cliente",
    message: "Adicione seu primeiro cliente e comece a organizar seus atendimentos.",
    buttonLabel: "Criar Cliente",
    href: "/clientes/novo?from=checklist",
  },
  {
    icon: Wrench,
    title: "Criar primeiro serviço",
    message: "Cadastre um serviço e prepare sua operação.",
    buttonLabel: "Criar Serviço",
    href: "/ordens-servico/nova?from=checklist",
  },
  {
    icon: CalendarDays,
    title: "Criar primeiro agendamento",
    message: "Veja sua agenda funcionando de verdade.",
    buttonLabel: "Abrir Agenda",
    href: "/agenda?from=checklist",
  },
];

export function GuidedOnboardingCard() {
  const navigate = useNavigate();
  const { showGuide, currentStep, steps, allCompleted, dismissGuide } = useGuidedOnboarding();

  if (!showGuide) return null;

  const completedCount = steps.filter((s) => s.completed).length;
  const progressValue = allCompleted ? 100 : (completedCount / 3) * 100;

  if (allCompleted) {
    return (
      <Card className="mb-6 border-l-4 border-l-primary bg-primary/5">
        <CardContent className="py-6 space-y-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-7 w-7 text-primary" />
            <h3 className="text-lg font-bold text-foreground">
              🚀 Agora sua empresa está rodando dentro da Tecvo.
            </h3>
          </div>

          <div className="space-y-1.5 text-sm text-muted-foreground">
            <p>A partir de agora:</p>
            {[
              "Seus serviços ficam registrados",
              "Seus clientes começam a gerar histórico",
              "Sua recorrência será criada automaticamente",
              "Você começa a construir faturamento previsível",
            ].map((text) => (
              <div key={text} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>

          <p className="text-sm font-medium text-foreground">
            Continue usando. Em poucos meses a Tecvo começa a trazer clientes de volta automaticamente.
          </p>

          <Button onClick={dismissGuide} className="gap-2">
            Ir para Visão Geral <ArrowRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>
    );
  }

  const step = STEP_CONFIG[currentStep - 1];
  const StepIcon = step.icon;

  return (
    <Card className="mb-6 border-l-4 border-l-primary bg-primary/5">
      <CardContent className="py-6 space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Passo {currentStep} de 3
            </span>
            <div className="flex gap-1.5">
              {steps.map((s, i) => (
                <div
                  key={i}
                  className={`h-2 w-2 rounded-full ${s.completed ? "bg-primary" : "bg-muted"}`}
                />
              ))}
            </div>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        {/* Step content */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <StepIcon className="h-5 w-5 text-primary" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground">{step.message}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
          <Button onClick={() => navigate(step.href)} className="gap-2">
            {step.buttonLabel} <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={dismissGuide} className="text-muted-foreground">
            Pular
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
