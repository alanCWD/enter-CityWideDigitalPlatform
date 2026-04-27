import { useState, useCallback, useRef } from "react";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";

export interface CodeGenParams {
  blueprint: string;
  niche: string;
  tier: string;
  clientName: string;
  template: string;
}

export function useCodeGen() {
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const generateCode = useCallback(async (params: CodeGenParams) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setIsGenerating(true);
    setFiles(null);
    setError(null);
    setProgress(0);

    let accumulated = "";

    const parseDelimitedFiles = (raw: string): Record<string, string> | null => {
      // Format: ===FILE:path===\n<content>\n===END===
      // Robust to surrounding markdown fences or text
      const cleaned = raw.replace(/^```[a-z]*\n?/i, "").replace(/\n?```\s*$/, "");
      const files: Record<string, string> = {};
      const regex = /===FILE:([^=]+?)===\s*\n([\s\S]*?)\n===END===/g;
      let match;
      while ((match = regex.exec(cleaned)) !== null) {
        const path = match[1].trim();
        const content = match[2];
        if (path) files[path] = content;
      }
      return Object.keys(files).length > 0 ? files : null;
    };

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/app-code-gen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(params),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`Code generation failed: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events (separated by blank line)
        const events = buffer.split("\n\n");
        buffer = events.pop() || ""; // last (possibly incomplete) chunk stays in buffer

        for (const evt of events) {
          // Extract the data line(s)
          const lines = evt.split("\n");
          let dataLine = "";
          let isErrorEvent = false;
          for (const line of lines) {
            if (line.startsWith("event:") && line.includes("error")) isErrorEvent = true;
            if (line.startsWith("data:")) {
              dataLine += line.slice(5).trimStart();
            }
          }
          if (!dataLine) continue;

          let data: { type?: string; delta?: { text?: string; type?: string }; error?: { message?: string; type?: string } };
          try {
            data = JSON.parse(dataLine);
          } catch {
            continue; // skip malformed
          }

          if (isErrorEvent || data.type === "error") {
            setError(data.error?.message || "AI returned an error.");
            setIsGenerating(false);
            return;
          }

          if (data.type === "content_block_delta" && data.delta?.text) {
            accumulated += data.delta.text;
            setProgress(accumulated.length);
          }

          if (data.type === "message_stop") {
            const parsed = parseDelimitedFiles(accumulated);
            if (parsed) {
              setFiles(parsed);
            } else {
              setError("AI returned malformed output. Try again.");
            }
            setIsGenerating(false);
            return;
          }
        }
      }

      // Stream ended without message_stop — try parsing what we have
      if (accumulated) {
        const parsed = parseDelimitedFiles(accumulated);
        if (parsed) {
          setFiles(parsed);
        } else {
          setError("Stream ended unexpectedly with malformed output.");
        }
      } else {
        setError("Stream ended with no output.");
      }
      setIsGenerating(false);
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
