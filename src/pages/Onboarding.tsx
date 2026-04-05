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

  const [step, setStep] = useState<OnboardingStep>("chat");
  const [input, setInput] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [isActivating, setIsActivating] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const startedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!authLoading && !onboardingLoading && isOnboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, onboardingLoading, isOnboardingCompleted, navigate]);

  useEffect(() => {
    if (!authLoading && !onboardingLoading && user && !isOnboardingCompleted && !startedRef.current) {
      startedRef.current = true;
      // Small delay to ensure component is fully mounted
      setTimeout(() => startConversation(), 300);
    }
  }, [authLoading, onboardingLoading, user, isOnboardingCompleted, startConversation]);

  useEffect(() => {
    if (showActivate && step === "chat") {
      setStep("payment");
    }
  }, [showActivate, step]);

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

      await completeOnboarding();
      navigate("/dashboard");
    } catch (err) {
      console.error("Activation error:", err);
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Elegant header */}
      <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
        <div className="max-w-lg mx-auto w-full px-4 py-3 flex items-center gap-3">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Bot className="h-5 w-5 text-primary" />
            </div>
            <div
              className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background"
              style={{ backgroundColor: "hsl(var(--success))" }}
            />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">Laura</h1>
            <p className="text-[11px] text-muted-foreground">
              {chatLoading ? "Digitando..." : "Sua secretária na Tecvo"}
            </p>
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
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
              <AnimatePresence mode="popLayout">
                {messages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={cn(
                      "flex gap-2.5",
                      msg.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    {msg.role === "assistant" && (
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <div
                      className={cn(
                        "max-w-[80%] px-4 py-3 text-sm leading-relaxed",
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-2xl rounded-br-lg shadow-sm"
                          : "bg-muted/70 text-foreground rounded-2xl rounded-bl-lg border border-border/30"
                      )}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&>p]:leading-relaxed">
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
              {chatLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2.5"
                >
                  <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted/70 rounded-2xl rounded-bl-lg border border-border/30 px-4 py-3">
                    <div className="flex gap-1.5 items-center h-5">
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
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
                  className="px-4 pb-2"
                >
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-lg shadow-primary/5">
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

            {/* WhatsApp card */}
            <AnimatePresence>
              {step === "whatsapp" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className="px-4 pb-2"
                >
                  <div className="bg-card border border-border rounded-2xl p-5 space-y-4 shadow-lg shadow-primary/5">
                    <div className="text-center space-y-2">
                      <div className="flex justify-center">
                        <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                          <MessageCircle className="h-6 w-6 text-primary" />
                        </div>
                      </div>
                      <h3 className="text-base font-semibold text-foreground">
                        Quase lá! Qual seu WhatsApp?
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Preciso dele pra te enviar alertas e te ajudar pelo WhatsApp 😊
                      </p>
                    </div>

                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                      placeholder="(11) 99999-9999"
                      className="text-base h-12 text-center rounded-xl"
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
                        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
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
              <div className="border-t border-border/50 bg-card/30 backdrop-blur-sm px-4 py-3">
                <div className="flex gap-2 items-center">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua resposta..."
                    className="h-11 text-sm rounded-xl bg-muted/50 border-border/50 focus-visible:ring-primary/30"
                    disabled={chatLoading}
                    autoFocus
                  />
                  <Button
                    size="icon"
                    onClick={handleSend}
                    disabled={!input.trim() || chatLoading}
                    className="h-11 w-11 flex-shrink-0 rounded-xl"
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
