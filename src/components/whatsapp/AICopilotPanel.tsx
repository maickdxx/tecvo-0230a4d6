import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { useWhatsAppMessages } from "@/hooks/useWhatsAppMessages";
import { useWhatsAppSend } from "@/hooks/useWhatsAppSend";
import { useAuth } from "@/hooks/useAuth";
import ReactMarkdown from "react-markdown";
import {
  Sparkles,
  Send,
  RefreshCw,
  Check,
  Pencil,
  Loader2,
  X,
  MessageSquareText,
  Bot,
} from "lucide-react";
import { toast } from "sonner";

interface Suggestion {
  label: string;
  text: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface AICopilotPanelProps {
  contactId: string;
  channelId: string | null;
  onClose: () => void;
  targetMessage?: any;
  onTargetMessageClear?: () => void;
  onMessageSent?: (contactId: string, content: string) => void;
}

export function AICopilotPanel({
  contactId,
  channelId,
  onClose,
  targetMessage,
  onTargetMessageClear,
  onMessageSent,
}: AICopilotPanelProps) {
  const { organization } = useOrganization();
  const { profile } = useAuth();
  const { messages: convMessages } = useWhatsAppMessages(contactId);
  const { sendMessage } = useWhatsAppSend();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"suggest" | "chat">("suggest");
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Auto-generate suggestions when a target message is set
  useEffect(() => {
    if (targetMessage && contactId && organization?.id) {
      setActiveTab("suggest");
      generateSuggestions(targetMessage);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMessage?.id]);

  const generateSuggestions = async (forMessage?: any) => {
    if (!contactId || !organization?.id) return;
    setLoadingSuggestions(true);
    setSuggestions([]);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      // Build conversation context - use latest messages
      const recentMessages = convMessages.slice(-30).map((m: any) => ({
        content: m.content,
        is_from_me: m.is_from_me,
        created_at: m.created_at,
      }));

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-ai-copilot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            contactId,
            organizationId: organization.id,
            conversationMessages: recentMessages,
            mode: "suggest",
            // If replying to a specific message, highlight it
            targetMessage: forMessage ? {
              content: forMessage.content,
              is_from_me: forMessage.is_from_me,
              created_at: forMessage.created_at,
            } : undefined,
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao gerar sugestões");
      }

      const data = await resp.json();
      setSuggestions(data.suggestions || []);
    } catch (e: any) {
      toast.error(e.message || "Erro ao gerar sugestões");
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleApproveAndSend = async (text: string) => {
    if (!channelId) return;
    const userName = profile?.full_name || "";
    const finalMsg = userName ? `*${userName}:*\n${text}` : text;
    onMessageSent?.(contactId, finalMsg);
    await sendMessage(channelId, contactId, finalMsg);
    toast.success("Mensagem enviada!");
  };

  const handleEditStart = (idx: number) => {
    setEditingIdx(idx);
    setEditText(suggestions[idx].text);
  };

  const handleEditSend = async () => {
    if (editText.trim() && channelId) {
      const userName = profile?.full_name || "";
      const finalMsg = userName ? `*${userName}:*\n${editText.trim()}` : editText.trim();
      onMessageSent?.(contactId, finalMsg);
      await sendMessage(channelId, contactId, finalMsg);
      setEditingIdx(null);
      setEditText("");
      toast.success("Mensagem enviada!");
    }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading || !organization?.id) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-ai-copilot`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            contactId,
            organizationId: organization.id,
            conversationMessages: convMessages.slice(-30).map((m: any) => ({
              content: m.content,
              is_from_me: m.is_from_me,
              created_at: m.created_at,
            })),
            userQuestion: userMsg.content,
            mode: "chat",
          }),
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro na IA");
      }

      // Stream response
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let assistantContent = "";
      let textBuffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setChatMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant") {
                  return prev.map((m, i) =>
                    i === prev.length - 1 ? { ...m, content: assistantContent } : m
                  );
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }

      if (!assistantContent) {
        setChatMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Não consegui gerar uma resposta. Tente novamente." },
        ]);
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao consultar IA");
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Erro ao processar. Tente novamente." },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 shrink-0">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Copiloto IA</p>
            <p className="text-[10px] text-muted-foreground leading-none">Assistente de atendimento</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-border/60 shrink-0">
        <button
          onClick={() => setActiveTab("suggest")}
          className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
            activeTab === "suggest"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquareText className="h-3.5 w-3.5 inline mr-1.5" />
          Sugestões
        </button>
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2.5 text-xs font-semibold text-center transition-colors ${
            activeTab === "chat"
              ? "text-primary border-b-2 border-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot className="h-3.5 w-3.5 inline mr-1.5" />
          Perguntar
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "suggest" ? (
          <div className="flex flex-col h-full">
            <ScrollArea className="flex-1 p-4">
              {suggestions.length === 0 && !loadingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-10 text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/5 flex items-center justify-center">
                    <Sparkles className="h-6 w-6 text-primary/40" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-muted-foreground">
                      Gere sugestões de resposta
                    </p>
                    <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                      A IA analisa a conversa, seus serviços e preços para sugerir respostas
                    </p>
                  </div>
                  <Button
                    onClick={() => generateSuggestions()}
                    size="sm"
                    className="gap-2 mt-2"
                    disabled={!contactId}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Gerar sugestões
                  </Button>
                </div>
              ) : loadingSuggestions ? (
                <div className="flex flex-col items-center justify-center py-10 space-y-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/50" />
                  <p className="text-xs text-muted-foreground">Analisando conversa...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Target message indicator */}
                  {targetMessage && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 mb-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-semibold text-primary uppercase tracking-wider">
                          Respondendo a mensagem específica
                        </span>
                        <button
                          onClick={() => onTargetMessageClear?.()}
                          className="h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center"
                        >
                          <X className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </div>
                      <p className="text-xs text-foreground/80 line-clamp-2 italic">
                        "{targetMessage.content}"
                      </p>
                    </div>
                  )}

                  {suggestions.map((s, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-border/60 bg-muted/30 p-3 space-y-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70 bg-primary/10 px-2 py-0.5 rounded-full">
                          {s.label}
                        </span>
                      </div>

                      {editingIdx === idx ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="text-sm min-h-[60px] resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <Button size="sm" className="flex-1 gap-1.5 h-8" onClick={handleEditSend}>
                              <Send className="h-3 w-3" />
                              Enviar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => setEditingIdx(null)}
                            >
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                            {s.text}
                          </p>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="flex-1 gap-1.5 h-8"
                              onClick={() => handleApproveAndSend(s.text)}
                            >
                              <Check className="h-3 w-3" />
                              Enviar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 h-8"
                              onClick={() => handleEditStart(idx)}
                            >
                              <Pencil className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-2 mt-1"
                    onClick={() => generateSuggestions(targetMessage || undefined)}
                    disabled={loadingSuggestions}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Gerar novas sugestões
                  </Button>
                </div>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Chat messages */}
            <ScrollArea className="flex-1 p-4">
              <div ref={chatScrollRef} className="space-y-3">
                {chatMessages.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-2">
                    <Bot className="h-10 w-10 text-primary/30" />
                    <p className="text-xs text-muted-foreground max-w-[200px]">
                      Pergunte sobre preços, serviços ou peça ajuda para formular uma resposta
                    </p>
                  </div>
                )}
                {chatMessages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted/50 text-foreground"
                      }`}
                    >
                      {msg.role === "assistant" ? (
                        <div className="prose prose-sm max-w-none [&>p]:m-0">
                          <ReactMarkdown>{msg.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chatLoading && chatMessages[chatMessages.length - 1]?.role !== "assistant" && (
                  <div className="flex justify-start">
                    <div className="bg-muted/50 rounded-xl px-3 py-2">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>

            {/* Chat input */}
            <div className="border-t border-border/60 p-3 shrink-0">
              <div className="flex gap-2">
                <Textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendChatMessage();
                    }
                  }}
                  placeholder="Ex: Qual o preço da instalação 24k?"
                  className="min-h-[38px] max-h-[80px] text-sm resize-none"
                  disabled={chatLoading}
                />
                <Button
                  size="icon"
                  className="h-[38px] w-[38px] shrink-0"
                  onClick={sendChatMessage}
                  disabled={!chatInput.trim() || chatLoading}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
