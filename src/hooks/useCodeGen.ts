import { useState, useCallback } from "react";
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

  const generateCode = useCallback(async (params: CodeGenParams) => {
    setIsGenerating(true);
    setFiles(null);
    setError(null);

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/app-code-gen`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify(params),
      });

      const data = await res.json();

      if (data.files) {
        setFiles(data.files);
      } else {
        setError(data.error || "Code generation failed.");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Code generation failed.");
    } finally {
      setIsGenerating(false);
    }
  }, []);

  const resetCode = useCallback(() => {
    setFiles(null);
    setError(null);
  }, []);

  return { files, isGenerating, error, generateCode, resetCode };
}
