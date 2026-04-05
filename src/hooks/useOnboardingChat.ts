import { useState, useCallback, useRef } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface OnboardingData {
  company_name?: string;
  main_service?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/onboarding-chat`;

export function useOnboardingChat(userName: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [extractedData, setExtractedData] = useState<OnboardingData>({});
  const [showActivate, setShowActivate] = useState(false);
  const dataRef = useRef<OnboardingData>({});
  const abortRef = useRef<AbortController | null>(null);

  const streamChat = useCallback(
    async (allMessages: ChatMessage[]) => {
      // Abort any previous stream
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);

      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ messages: allMessages, userName }),
          signal: controller.signal,
        });

        if (!resp.ok || !resp.body) {
          console.error("Onboarding chat: response not ok", resp.status);
          throw new Error("Stream failed");
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let assistantContent = "";
        let toolCallArgs = "";

        const updateAssistant = (content: string) => {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
              return prev.map((m, i) =>
                i === prev.length - 1 ? { ...m, content } : m
              );
            }
            return [...prev, { role: "assistant", content }];
          });
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let idx: number;
          while ((idx = buffer.indexOf("\n")) !== -1) {
            let line = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 1);
            if (line.endsWith("\r")) line = line.slice(0, -1);
            if (!line.startsWith("data: ")) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === "[DONE]") break;

            try {
              const parsed = JSON.parse(jsonStr);
              const delta = parsed.choices?.[0]?.delta;

              // Handle tool calls
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  if (tc.function?.arguments) {
                    toolCallArgs += tc.function.arguments;
                  }
                }
                continue;
              }

              // Handle content
              const content = delta?.content;
              if (content) {
                assistantContent += content;
                if (assistantContent.includes("{{ACTIVATE}}")) {
                  assistantContent = assistantContent.replace("{{ACTIVATE}}", "").trim();
                  if (assistantContent) updateAssistant(assistantContent);
                  setShowActivate(true);
                } else {
                  updateAssistant(assistantContent);
                }
              }
            } catch {
              // Ignore parse errors on partial chunks
            }
          }
        }

        // Process tool call data
        if (toolCallArgs) {
          try {
            const data = JSON.parse(toolCallArgs);
            const newData = { ...dataRef.current };
            if (data.company_name) newData.company_name = data.company_name;
            if (data.main_service) newData.main_service = data.main_service;
            dataRef.current = newData;
            setExtractedData(newData);
          } catch {
            // ignore
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Onboarding chat error:", err);
      } finally {
        setIsLoading(false);
      }
    },
    [userName]
  );

  const sendMessage = useCallback(
    (content: string) => {
      const userMsg: ChatMessage = { role: "user", content };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      streamChat(newMessages);
    },
    [messages, streamChat]
  );

  const startConversation = useCallback(() => {
    streamChat([]);
  }, [streamChat]);

  return {
    messages,
    isLoading,
    extractedData,
    showActivate,
    sendMessage,
    startConversation,
  };
}
