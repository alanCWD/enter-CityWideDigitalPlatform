import { useState, useCallback, useRef } from "react";
import { fetchEventSource } from "@microsoft/fetch-event-source";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export interface CodeGenParams {
  blueprint: string;
  niche: string;
  tier: string;
  clientName: string;
  template: string;
}

interface SSEData {
  type?: string;
  delta?: { type?: string; text?: string };
  error?: { type?: string; message?: string };
}

export function useCodeGen() {
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0); // approximate streamed char count
  const abortRef = useRef<AbortController | null>(null);

  const generateCode = useCallback(async (params: CodeGenParams) => {
    setIsGenerating(true);
    setFiles(null);
    setError(null);
    setProgress(0);

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    let accumulated = "";

    try {
      await fetchEventSource(`${SUPABASE_URL}/functions/v1/app-code-gen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(params),
        signal: abortRef.current.signal,
        openWhenHidden: true,

        async onopen(response) {
          if (!response.ok) {
            throw new Error(`Code generation failed: ${response.status}`);
          }
        },

        onmessage(ev) {
          if (!ev.data) return;
          try {
            const data: SSEData = JSON.parse(ev.data);

            if (data.type === "content_block_delta" && data.delta?.text) {
              accumulated += data.delta.text;
              setProgress(accumulated.length);
            }

            if (data.type === "error") {
              setError(data.error?.message || "AI returned an error.");
              setIsGenerating(false);
              abortRef.current?.abort();
            }

            if (data.type === "message_stop") {
              // Parse accumulated JSON
              let cleaned = accumulated.trim();
              if (cleaned.startsWith("```")) {
                cleaned = cleaned.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
              }
              try {
                const parsed = JSON.parse(cleaned);
                setFiles(parsed);
              } catch {
                const jsonMatch = cleaned.match(/\{[\s\S]+\}/);
                if (jsonMatch) {
                  try {
                    setFiles(JSON.parse(jsonMatch[0]));
                  } catch {
                    setError("AI returned invalid JSON.");
                  }
                } else {
                  setError("AI did not return valid JSON.");
                }
              }
              setIsGenerating(false);
            }
          } catch {
            /* ignore non-JSON SSE frames */
          }
        },

        onerror(err) {
          throw err;
        },
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message || "Code generation failed.");
      }
      setIsGenerating(false);
    }
  }, []);

  const cancelCode = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
  }, []);

  const resetCode = useCallback(() => {
    abortRef.current?.abort();
    setFiles(null);
    setError(null);
    setProgress(0);
  }, []);

  return { files, isGenerating, error, progress, generateCode, cancelCode, resetCode };
}
