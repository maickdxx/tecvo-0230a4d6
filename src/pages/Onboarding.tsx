import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useOnboardingChat } from "@/hooks/useOnboardingChat";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, ArrowRight, Sparkles, Check, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type OnboardingStep = "chat" | "payment" | "whatsapp" | "activating" | "transition";

const LauraAvatar = ({ size = "md" }: { size?: "sm" | "md" | "lg" }) => {
  const dims = size === "lg" ? "h-14 w-14" : size === "md" ? "h-9 w-9" : "h-7 w-7";
  const text = size === "lg" ? "text-lg" : size === "md" ? "text-sm" : "text-xs";
  return (
    <div className={cn(dims, "rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-violet-500/20")}>
      <span className={cn(text, "font-bold text-white")}>L</span>
    </div>
  );
};

function TransitionScreen({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col items-center gap-6 text-center"
      >
        <LauraAvatar size="lg" />
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-2">
          <p className="text-lg font-semibold text-foreground">Pronto, já deixei tudo preparado pra você 😊</p>
          <p className="text-sm text-muted-foreground">Vou te mostrar como está ficando...</p>
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </motion.div>
      </motion.div>
      <button onClick={onDone} className="mt-8 text-xs text-muted-foreground hover:text-foreground transition-colors">
        Ir para o painel →
      </button>
    </div>
  );
}

