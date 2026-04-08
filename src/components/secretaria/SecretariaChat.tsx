import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Loader2, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useAssistantChat } from "@/hooks/useAssistantChat";
import { useAICredits, CREDIT_PACKAGES } from "@/hooks/useAICredits";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ReactMarkdown from "react-markdown";

const quickSuggestions = [
  "Como está minha semana?",
  "Quem está atrasado?",
  "Qual dia mais vazio?",
  "Quanto posso faturar essa semana?",
  "Quem não faz manutenção há 6 meses?",
];

function RechargeInlineCTA() {
  const [open, setOpen] = useState(false);
  const { balance, isLow, isEmpty, purchaseCredits, purchasing } = useAICredits();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
      >
        <Zap className="h-3.5 w-3.5" />
        Recarregar IA
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Recursos de IA
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">
                {isEmpty ? "IA pausada" : isLow ? "Capacidade limitada" : "IA ativa"}
              </p>
              <p className={`text-3xl font-bold ${isEmpty ? "text-destructive" : isLow ? "text-amber-600" : "text-foreground"}`}>
                {balance}
              </p>
              <p className="text-xs text-muted-foreground">interações disponíveis</p>
            </div>
            <div className="space-y-2">
              {CREDIT_PACKAGES.map((pack) => (
                <button
                  key={pack.id}
                  className="w-full flex items-center justify-between p-3 rounded-xl border border-border/60 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all"
                  onClick={() => purchaseCredits(pack.id)}
                  disabled={purchasing}
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-foreground">{pack.label}</p>
                    <p className="text-xs text-muted-foreground">{pack.description}</p>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    R$ {pack.price.toFixed(2).replace(".", ",")}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function SecretariaChat() {
  const { messages, isLoading, isLoadingHistory, error, errorType, sendMessage, sendProactiveTip } = useAssistantChat();
  const proactiveSentRef = useRef(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isLoadingHistory && !proactiveSentRef.current) {
      proactiveSentRef.current = true;
      sendProactiveTip();
    }
  }, [isLoadingHistory, sendProactiveTip]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input);
    setInput("");
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Laura</h3>
          <p className="text-xs text-muted-foreground">Assistente operacional inteligente</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h4 className="text-sm font-medium text-foreground mb-1">
              Olá! Sou a Laura
            </h4>
            <p className="text-xs text-muted-foreground max-w-xs mb-4">
              Posso analisar sua agenda, faturamento, clientes e operações. Pergunte qualquer coisa!
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {quickSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setInput(s);
                    sendMessage(s);
                  }}
                  className="text-xs px-3 py-1.5 rounded-full border border-border bg-background hover:bg-muted transition-colors text-foreground"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-xl px-4 py-2.5 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
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
                <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="bg-muted rounded-xl px-4 py-2.5">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center py-2 gap-1">
            <p className="text-xs text-destructive text-center">{error}</p>
            {errorType === "credits_empty" && <RechargeInlineCTA />}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border bg-background">
        {messages.length > 0 && (
          <div className="flex gap-1.5 mb-2 overflow-x-auto pb-1">
            {quickSuggestions.slice(0, 3).map((s) => (
              <button
                key={s}
                onClick={() => {
                  setInput(s);
                  sendMessage(s);
                }}
                disabled={isLoading}
                className="text-[11px] px-2.5 py-1 rounded-full border border-border bg-background hover:bg-muted transition-colors text-muted-foreground whitespace-nowrap flex-shrink-0"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte à Laura..."
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
            disabled={isLoading}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="h-10 w-10 flex-shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
