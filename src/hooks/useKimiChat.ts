import { useState, useCallback, useRef } from "react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export interface KimiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface UseKimiChatParams {
  /** Override the model name sent to Moonshot. */
  model?: string;
  /** Override max output tokens. */
  maxTokens?: number;
  /** Override sampling temperature. */
  temperature?: number;
}

const FALLBACK_ERROR = "Kimi service is unavailable. Please try again.";

/**
 * Streaming chat hook for the custom Kimi / Moonshot integration.
 * Parses OpenAI-compatible `chat.completion.chunk` SSE frames with a hand-rolled
 * reader (no fetchEventSource) for maximum tolerance of the user's own endpoint.
 */
export function useKimiChat() {
  const [messages, setMessagesState] = useState<KimiMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<KimiMessage[]>([]);
  const isGeneratingRef = useRef(false);

  // Single source of truth: keep ref + state in sync on every mutation.
  const commit = useCallback(
    (next: KimiMessage[] | ((prev: KimiMessage[]) => KimiMessage[])) => {
      const resolved =
        typeof next === "function" ? next(messagesRef.current) : next;
      messagesRef.current = resolved;
      setMessagesState(resolved);
    },
    [],
  );

  const removeEmptyAssistantTail = useCallback(() => {
    commit((prev) => {
      const next = [...prev];
      const last = next[next.length - 1];
      if (last && last.role === "assistant" && last.content === "") next.pop();
      return next;
    });
  }, [commit]);

  const send = useCallback(
    async (input: string, options: UseKimiChatParams = {}) => {
      const trimmed = input.trim();
      if (!trimmed || isGeneratingRef.current) return;

      const userMessage: KimiMessage = { role: "user", content: trimmed };
      // History sent upstream excludes the empty assistant placeholder.
      const history = [...messagesRef.current, userMessage];

      commit([...history, { role: "assistant", content: "" }]);
      setError(null);
      isGeneratingRef.current = true;
      setIsGenerating(true);

      abortRef.current?.abort();
      abortRef.current = new AbortController();

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/kimi-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: history,
            model: options.model,
            max_tokens: options.maxTokens,
            temperature: options.temperature,
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE events are separated by a blank line.
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const evt of events) {
            const lines = evt.split("\n");
            let dataLine = "";
            let isErrorEvent = false;
            for (const line of lines) {
              if (line.startsWith("event:") && line.includes("error")) {
                isErrorEvent = true;
              }
              if (line.startsWith("data:")) {
                dataLine += line.slice(5).trimStart();
              }
            }
            if (!dataLine) continue;

            if (dataLine.trim() === "[DONE]") {
              isGeneratingRef.current = false;
              setIsGenerating(false);
              return;
            }

            let data: {
              error?: { message?: string; type?: string };
              choices?: {
                delta?: { content?: string };
                finish_reason?: string | null;
              }[];
            };
            try {
              data = JSON.parse(dataLine);
            } catch {
              continue; // skip malformed frame
            }

            if (isErrorEvent) {
              setError(data.error?.message || FALLBACK_ERROR);
              isGeneratingRef.current = false;
              setIsGenerating(false);
              removeEmptyAssistantTail();
              return;
            }

            const delta = data.choices?.[0]?.delta?.content;
            if (delta) {
              accumulated += delta;
              const snapshot = accumulated;
              commit((prev) => {
                const next = [...prev];
                next[next.length - 1] = { role: "assistant", content: snapshot };
                return next;
              });
            }

            if (data.choices?.[0]?.finish_reason) {
              isGeneratingRef.current = false;
              setIsGenerating(false);
              return;
            }
          }
        }

        // Stream closed without an explicit [DONE] / finish_reason.
        isGeneratingRef.current = false;
        setIsGenerating(false);
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") {
          // User stopped the stream — keep any partial content.
          isGeneratingRef.current = false;
          setIsGenerating(false);
          removeEmptyAssistantTail();
          return;
        }
        setError(err instanceof Error ? err.message : FALLBACK_ERROR);
        isGeneratingRef.current = false;
        setIsGenerating(false);
        removeEmptyAssistantTail();
      }
    },
    [commit, removeEmptyAssistantTail],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    setIsGenerating(false);
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    isGeneratingRef.current = false;
    commit([]);
    setError(null);
    setIsGenerating(false);
  }, [commit]);

  return { messages, isGenerating, error, send, stop, clear };
}
