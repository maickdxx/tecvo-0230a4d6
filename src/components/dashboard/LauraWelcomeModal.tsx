import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";

const LauraAvatar = () => (
  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20">
    <span className="text-lg font-bold text-white">L</span>
  </div>
);

export function LauraWelcomeModal() {
  const [show, setShow] = useState(false);
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const userName = profile?.full_name?.split(" ")[0] || "";

  useEffect(() => {
    const isFirst = localStorage.getItem("tecvo_first_dashboard");
    if (isFirst === "true") {
      setShow(true);
      localStorage.removeItem("tecvo_first_dashboard");
    }
  }, []);

  if (!show) return null;

  const messages = [
    {
      text: `${userName ? `${userName}, a` : "A"}gora sim! Você está dentro 🎉`,
      sub: "Eu sou a Laura, e vou te ajudar a organizar tudo por aqui.",
    },
    {
      text: "Vamos começar criando seu primeiro cliente?",
      sub: "É rapidinho — só preciso de um nome e telefone.",
    },
  ];

  const current = messages[step];

  const handleAction = () => {
    setShow(false);
    navigate("/clientes/novo");
  };

  const handleDismiss = () => {
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={handleDismiss}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-4 top-[20%] z-50 mx-auto max-w-md"
          >
            <div className="relative rounded-2xl border border-border/60 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
              {/* Close */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Header gradient */}
              <div className="h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-violet-500" />

              <div className="p-6">
                <div className="flex items-start gap-4">
                  <LauraAvatar />
                  <div className="flex-1 min-w-0 pt-1">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.25 }}
                      >
                        <p className="text-base font-semibold text-foreground leading-snug">
                          {current.text}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                          {current.sub}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-2">
                  {step === 0 ? (
                    <Button
                      onClick={() => setStep(1)}
                      className="flex-1 gap-1.5 rounded-xl h-11"
                    >
                      Vamos lá!
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  ) : (
                    <>
                      <Button
                        variant="outline"
                        onClick={handleDismiss}
                        className="rounded-xl h-11"
                      >
                        Depois
                      </Button>
                      <Button
                        onClick={handleAction}
                        className="flex-1 gap-1.5 rounded-xl h-11"
                      >
                        Criar primeiro cliente
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