export default function Onboarding() {
  const { user, profile, isLoading: authLoading } = useAuth();
  const { isOnboardingCompleted, isLoading: onboardingLoading, completeOnboarding } = useOnboarding();
  const navigate = useNavigate();

  const userName = profile?.full_name || user?.user_metadata?.full_name || "";
  const {
    messages,
    isLoading: chatLoading,
    extractedData,
    showActivate,
    sendMessage,
    startConversation,
  } = useOnboardingChat(userName);

  const [step, setStepRaw] = useState<OnboardingStep>(() => {
    const saved = localStorage.getItem("tecvo_onboarding_step");
    if (saved === "whatsapp" || saved === "payment" || saved === "activating" || saved === "transition") return saved as OnboardingStep;
    return "chat";
  });

  const setStep = (s: OnboardingStep) => {
    setStepRaw(s);
    localStorage.setItem("tecvo_onboarding_step", s);
  };
  const [input, setInput] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [whatsappMessages, setWhatsappMessages] = useState<Array<{role: "assistant" | "user"; content: string}>>([]);
  const whatsappInitRef = useRef(false);

  useEffect(() => {
    // Delay scroll to allow animations to settle
    const t = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
    return () => clearTimeout(t);
  }, [messages, whatsappMessages]);

  useEffect(() => {
    if (!authLoading && !onboardingLoading && isOnboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, onboardingLoading, isOnboardingCompleted, navigate]);

  useEffect(() => {
    if (!authLoading && !onboardingLoading && user && !isOnboardingCompleted && !startedRef.current) {
      if (step === "chat") {
        startedRef.current = true;
        setTimeout(() => startConversation(), 300);
      }
    }
  }, [authLoading, onboardingLoading, user, isOnboardingCompleted, startConversation, step]);

  useEffect(() => {
    if (showActivate && step === "chat") {
      setStep("payment");
    }
  }, [showActivate, step]);

  useEffect(() => {
    if (step === "whatsapp" && !whatsappInitRef.current) {
      whatsappInitRef.current = true;
      const name = userName ? userName.split(" ")[0] : "";
      const greeting = name ? `${name}, ` : "";
      setTimeout(() => {
        setWhatsappMessages([
          {
            role: "assistant",
            content: `${greeting}seu plano já tá ativo! 🎉\n\nAgora me passa seu WhatsApp pra eu te acompanhar por lá também.`
          }
        ]);
      }, 600);
    }
  }, [step, userName]);

  if (authLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <LauraAvatar size="lg" />
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Preparando a Laura...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleSend = () => {
    if (!input.trim() || chatLoading) return;
    sendMessage(input);
    setInput("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCheckout = async (plan: string = "starter") => {
    setCheckoutLoading(true);
    try {
      if (extractedData.company_name && profile?.organization_id) {
        await supabase
          .from("organizations")
          .update({ name: extractedData.company_name })
          .eq("id", profile.organization_id);
      }

      const { data, error } = await supabase.functions.invoke("stripe-create-checkout", {
        body: { plan },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
        setStep("whatsapp");
      }
    } catch (err: any) {
      console.error("Checkout error:", err);
      toast({
        variant: "destructive",
        title: "Erro",
        description: err.message || "Erro ao iniciar pagamento",
      });
    } finally {
      setCheckoutLoading(false);
    }
  };

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    let formatted = digits;
    if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    return formatted;
  };

  const handleActivate = async () => {
    setIsActivating(true);
    // Go to transition step first
    setStep("transition");

    try {
      if (whatsapp.replace(/\D/g, "").length >= 10 && user) {
        let digits = whatsapp.replace(/\D/g, "");
        if (!digits.startsWith("55") && digits.length <= 11) digits = "55" + digits;
        await supabase
          .from("profiles")
          .update({ phone: digits, whatsapp_ai_enabled: true })
          .eq("user_id", user.id);
      }

      if (profile?.organization_id) {
        const orgUpdate: any = {};
        if (extractedData.company_name) orgUpdate.name = extractedData.company_name;
        if (Object.keys(orgUpdate).length > 0) {
          await supabase
            .from("organizations")
            .update(orgUpdate)
            .eq("id", profile.organization_id);
        }

        if (extractedData.main_service) {
          await supabase.from("catalog_services").insert({
            organization_id: profile.organization_id,
            name: extractedData.main_service,
            service_type: "manutencao",
            unit_price: 0,
          });
        }
      }

      localStorage.removeItem("tecvo_onboarding_step");
      await completeOnboarding();
      localStorage.setItem("tecvo_first_dashboard", "true");
      // TransitionScreen component handles the redirect
    } catch (err) {
      console.error("Activation error:", err);
      navigate("/dashboard");
    }
  };

  const displayMessages = step === "whatsapp" ? whatsappMessages : messages;
  const showTypingIndicator = step === "chat" && chatLoading && messages[messages.length - 1]?.role !== "assistant";

  const stepIndex = step === "chat" ? 0 : step === "payment" ? 1 : 2;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Transition screen */}
      {step === "transition" ? (
        <TransitionScreen onDone={() => navigate("/dashboard")} />
      ) : step === "activating" ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex flex-col items-center gap-5"
          >
            <div className="relative">
              <LauraAvatar size="lg" />
              <motion.div
                className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary flex items-center justify-center"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3 }}
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary-foreground" />
              </motion.div>
            </div>
            <div className="text-center space-y-1.5">
              <p className="text-base font-semibold text-foreground">Preparando tudo pra você...</p>
              <p className="text-sm text-muted-foreground">Só um instante</p>
            </div>
          </motion.div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/30">
            <div className="max-w-lg mx-auto w-full px-4 py-3 flex items-center gap-3">
              <div className="relative">
                <LauraAvatar size="md" />
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-background" />
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="text-sm font-semibold text-foreground tracking-tight">Laura</h1>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
                  {chatLoading && step === "chat" ? (
                    <span className="text-primary font-medium">digitando...</span>
                  ) : "Sua secretária inteligente"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      "rounded-full transition-all duration-500 ease-out",
                      i === stepIndex
                        ? "w-5 h-1.5 bg-primary"
                        : i < stepIndex
                        ? "w-1.5 h-1.5 bg-primary/50"
                        : "w-1.5 h-1.5 bg-muted-foreground/15"
                    )}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col max-w-lg mx-auto w-full">
            {/* Messages area */}
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
              <AnimatePresence mode="popLayout">
                {displayMessages.map((msg, i) => (
                  <motion.div
                    key={`${step}-${i}`}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94], delay: step === "whatsapp" ? i * 0.15 : 0 }}
                    className={cn(
                      "flex gap-2.5 items-end",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && <LauraAvatar size="sm" />}
                    <div
                      className={cn(
                        "max-w-[80%] text-[14px] leading-[1.6]",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground px-4 py-2.5 rounded-2xl rounded-br-sm"
                          : "bg-muted/60 text-foreground px-4 py-2.5 rounded-2xl rounded-bl-sm"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:mb-1 last:[&>p]:mb-0 [&>p]:leading-[1.6]">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {showTypingIndicator && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5 items-end"
                >
                  <LauraAvatar size="sm" />
                  <div className="bg-muted/60 rounded-2xl rounded-bl-sm px-5 py-3">
                    <div className="flex gap-1 items-center h-4">
                      {[0, 1, 2].map((d) => (
                        <motion.span
                          key={d}
                          className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full"
                          animate={{ y: [0, -4, 0] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: d * 0.15, ease: "easeInOut" }}
                        />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Payment card */}
            <AnimatePresence>
              {step === "payment" && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
                  className="px-4 pb-4"
                >
                  <div className="bg-gradient-to-b from-card to-card/80 border border-border/40 rounded-2xl p-6 space-y-5 shadow-xl shadow-black/5">
                    <div className="text-center space-y-3">
                      <div className="mx-auto h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                        <Sparkles className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground">Ative por R$ 1</h3>
                        <p className="text-xs text-muted-foreground mt-1">Primeiro mês por R$ 1 · Cancele quando quiser</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleCheckout("starter")}
                      disabled={checkoutLoading}
                      className="w-full h-12 text-[15px] font-semibold rounded-xl bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/20"
                    >
                      {checkoutLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                      Ativar agora
                    </Button>
                    <p className="text-[10px] text-muted-foreground/70 text-center">Plano Start · Após o 1º mês: R$ 49/mês</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* WhatsApp input */}
            <AnimatePresence>
              {step === "whatsapp" && whatsappMessages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 24 }}
                  transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
                  className="px-4 pb-4"
                >
                  <div className="bg-gradient-to-b from-card to-card/80 border border-border/40 rounded-2xl p-6 space-y-4 shadow-xl shadow-black/5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#25D366" }}>
                        <MessageCircle className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">Seu WhatsApp</h3>
                        <p className="text-[11px] text-muted-foreground">Para receber alertas e falar comigo</p>
                      </div>
                    </div>

                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className="text-base h-12 text-center rounded-xl bg-muted/40 border-border/30 focus-visible:ring-primary/30"
                      autoFocus
                    />

                    <div className="space-y-2">
                      <Button
                        onClick={handleActivate}
                        disabled={isActivating || whatsapp.replace(/\D/g, "").length < 10}
                        className="w-full h-12 text-[15px] font-semibold rounded-xl shadow-lg shadow-primary/20"
                      >
                        {isActivating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
                        Começar a usar
                      </Button>
                      <button
                        onClick={() => handleActivate()}
                        className="w-full text-[11px] text-muted-foreground hover:text-foreground transition-colors py-1.5"
                      >
                        Pular por agora · algumas funções ficam limitadas
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat input */}
            {step === "chat" && !showActivate && (
              <div className="border-t border-border/30 bg-background/80 backdrop-blur-xl px-4 py-3">
                <div className="flex gap-2 items-center max-w-lg mx-auto">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua resposta..."
                    className="h-11 text-sm rounded-full bg-muted/40 border-border/30 px-4 focus-visible:ring-primary/30"
                    disabled={chatLoading}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() || chatLoading}
                    className="h-10 w-10 flex-shrink-0 rounded-full shadow-lg shadow-primary/20"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
