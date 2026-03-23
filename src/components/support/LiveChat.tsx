import { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SupportCard } from "./SupportCard";

interface Message {
  id: string;
  content: string;
  sender_type: "user" | "support";
  created_at: string;
}

export function LiveChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();

  // Load or create conversation
  useEffect(() => {
    if (isOpen && user) {
      loadOrCreateConversation();
    }
  }, [isOpen, user]);

  // Subscribe to realtime messages
  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`support_messages_${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Avoid duplicates
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadOrCreateConversation = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Try to find existing open conversation
      const { data: existingConversation, error: fetchError } = await supabase
        .from("support_conversations")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      let convId = existingConversation?.id;

      if (!convId) {
        // Create new conversation
        const { data: newConversation, error: createError } = await supabase
          .from("support_conversations")
          .insert({ user_id: user.id })
          .select("id")
          .single();

        if (createError) throw createError;
        convId = newConversation.id;

        // Add welcome message from support
        setMessages([
          {
            id: "welcome",
            content: "Olá! Como posso ajudar você hoje?",
            sender_type: "support",
            created_at: new Date().toISOString(),
          },
        ]);
      } else {
        // Load existing messages
        const { data: existingMessages, error: messagesError } = await supabase
          .from("support_messages")
          .select("*")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true });

        if (messagesError) throw messagesError;
        
        if (existingMessages && existingMessages.length > 0) {
          setMessages(
            existingMessages.map((m) => ({
              id: m.id,
              content: m.content,
              sender_type: m.sender_type as "user" | "support",
              created_at: m.created_at,
            }))
          );
        } else {
          setMessages([
            {
              id: "welcome",
              content: "Olá! Como posso ajudar você hoje?",
              sender_type: "support",
              created_at: new Date().toISOString(),
            },
          ]);
        }
      }

      setConversationId(convId);
    } catch (error) {
      console.error("Error loading conversation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !conversationId) return;

    const messageContent = newMessage.trim();
    setNewMessage("");

    // Optimistic update
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      content: messageContent,
      sender_type: "user",
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMessage]);

    try {
      const { error } = await supabase.from("support_messages").insert({
        conversation_id: conversationId,
        content: messageContent,
        sender_type: "user",
      });

      if (error) throw error;
    } catch (error) {
      console.error("Error sending message:", error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempMessage.id));
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!user) {
    return (
      <SupportCard
        icon={MessageSquare}
        title="Chat ao Vivo"
        description="Atendimento em tempo real. Faça login para usar o chat."
        buttonText="Fazer Login"
        onClick={() => (window.location.href = "/login")}
        variant="chat"
      />
    );
  }

  return (
    <>
      {/* Card trigger */}
      {!isOpen && (
        <SupportCard
          icon={MessageSquare}
          title="Chat ao Vivo"
          description="Atendimento em tempo real. Tire suas dúvidas agora."
          buttonText="Iniciar Chat"
          onClick={() => setIsOpen(true)}
          variant="chat"
        />
      )}

      {/* Floating chat widget */}
      {isOpen && (
        <div className="fixed bottom-4 right-4 z-50 w-80 sm:w-96 h-[500px] bg-card rounded-lg shadow-xl border border-border flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-blue-600 text-white p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              <span className="font-medium">Suporte Tecvo</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsOpen(false)}
              className="h-8 w-8 text-white hover:bg-blue-700"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "max-w-[80%] p-3 rounded-lg",
                      message.sender_type === "user"
                        ? "ml-auto bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    )}
                  >
                    <p className="text-sm">{message.content}</p>
                    <span className="text-2xs opacity-70 mt-1 block">
                      {new Date(message.created_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Input */}
          <div className="p-3 border-t border-border bg-background">
            <div className="flex gap-2">
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Digite sua mensagem..."
                className="flex-1"
              />
              <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
