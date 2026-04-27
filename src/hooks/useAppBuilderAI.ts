import { useState, useRef, useCallback } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export interface BuilderConfig {
  niche: string;
  tier: string;
  mode: "template" | "copy";
  gbp: boolean;
  preset: string | null;
  competitorUrl: string;
  customPrompt: string;
  clientName: string;
}

const FALLBACK_MESSAGES: Record<string, string> = {
  authentication_error: "Authentication failed. Please refresh the page.",
  rate_limit_error: "Too many requests. Please try again later.",
  invalid_request_error: "Invalid request. Please try again.",
  overloaded_error: "Service is busy. Please try again later.",
  insufficient_credits: "AI credits exhausted. Please contact your administrator.",
  permission_error: "AI capability is disabled. Please contact your administrator.",
  api_error: "Service temporarily unavailable.",
};

function getErrorMessage(code: string, backendMessage: string): string {
  if (backendMessage) return backendMessage;
  return FALLBACK_MESSAGES[code] || "Service temporarily unavailable.";
}

export function useAppBuilderAI() {
  const [output, setOutput] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(async (config: BuilderConfig) => {
    abortRef.current = new AbortController();
    setOutput("");
    setError(null);
    setIsDone(false);
    setIsGenerating(true);

    const blocks = new Map<number, { type: string; content: string }>();

    try {
      await fetchEventSource(`${SUPABASE_URL}/functions/v1/app-builder-ai`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(config),
        signal: abortRef.current.signal,

        async onopen(response) {
          const contentType = response.headers.get("content-type");
          if (!response.ok) {
            if (contentType?.includes("text/event-stream")) {
              const text = await response.text();
              const dataMatch = text.match(/data: (.+)/);
              if (dataMatch) {
                try {
                  const errData = JSON.parse(dataMatch[1]);
                  if (errData.type === "error" && errData.error?.message) {
                    throw new Error(errData.error.message);
                  }
                } catch (e) {
                  if (e instanceof Error && e.message !== "Unexpected token") throw e;
                }
              }
            }
            if (contentType?.includes("application/json")) {
              const errData = await response.json();
              throw new Error(errData.error?.message || `Request failed: ${response.status}`);
            }
            throw new Error(`Request failed: ${response.status}`);
          }
        },

        onmessage(ev) {
          if (!ev.data) return;
          let data: { type: string; index: number; content_block: { type: string }; delta: { text?: string; thinking?: string }; error?: { type?: string; message?: string } };
          try { data = JSON.parse(ev.data); } catch { return; }

          if (data.type === "error") {
            setError(getErrorMessage(data.error?.type || "api_error", data.error?.message || ""));
            setIsGenerating(false);
            return;
          }

          switch (data.type) {
            case "content_block_start":
              blocks.set(data.index, { type: data.content_block.type, content: "" });
              break;
            case "content_block_delta": {
              const block = blocks.get(data.index);
              if (block?.type === "text") {
                block.content += data.delta.text || "";
                setOutput(block.content);
              }
              break;
            }
            case "message_stop":
              setIsDone(true);
              break;
          }
        },

        onerror(err) { throw err; },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Generation failed.");
      } else if (typeof err === "string") {
        setError(err);
      }
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const reset = useCallback(() => {
    setOutput("");
    setError(null);
    setIsDone(false);
  }, []);

  return { output, isGenerating, error, isDone, generate, cancel, reset };
}
