import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useDemoMode } from "./useDemoMode";

export interface TourStep {
  id: string;
  title: string;
  description: string;
  route: string;
  /** CSS selector of the element to highlight. Falls back to centered tooltip if not found. */
  targetSelector: string;
  /** Preferred position of the tooltip relative to the target */
  position: "bottom" | "top" | "left" | "right";
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "agenda",
    title: "Agenda",
    description: "Aqui você agenda serviços para seus clientes.",
    route: "/agenda",
    targetSelector: "[data-tour='agenda-header']",
    position: "bottom",
  },
  {
    id: "ordem-servico",
    title: "Ordem de Serviço",
    description: "Aqui você executa o serviço e registra pagamento.",
    route: "/ordens-servico",
    targetSelector: "[data-tour='os-header']",
    position: "bottom",
  },
  {
    id: "meu-dia",
    title: "Meu Dia",
    description: "O técnico vê apenas o dia dele, focado em execução.",
    route: "/meu-dia",
    targetSelector: "[data-tour='meu-dia-header']",
    position: "bottom",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "O financeiro atualiza automaticamente conforme você trabalha.",
    route: "/financeiro",
    targetSelector: "[data-tour='financeiro-header']",
    position: "bottom",
  },
  {
    id: "saude-empresa",
    title: "Saúde da Empresa",
    description: "Aqui você enxerga crescimento, meta e lucro.",
    route: "/dashboard",
    targetSelector: "[data-tour='dashboard-hero']",
    position: "bottom",
  },
];

interface DemoTourContextType {
  showTour: boolean;
  showPostTourModal: boolean;
  currentStep: number;
  step: TourStep;
  totalSteps: number;
  nextStep: () => void;
  prevStep: () => void;
  skipTour: () => void;
  restartTour: () => void;
  dismissPostTourModal: () => void;
}

const DemoTourContext = createContext<DemoTourContextType | null>(null);

export function DemoTourProvider({ children }: { children: ReactNode }) {
  const { user, profile } = useAuth();
  const { isDemoMode } = useDemoMode();
  const [showTour, setShowTour] = useState(false);
  const [showPostTourModal, setShowPostTourModal] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [tourChecked, setTourChecked] = useState(false);

  useEffect(() => {
    if (!user || !profile || tourChecked) return;

    const checkTour = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("demo_tour_completed")
        .eq("user_id", user.id)
        .single();

      const completed = (data as any)?.demo_tour_completed ?? false;

      if (isDemoMode && !completed) {
        setShowTour(true);
      }
      setTourChecked(true);
    };

    checkTour();
  }, [user, profile, isDemoMode, tourChecked]);

  const completeTour = useCallback(async (showModal = true) => {
    setShowTour(false);
    setCurrentStep(0);
    if (showModal) setShowPostTourModal(true);
    if (user) {
      await supabase
        .from("profiles")
        .update({ demo_tour_completed: true } as any)
        .eq("user_id", user.id);
    }
  }, [user]);

  const nextStep = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      completeTour(true);
    }
  }, [currentStep, completeTour]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) setCurrentStep((s) => s - 1);
  }, [currentStep]);

  const skipTour = useCallback(() => completeTour(false), [completeTour]);

  const restartTour = useCallback(() => {
    setCurrentStep(0);
    setShowTour(true);
    setShowPostTourModal(false);
  }, []);

  const dismissPostTourModal = useCallback(() => {
    setShowPostTourModal(false);
  }, []);

  return (
    <DemoTourContext.Provider
      value={{
        showTour,
        showPostTourModal,
        currentStep,
        step: TOUR_STEPS[currentStep],
        totalSteps: TOUR_STEPS.length,
        nextStep,
        prevStep,
        skipTour,
        restartTour,
        dismissPostTourModal,
      }}
    >
      {children}
    </DemoTourContext.Provider>
  );
}

export function useDemoTour() {
  const ctx = useContext(DemoTourContext);
  if (!ctx) {
    return {
      showTour: false,
      showPostTourModal: false,
      currentStep: 0,
      step: TOUR_STEPS[0],
      totalSteps: TOUR_STEPS.length,
      nextStep: () => {},
      prevStep: () => {},
      skipTour: () => {},
      restartTour: () => {},
      dismissPostTourModal: () => {},
    };
  }
  return ctx;
}
