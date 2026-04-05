import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useActivationStep, type ActivationStep } from "@/hooks/useActivationStep";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

const LauraAvatar = ({ size = "md" }: { size?: "sm" | "md" }) => {
  const s = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const text = size === "sm" ? "text-xs" : "text-sm";
  return (
    <div className={`${s} rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20`}>
      <span className={`${text} font-bold text-white`}>L</span>
    </div>
  );
};

const stepContent: Record<Exclude<ActivationStep, "completed">, {
  title: string;
  message: (name: string) => string;
  action: string;
  route: string;
}> = {
  welcome: {
    title: "Bem-vindo! 🎉",
    message: (name) =>
      `${name ? `${name}, a` : "A"}gora sim! Tudo pronto pra começar. Vou te ajudar a organizar sua empresa em segundos.`,
    action: "Vamos começar!",
    route: "",
  },
  create_os: {
    title: "Primeira ordem de serviço",
    message: () =>
      "Crie sua primeira OS — é rapidinho. Você pode adicionar o cliente na hora, sem precisar cadastrar antes.",
    action: "Criar primeira OS",
    route: "/ordens-servico/nova",
  },
};

export function LauraFloatingAssistant() {
  const { step, isLoading, advance, isCompleted } = useActivationStep();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [pulse, setPulse] = useState(true);

  const userName = profile?.full_name?.split(" ")[0] || "";

  // Auto-open on first render if not completed
  useEffect(() => {
    if (!isLoading && !isCompleted && !dismissed) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading, isCompleted, dismissed]);

  // Re-nudge after 30s if dismissed but not completed (only for welcome step)
  useEffect(() => {
    if (dismissed && !isCompleted && step === "welcome") {
      const timer = setTimeout(() => {
        setPulse(true);
      }, 30_000);
      return () => clearTimeout(timer);
    }
  }, [dismissed, isCompleted, step]);

  // Don't render at all if completed and closed
  if (isLoading || (isCompleted && !open)) return null;

  const current = !isCompleted ? stepContent[step as Exclude<ActivationStep, "completed">] : null;

  const handleAction = async () => {
    if (step === "welcome") {
      await advance("create_os");
    } else if (step === "create_os") {
      setOpen(false);
      navigate("/ordens-servico/nova");
    }
  };

  const handleClose = () => {
    setOpen(false);
    setDismissed(true);
    setPulse(false);
  };

  const handleFabClick = () => {
    setOpen(true);
    setDismissed(false);
    setPulse(false);
  };

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!open && !isCompleted && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            onClick={handleFabClick}
            className={`
              fixed z-50 shadow-xl
              ${isMobile ? "bottom-24 right-4" : "bottom-6 right-6"}
              h-14 w-14 rounded-full
              bg-gradient-to-br from-violet-500 to-fuchsia-500
              flex items-center justify-center
              hover:shadow-2xl hover:shadow-violet-500/30
              transition-shadow
              ${pulse ? "animate-pulse" : ""}
            `}
          >
            <MessageCircle className="h-6 w-6 text-white" />
            {/* Notification dot */}
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 border-2 border-background" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {open && current && (
          <>
            {/* Backdrop on mobile */}
            {isMobile && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
                onClick={handleClose}
              />
            )}

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className={`
                fixed z-50
                ${isMobile
                  ? "inset-x-3 bottom-24"
                  : "bottom-6 right-6 w-[380px]"
                }
              `}
            >
              <div className="rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
                {/* Header gradient bar */}
                <div className="h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
                  <div className="flex items-center gap-2.5">
                    <LauraAvatar size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-foreground">Laura</p>
                      <p className="text-[11px] text-muted-foreground">Sua assistente</p>
                    </div>
                  </div>
                  <button
                    onClick={handleClose}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-muted/50"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-start gap-3">
                    <LauraAvatar />
                    <div className="flex-1 min-w-0 bg-muted/50 rounded-2xl rounded-tl-sm px-4 py-3">
                      <p className="text-sm font-medium text-foreground leading-snug">
                        {current.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                        {current.message(userName)}
                      </p>
                    </div>
                  </div>

                  {/* Step indicator */}
                  <div className="flex items-center justify-center gap-1.5 mt-4">
                    <div className={`h-1.5 rounded-full transition-all ${step === "welcome" ? "w-6 bg-violet-500" : "w-1.5 bg-muted-foreground/30"}`} />
                    <div className={`h-1.5 rounded-full transition-all ${step === "create_os" ? "w-6 bg-violet-500" : "w-1.5 bg-muted-foreground/30"}`} />
                  </div>

                  {/* Action */}
                  <div className="mt-4 flex gap-2">
                    {step !== "welcome" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleClose}
                        className="rounded-xl h-10"
                      >
                        Depois
                      </Button>
                    )}
                    <Button
                      onClick={handleAction}
                      className="flex-1 gap-1.5 rounded-xl h-10 bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:from-violet-600 hover:to-fuchsia-600 text-white border-0"
                    >
                      {current.action}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
