import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface InboxContact {
  id: string;
  name: string;
  username?: string;
  avatarUrl?: string;
}

export interface InboxLastMessage {
  text: string;
  timestamp: string;
  direction: "in" | "out";
}

export interface InboxConversation {
  id: string;
  platform: string;
  accountId: string;
  contact: InboxContact;
  lastMessage?: InboxLastMessage;
  unreadCount: number;
  updatedAt: string;
}

export function useInboxConversations(
  profileId: string | null,
  platform?: string,
  search?: string,
) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("social-rpc", {
        body: {
          action: "inbox.conversations.list",
          payload: {
            profile_id: profileId,
            ...(platform ? { platform } : {}),
            limit: 50,
          },
        },
      });
      if (fnErr) throw new Error(fnErr.message);
      if (data?.error) throw new Error(data.error);
      setConversations((data?.conversations ?? []) as InboxConversation[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [profileId, platform]);

  useEffect(() => {
    load();
    timerRef.current = setInterval(load, 10_000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [load]);

  const filtered = search
    ? conversations.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.contact.name.toLowerCase().includes(q) ||
          (c.contact.username ?? "").toLowerCase().includes(q) ||
          (c.lastMessage?.text ?? "").toLowerCase().includes(q)
        );
      })
    : conversations;

  return { conversations: filtered, loading, error, reload: load };
}
