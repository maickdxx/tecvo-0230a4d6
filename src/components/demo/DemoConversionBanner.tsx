import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Rocket, ArrowRight, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/hooks/useDemoMode";
import { useDemoTour } from "@/hooks/useDemoTour";

const REAPPEAR_DELAY_MS = 2 * 60 * 1000; // 2 minutes
const TIME_THRESHOLD_MS = 60 * 1000; // 60 seconds
const ROUTE_THRESHOLD = 3; // 3 unique routes visited

/**
 * Smart conversion banner that appears after the user has engaged enough
 * with the demo to understand the platform's value.
 *
 * Triggers (any ONE is enough):
 *  1. Demo tour completed
 *  2. User spent 60+ seconds in the app
 *  3. User visited 3+ distinct routes
 */
export function DemoConversionBanner() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isDemoMode, exitDemoMode, isExiting } = useDemoMode();
  const { showTour, showPostTourModal } = useDemoTour();

  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const dismissedAt = useRef<number | null>(null);

  // Track unique routes visited
  const visitedRoutes = useRef(new Set<string>());
  const mountTime = useRef(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Check if enough engagement to show banner
  const checkEngagement = useCallback(() => {
    if (!isDemoMode || showTour || showPostTourModal) return false;
    // Time threshold
    if (Date.now() - mountTime.current >= TIME_THRESHOLD_MS) return true;
    // Route threshold
    if (visitedRoutes.current.size >= ROUTE_THRESHOLD) return true;
    return false;
  }, [isDemoMode, showTour, showPostTourModal]);

  // Track route changes
  useEffect(() => {
    if (!isDemoMode) return;
    visitedRoutes.current.add(location.pathname);
    if (!visible && !dismissed && checkEngagement()) {
      setVisible(true);
    }
  }, [location.pathname, isDemoMode, visible, dismissed, checkEngagement]);

  // Time-based trigger
  useEffect(() => {
    if (!isDemoMode || visible || dismissed) return;
    timerRef.current = setTimeout(() => {
      if (checkEngagement()) setVisible(true);
    }, TIME_THRESHOLD_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [isDemoMode, visible, dismissed, checkEngagement]);

  // Show when tour completes (showPostTourModal goes from true to false while still in demo)
  // The post-tour modal already handles immediate conversion; this banner catches users
  // who dismissed that modal and kept exploring.

  // Reappear after dismiss delay
  useEffect(() => {
    if (!dismissed || !isDemoMode) return;
    const id = setTimeout(() => {
      setDismissed(false);
      if (checkEngagement() && !showTour && !showPostTourModal) setVisible(true);
    }, REAPPEAR_DELAY_MS);
    return () => clearTimeout(id);
  }, [dismissed, isDemoMode, checkEngagement, showTour, showPostTourModal]);

  // Hide during tour or post-tour modal
  useEffect(() => {
    if (showTour || showPostTourModal) setVisible(false);
  }, [showTour, showPostTourModal]);

  if (!isDemoMode || showTour || showPostTourModal) return null;

  // Show full-screen transition
  if (transitioning) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center gap-5 animate-in fade-in duration-300">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
        </div>
        <div className="text-center space-y-2 max-w-md px-6">
          <h2 className="text-xl font-bold text-foreground">
            Agora vamos transformar a demonstração na sua empresa real
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Estamos preparando a Tecvo para você começar com seus próprios dados.
          </p>
        </div>
      </div>
    );
  }

  if (!visible) return null;

  const handleStartCompany = async () => {
    setVisible(false);
    setTransitioning(true);
    try {
      await exitDemoMode();
    } catch (err) {
      console.error("Exit demo failed:", err);
    }
    navigate("/onboarding");
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
    dismissedAt.current = Date.now();
  };

  return (
    <div className="mb-6 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-primary/8 p-6 md:p-8 relative animate-in fade-in slide-in-from-top-2 duration-500">
      {/* Close button */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Rocket className="h-7 w-7 text-primary" />
        </div>

        <div className="space-y-2 max-w-lg">
          <h2 className="text-lg font-bold text-foreground">
            Isso aqui pode ser a sua empresa funcionando todos os dias
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Agora vamos configurar sua empresa real em menos de 30 segundos e transformar a demonstração em uso de verdade.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-1">
          <Button
            size="lg"
            onClick={handleStartCompany}
            disabled={isExiting}
            className="gap-2"
          >
            <Rocket className="h-4 w-4" />
            {isExiting ? "Preparando..." : "Começar minha empresa"}
            <ArrowRight className="h-4 w-4" />
          </Button>
          <Button
            size="lg"
            variant="ghost"
            onClick={handleDismiss}
            className="text-muted-foreground"
          >
            Continuar explorando
          </Button>
        </div>
      </div>
    </div>
  );
}
