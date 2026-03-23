import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, X, Sparkles, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDemoTour, TOUR_STEPS } from "@/hooks/useDemoTour";
import { useDemoMode } from "@/hooks/useDemoMode";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const SPOTLIGHT_PADDING = 12;
const TOOLTIP_GAP = 16;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function DemoTourOverlay() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    showTour, showPostTourModal, currentStep, step, totalSteps,
    nextStep, prevStep, skipTour, dismissPostTourModal,
  } = useDemoTour();
  const { exitDemoMode, isExiting } = useDemoMode();

  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Navigate to step route if needed
  useEffect(() => {
    if (showTour && step && location.pathname !== step.route) {
      navigate(step.route);
    }
  }, [showTour, step, location.pathname, navigate]);

  // Find and track the target element
  const findTarget = useCallback(() => {
    if (!showTour || !step) return;
    const el = document.querySelector(step.targetSelector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
      });

      // Calculate tooltip position
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const tooltipW = Math.min(340, vw - 32);
      let style: React.CSSProperties = { maxWidth: tooltipW };

      if (step.position === "bottom") {
        style.top = rect.bottom + window.scrollY + TOOLTIP_GAP;
        style.left = Math.max(16, Math.min(rect.left + window.scrollX + rect.width / 2 - tooltipW / 2, vw - tooltipW - 16));
      } else if (step.position === "top") {
        style.bottom = vh - rect.top - window.scrollY + TOOLTIP_GAP;
        style.left = Math.max(16, Math.min(rect.left + window.scrollX + rect.width / 2 - tooltipW / 2, vw - tooltipW - 16));
      } else if (step.position === "right") {
        style.top = rect.top + window.scrollY + rect.height / 2 - 60;
        style.left = rect.right + window.scrollX + TOOLTIP_GAP;
      } else {
        style.top = rect.top + window.scrollY + rect.height / 2 - 60;
        style.right = vw - rect.left - window.scrollX + TOOLTIP_GAP;
      }

      setTooltipStyle(style);
    } else {
      // Element not found yet (page still rendering), retry
      setTargetRect(null);
      setTooltipStyle({
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: Math.min(340, window.innerWidth - 32),
      });
    }
  }, [showTour, step]);

  useEffect(() => {
    if (!showTour) return;

    // Clear previous retry
    if (retryRef.current) clearTimeout(retryRef.current);

    // Initial delay to let the page render
    const timeout = setTimeout(() => {
      findTarget();
      // Retry a few times in case of slow rendering
      let attempts = 0;
      const retry = () => {
        if (attempts < 5) {
          attempts++;
          retryRef.current = setTimeout(() => {
            findTarget();
            retry();
          }, 300);
        }
      };
      retry();
    }, 400);

    const handleResize = () => findTarget();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize);

    return () => {
      clearTimeout(timeout);
      if (retryRef.current) clearTimeout(retryRef.current);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize);
    };
  }, [showTour, currentStep, findTarget, location.pathname]);

  const handleStartNow = async () => {
    dismissPostTourModal();
    await exitDemoMode();
    navigate("/dashboard", { replace: true });
  };

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <>
      {/* Spotlight overlay */}
      {showTour && step && (
        <div className="fixed inset-0 z-[9998]" style={{ pointerEvents: "none" }}>
          {/* Dark overlay with cutout via SVG */}
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <defs>
              <mask id="tour-spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {targetRect && (
                  <rect
                    x={targetRect.left - SPOTLIGHT_PADDING}
                    y={targetRect.top - SPOTLIGHT_PADDING}
                    width={targetRect.width + SPOTLIGHT_PADDING * 2}
                    height={targetRect.height + SPOTLIGHT_PADDING * 2}
                    rx="12"
                    fill="black"
                  />
                )}
              </mask>
            </defs>
            <rect
              x="0" y="0"
              width="100%"
              height={Math.max(document.documentElement.scrollHeight, window.innerHeight)}
              fill="rgba(0,0,0,0.6)"
              mask="url(#tour-spotlight-mask)"
            />
          </svg>

          {/* Highlight ring around target */}
          {targetRect && (
            <div
              className="absolute border-2 border-primary rounded-xl pointer-events-none animate-pulse"
              style={{
                top: targetRect.top - SPOTLIGHT_PADDING,
                left: targetRect.left - SPOTLIGHT_PADDING,
                width: targetRect.width + SPOTLIGHT_PADDING * 2,
                height: targetRect.height + SPOTLIGHT_PADDING * 2,
                boxShadow: "0 0 0 4px hsl(var(--primary) / 0.2)",
              }}
            />
          )}

          {/* Tooltip card */}
          <div
            className="absolute z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-300"
            style={{ ...tooltipStyle, pointerEvents: "auto" }}
          >
            <div className="rounded-xl bg-card border border-border shadow-xl p-4 space-y-3">
              {/* Step counter */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {TOUR_STEPS.map((_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "h-1.5 rounded-full transition-all duration-300",
                        i === currentStep ? "w-5 bg-primary" : i < currentStep ? "w-1.5 bg-primary/40" : "w-1.5 bg-muted-foreground/20"
                      )}
                    />
                  ))}
                </div>
                <button
                  onClick={skipTour}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Content */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {currentStep + 1}/{totalSteps}
                </p>
                <h4 className="font-bold text-foreground text-base">{step.title}</h4>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={skipTour}
                  className="text-xs text-muted-foreground h-8 px-2"
                >
                  Pular
                </Button>
                <div className="flex items-center gap-1.5">
                  {!isFirst && (
                    <Button variant="outline" size="sm" onClick={prevStep} className="h-8 gap-1 text-xs px-2.5">
                      <ArrowLeft className="h-3 w-3" /> Voltar
                    </Button>
                  )}
                  <Button size="sm" onClick={nextStep} className="h-8 gap-1 text-xs px-3">
                    {isLast ? "Finalizar" : "Próximo"}
                    {!isLast && <ArrowRight className="h-3 w-3" />}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Post-tour modal */}
      <Dialog open={showPostTourModal} onOpenChange={(open) => !open && dismissPostTourModal()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-xl">Pronto para começar sua empresa de verdade?</DialogTitle>
            <DialogDescription className="text-base leading-relaxed">
              Agora que você viu como funciona, vamos criar seu ambiente real.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button onClick={handleStartNow} disabled={isExiting} className="w-full gap-2">
              <Rocket className="h-4 w-4" />
              {isExiting ? "Preparando..." : "Começar agora"}
            </Button>
            <Button variant="ghost" onClick={dismissPostTourModal} className="w-full text-muted-foreground">
              Continuar explorando
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
