import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

export function useAssistantChat() {
  const { session, organizationId } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load or create conversation
  useEffect(() => {
    if (!session?.user?.id || !organizationId) return;

    const loadConversation = async () => {
      setIsLoadingHistory(true);
      try {
        // Find existing conversation
        const { data: convs } = await supabase
          .from("assistant_conversations")
          .select("id")
          .eq("user_id", session.user.id)
          .eq("organization_id", organizationId)
          .order("updated_at", { ascending: false })
          .limit(1);

        let convId: string;
        if (convs && convs.length > 0) {
          convId = convs[0].id;
        } else {
          const { data: newConv, error: convError } = await supabase
            .from("assistant_conversations")
            .insert({ user_id: session.user.id, organization_id: organizationId })
            .select("id")
            .single();
          if (convError) throw convError;
          convId = newConv.id;
        }
        setConversationId(convId);

        // Load messages
        const { data: msgs } = await supabase
          .from("assistant_messages")
          .select("id, role, content, created_at")
          .eq("conversation_id", convId)
          .order("created_at", { ascending: true })
          .limit(100);

        if (msgs) {
          setMessages(
            msgs
              .filter((m) => m.role === "user" || m.role === "assistant")
              .map((m) => ({ id: m.id, role: m.role as "user" | "assistant", content: m.content }))
          );
        }
      } catch (err) {
        console.error("Error loading conversation:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadConversation();
  }, [session?.user?.id, organizationId]);

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim() || !organizationId || !session) return;
      setError(null);

      // Refresh session if needed
      const { data: refreshed } = await supabase.auth.getSession();
      const token = refreshed?.session?.access_token || session.access_token;

      const userMsg: ChatMessage = { role: "user", content: input.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      // Persist user message
      if (conversationId) {
        await supabase.from("assistant_messages").insert({
          conversation_id: conversationId,
          role: "user",
          content: userMsg.content,
        });
        await supabase
          .from("assistant_conversations")
          .update({ updated_at: new Date().toISOString() })
          .eq("id", conversationId);
      }

      // Build messages for API (last 20 messages for context)
      const historyForApi = [...messages.slice(-20), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let assistantContent = "";
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tecvo-chat`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ messages: historyForApi, organizationId }),
            signal: controller.signal,
          }
        );

        if (!resp.ok) {
          const errData = await resp.json().catch(() => ({}));
          const errMsg =
            resp.status === 429
              ? "Limite de requisições excedido. Aguarde um momento."
              : resp.status === 402
              ? "Créditos de IA esgotados."
              : errData.error || "Erro ao processar resposta.";
          setError(errMsg);
          setIsLoading(false);
          return;
        }

        if (!resp.body) throw new Error("No response body");

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamDone = false;

        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (line.startsWith(":") || line.trim() === "") continue;
            if (!line.startsWith("data: ")) continue;

            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantContent += content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant" && !last.id) {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: assistantContent } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: assistantContent }];
                });
              }
            } catch {
              buffer = line + "\n" + buffer;
              break;
            }
          }
        }

        // Flush remaining
        if (buffer.trim()) {
          for (let raw of buffer.split("\n")) {
            if (!raw) continue;
            if (raw.endsWith("\r")) raw = raw.slice(0, -1);
            if (raw.startsWith(":") || raw.trim() === "") continue;
            if (!raw.startsWith("data: ")) continue;
            const jsonStr = raw.slice(6).trim();
            if (jsonStr === "[DONE]") continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const content = parsed.choices?.[0]?.delta?.content as string | undefined;
              if (content) {
                assistantContent += content;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.role === "assistant" && !last.id) {
                    return prev.map((m, i) =>
                      i === prev.length - 1 ? { ...m, content: assistantContent } : m
                    );
                  }
                  return [...prev, { role: "assistant", content: assistantContent }];
                });
              }
            } catch {
              /* ignore */
            }
          }
        }

        // Persist assistant message
        if (conversationId && assistantContent) {
          await supabase.from("assistant_messages").insert({
            conversation_id: conversationId,
            role: "assistant",
            content: assistantContent,
          });
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          console.error("Chat stream error:", err);
          setError("Erro de conexão. Tente novamente.");
        }
      } finally {
        setIsLoading(false);
        abortRef.current = null;
      }
    },
    [messages, organizationId, session, conversationId]
  );

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const sendProactiveTip = useCallback(async () => {
    if (!organizationId || !session || isLoading) return;

    // Frequency control: 1 tip every 4 hours
    const storageKey = `tecvo_last_tip_${organizationId}`;
    const lastTip = localStorage.getItem(storageKey);
    const fourHours = 4 * 60 * 60 * 1000;
    if (lastTip && Date.now() - Number(lastTip) < fourHours) return;

    const { data: refreshed } = await supabase.auth.getSession();
    const token = refreshed?.session?.access_token || session.access_token;

    setIsLoading(true);
    let assistantContent = "";

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tecvo-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ messages: [], organizationId, mode: "proactive_tip" }),
        }
      );

      if (!resp.ok || !resp.body) {
        setIsLoading(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamDone = false;

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (line.startsWith(":") || line.trim() === "") continue;
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content as string | undefined;
            if (content) {
              assistantContent += content;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant" && !last.id) {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: "assistant", content: assistantContent }];
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      // Persist tip as assistant message
      if (conversationId && assistantContent) {
        await supabase.from("assistant_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: assistantContent,
        });
      }

      localStorage.setItem(storageKey, Date.now().toString());
      localStorage.setItem(`tecvo_unread_tip_${organizationId}`, "true");
    } catch (err) {
      console.error("Proactive tip error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [organizationId, session, isLoading, conversationId]);

  return { messages, isLoading, isLoadingHistory, error, sendMessage, cancelStream, sendProactiveTip };
}
