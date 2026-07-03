import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InboxMessage {
  id: string;
  direction: "in" | "out";
  text: string;
  timestamp: string;
  status?: "sent" | "delivered" | "read" | "failed";
  mediaUrl?: string;
  mediaType?: "image" | "video" | "audio" | "file";
}

export function useInboxMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!conversationId) return;
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("social-rpc", {
        body: {
          action: "inbox.messages.list",
          payload: { conversation_id: conversationId },
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setMessages((data?.messages ?? []) as InboxMessage[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    setMessages([]);
    setError(null);
    if (!conversationId) return;
    setLoading(true);
    load();
    timerRef.current = setInterval(load, 5_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load, conversationId]);

  return { messages, loading, error, reload: load };
}
