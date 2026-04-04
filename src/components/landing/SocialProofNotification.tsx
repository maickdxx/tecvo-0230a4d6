import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle } from "lucide-react";

const notifications = [
  { name: "João", city: "SP", action: "acabou de alavancar a empresa dele assinando a Tecvo" },
  { name: "Carlos", city: "BH", action: "assinou por R$1 e já organizou a agenda" },
  { name: "Fernanda", city: "RJ", action: "assinou a Tecvo e parou de perder cliente" },
  { name: "Rafael", city: "Curitiba", action: "acabou de criar a conta e já cadastrou 12 clientes" },
  { name: "Ana", city: "Campinas", action: "assinou o plano Pro e dobrou o faturamento" },
  { name: "Marcos", city: "Goiânia", action: "assinou a Tecvo agora mesmo" },
  { name: "Lucas", city: "Fortaleza", action: "acabou de assinar e já enviou 5 ordens de serviço" },
  { name: "Patricia", city: "Salvador", action: "organizou toda a empresa com a Tecvo" },
  { name: "Roberto", city: "Manaus", action: "assinou a Tecvo e nunca mais esqueceu manutenção" },
  { name: "Juliana", city: "Recife", action: "assinou por R$1 e já agendou a semana toda" },
  { name: "Diego", city: "Porto Alegre", action: "acabou de assinar e automatizou os lembretes" },
  { name: "Thiago", city: "Brasília", action: "criou a conta e já está faturando mais" },
];

const timeAgo = ["agora mesmo", "há 2 min", "há 5 min", "há 8 min", "há 12 min"];

export function SocialProofNotification() {
  const [current, setCurrent] = useState<number | null>(null);
  const [visible, setVisible] = useState(false);

  const showNext = useCallback(() => {
    const idx = Math.floor(Math.random() * notifications.length);
    setCurrent(idx);
    setVisible(true);
    setTimeout(() => setVisible(false), 4000);
  }, []);

  useEffect(() => {
    const initialDelay = setTimeout(showNext, 5000);
    const interval = setInterval(showNext, 12000);
    return () => {
      clearTimeout(initialDelay);
      clearInterval(interval);
    };
  }, [showNext]);

  const notif = current !== null ? notifications[current] : null;
  const time = timeAgo[Math.floor(Math.random() * timeAgo.length)];

  return (
    <div className="fixed bottom-6 left-6 z-[60] max-w-[340px]">
      <AnimatePresence>
        {visible && notif && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="bg-card border border-border/60 rounded-xl p-4 shadow-lg backdrop-blur-sm"
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0 ring-2 ring-primary/10">
                <span className="text-xs font-bold text-primary">
                  {notif.name.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground leading-snug">
                  <strong>{notif.name}</strong>
                  <span className="text-muted-foreground"> de {notif.city}</span>
                  {" "}{notif.action}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <CheckCircle className="w-3 h-3 text-emerald-500" />
                  <span className="text-[11px] text-muted-foreground">{time}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
