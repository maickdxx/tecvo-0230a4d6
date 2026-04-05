import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useOnboardingChat } from "@/hooks/useOnboardingChat";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Bot, MessageCircle, ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type OnboardingStep = "chat" | "payment" | "whatsapp" | "activating";

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
    if (saved === "whatsapp" || saved === "payment" || saved === "activating") return saved;
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

  // Laura's WhatsApp phase messages
  const [whatsappMessages, setWhatsappMessages] = useState<Array<{role: "assistant" | "user"; content: string}>>([]);
  const whatsappInitRef = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, whatsappMessages]);

  useEffect(() => {
    if (!authLoading && !onboardingLoading && isOnboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, onboardingLoading, isOnboardingCompleted, navigate]);

  useEffect(() => {
    if (!authLoading && !onboardingLoading && user && !isOnboardingCompleted && !startedRef.current) {
      // Only start conversation if we're on chat step (not returning from payment)
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

  // When entering WhatsApp step, show Laura's message about WhatsApp
  useEffect(() => {
    if (step === "whatsapp" && !whatsappInitRef.current) {
      whatsappInitRef.current = true;
      const name = userName ? userName.split(" ")[0] : "";
      const greeting = name ? `${name}, ` : "";
      
      // Simulate typing delay
      setTimeout(() => {
        setWhatsappMessages([
          {
            role: "assistant",
            content: `${greeting}seu plano já tá ativo! 🎉\n\nAgora me passa seu WhatsApp pra eu te ajudar por lá também. Vou te enviar lembretes, alertas e você pode falar comigo direto pelo WhatsApp.`
          }
        ]);
      }, 600);
    }
  }, [step, userName]);

  if (authLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-7 w-7 text-primary" />
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
              <Loader2 className="h-3 w-3 animate-spin text-primary-foreground" />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">Preparando a Laura...</p>
        </div>
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
    setStep("activating");

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

        await supabase.from("clients").insert({
          organization_id: profile.organization_id,
          name: "Cliente Exemplo",
          phone: "(00) 00000-0000",
          is_demo_data: true,
        });
      }

      localStorage.removeItem("tecvo_onboarding_step");
      await completeOnboarding();
      navigate("/dashboard");
    } catch (err) {
      console.error("Activation error:", err);
      navigate("/dashboard");
    }
  };

  // Decide which messages to show based on step
  const displayMessages = step === "whatsapp" ? whatsappMessages : messages;
  const showTypingIndicator = step === "chat" && chatLoading && messages[messages.length - 1]?.role !== "assistant";

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20 flex flex-col">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-lg mx-auto w-full px-4 py-3.5 flex items-center gap-3">
          <div className="relative">
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shadow-sm">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card"
              style={{ backgroundColor: "hsl(var(--success))" }}
            />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold text-foreground leading-tight">Laura</h1>
            <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
              {chatLoading && step === "chat" ? (
                <span className="flex items-center gap-1">
                  <span className="inline-flex gap-0.5">
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  <span className="ml-1">digitando</span>
                </span>
              ) : "Sua secretária na Tecvo"}
            </p>
          </div>
          {/* Step indicator */}
          <div className="flex items-center gap-1.5">
            {["chat", "payment", "whatsapp"].map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-500",
                  step === s || (step === "activating" && s === "whatsapp")
                    ? "w-6 bg-primary" 
                    : ["chat"].indexOf(step) < i 
                      ? "w-1.5 bg-muted-foreground/20" 
                      : "w-1.5 bg-primary/40"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full">
        {step === "activating" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 px-4">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-4"
            >
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-foreground">Preparando tudo pra você...</p>
                <p className="text-xs text-muted-foreground mt-1">Isso leva só um instante</p>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {/* Chat messages */}
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
              <AnimatePresence mode="popLayout">
                {displayMessages.map((msg, i) => (
                  <motion.div
                    key={`${step}-${i}`}
                    initial={{ opacity: 0, y: 10, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut", delay: step === "whatsapp" ? i * 0.15 : 0 }}
                    className={cn(
                      "flex gap-2.5",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[82%] px-4 py-3 text-[14px] leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md shadow-md shadow-primary/10"
                          : "bg-card text-foreground rounded-2xl rounded-bl-md border border-border/50 shadow-sm"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:leading-relaxed [&>p]:mb-1.5 last:[&>p]:mb-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Typing indicator */}
              {showTypingIndicator && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5"
                >
                  <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center flex-shrink-0 shadow-sm">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-card rounded-2xl rounded-bl-md border border-border/50 shadow-sm px-5 py-3.5">
                    <div className="flex gap-1.5 items-center h-5">
                      <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="px-4 pb-3"
                >
                  <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4 shadow-lg shadow-primary/5">
                    <div className="text-center space-y-2">
                      <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <Sparkles className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        Ative sua conta por apenas R$ 1
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Primeiro mês por R$ 1. Cancele quando quiser.
                      </p>
                    </div>

                    <Button
                      onClick={() => handleCheckout("starter")}
                      disabled={checkoutLoading}
                      className="w-full h-12 text-base font-semibold rounded-xl"
                    >
                      {checkoutLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ArrowRight className="h-4 w-4 mr-2" />
                      )}
                      Ativar por R$ 1
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Plano Start • Após o 1º mês: R$ 49/mês
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* WhatsApp input card - shown inside the chat flow */}
            <AnimatePresence>
              {step === "whatsapp" && whatsappMessages.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 }}
                  className="px-4 pb-3"
                >
                  <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4 shadow-lg shadow-primary/5">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                        <MessageCircle className="h-5 w-5 text-primary" />
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
                      className="text-base h-12 text-center rounded-xl bg-muted/30 border-border/50"
                      autoFocus
                    />

                    <div className="space-y-2">
                      <Button
                        onClick={handleActivate}
                        disabled={isActivating || whatsapp.replace(/\D/g, "").length < 10}
                        className="w-full h-12 text-base font-semibold rounded-xl"
                      >
                        {isActivating ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Check className="h-4 w-4 mr-2" />
                        )}
                        Começar a usar
                      </Button>
                      <button
                        onClick={() => handleActivate()}
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
                      >
                        Pular por agora
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Chat input */}
            {step === "chat" && !showActivate && (
              <div className="border-t border-border/40 bg-card/50 backdrop-blur-md px-4 py-3">
                <div className="flex gap-2 items-center">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua resposta..."
                    className="h-11 text-sm rounded-xl bg-muted/30 border-border/40 focus-visible:ring-primary/30"
                    disabled={chatLoading}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() || chatLoading}
                    className="h-11 w-11 flex-shrink-0 rounded-xl shadow-md shadow-primary/10"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
