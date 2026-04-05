import { useState, useEffect, useRef } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useOnboarding } from "@/hooks/useOnboarding";
import { useOnboardingChat } from "@/hooks/useOnboardingChat";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, Bot, User, MessageCircle, ArrowRight, Sparkles, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Redirect to dashboard if onboarding already completed
  useEffect(() => {
    if (!authLoading && !onboardingLoading && isOnboardingCompleted) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, onboardingLoading, isOnboardingCompleted, navigate]);

  // Start conversation when page loads
  useEffect(() => {
    if (!authLoading && !onboardingLoading && user && !isOnboardingCompleted && !startedRef.current) {
      startedRef.current = true;
      startConversation();
    }
  }, [authLoading, onboardingLoading, user, isOnboardingCompleted, startConversation]);

  // Transition to payment when Laura signals
  useEffect(() => {
    if (showActivate && step === "chat") {
      setStep("payment");
    }
  }, [showActivate, step]);

  if (authLoading || onboardingLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCheckout = async (plan: string = "starter") => {
    setCheckoutLoading(true);
    try {
      // Save extracted data to organization before checkout
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
        // Show whatsapp step while they complete payment
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
      // Save WhatsApp if provided
      if (whatsapp.replace(/\D/g, "").length >= 10 && user) {
        let digits = whatsapp.replace(/\D/g, "");
        if (!digits.startsWith("55") && digits.length <= 11) digits = "55" + digits;
        await supabase
          .from("profiles")
          .update({ phone: digits, whatsapp_ai_enabled: true })
          .eq("user_id", user.id);
      }

      // Save extracted data
      if (profile?.organization_id) {
        const orgUpdate: any = {};
        if (extractedData.company_name) orgUpdate.name = extractedData.company_name;
        if (Object.keys(orgUpdate).length > 0) {
          await supabase
            .from("organizations")
            .update(orgUpdate)
            .eq("id", profile.organization_id);
        }

        // Create default service if extracted
        if (extractedData.main_service) {
          await supabase.from("catalog_services").insert({
            organization_id: profile.organization_id,
            name: extractedData.main_service,
            service_type: "manutencao",
            unit_price: 0,
          });
        }

        // Create sample client
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

  const handleSkipWhatsapp = () => {
    handleActivate();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex flex-col">
      {/* Header */}
      <div className="text-center pt-6 pb-2">
        <h1 className="text-2xl font-bold text-primary">Tecvo</h1>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col max-w-lg mx-auto w-full px-4 pb-4">
        {step === "activating" ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
            <p className="text-muted-foreground text-sm">Preparando tudo pra você...</p>
          </div>
        ) : (
          <>
            {/* Chat area */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex gap-2.5",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-2.5 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {chatLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-2.5">
                    <div className="flex gap-1">
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-muted-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Payment step */}
            {step === "payment" && (
              <div className="bg-card border border-border rounded-2xl p-5 mb-3 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
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

                <div className="space-y-2">
                  <Button
                    onClick={() => handleCheckout("starter")}
                    disabled={checkoutLoading}
                    className="w-full h-12 text-base font-semibold"
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
              </div>
            )}

            {/* WhatsApp step */}
            {step === "whatsapp" && (
              <div className="bg-card border border-border rounded-2xl p-5 mb-3 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-center space-y-2">
                  <div className="flex justify-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
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
                  className="text-base h-12 text-center"
                  autoFocus
                />

                <div className="space-y-2">
                  <Button
                    onClick={handleActivate}
                    disabled={isActivating || whatsapp.replace(/\D/g, "").length < 10}
                    className="w-full h-12 text-base font-semibold"
                  >
                    {isActivating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Começar a usar
                  </Button>
                  <button
                    onClick={handleSkipWhatsapp}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-2"
                  >
                    Pular por agora
                  </button>
                </div>
              </div>
            )}

            {/* Chat input — only during chat step */}
            {step === "chat" && !showActivate && (
              <div className="py-3 border-t border-border">
                <div className="flex gap-2">
                  <Textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Digite sua resposta..."
                    className="min-h-[44px] max-h-[100px] resize-none text-sm rounded-xl"
                    rows={1}
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
