import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

export function FirstTimeWelcome() {
  const [show, setShow] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const isFirst = localStorage.getItem("tecvo_first_dashboard");
    if (isFirst === "true") {
      setShow(true);
      localStorage.removeItem("tecvo_first_dashboard");
    }
  }, []);

  if (!show) return null;

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.4 }}
          className="mb-6 relative overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-r from-primary/5 via-card to-card p-5 shadow-lg shadow-primary/5"
        >
          <button
            onClick={() => setShow(false)}
            className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="flex items-start gap-4">
            <div className={cn("h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20")}>
              <span className="text-sm font-bold text-white">L</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Tudo pronto! 🎉
              </p>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                Que tal criar sua primeira ordem de serviço? É rápido e eu te ajudo se precisar.
              </p>
              <Button
                size="sm"
                onClick={() => {
                  setShow(false);
                  navigate("/ordens-servico/nova");
                }}
                className="mt-3 gap-1.5 rounded-lg"
              >
                Criar primeira OS
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
