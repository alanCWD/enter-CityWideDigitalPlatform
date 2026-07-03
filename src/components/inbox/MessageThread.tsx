import { useRef, useEffect, useState } from "react";
import { Send, Loader2, MessageSquareDashed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./MessageBubble";
import { useInboxMessages, type InboxMessage } from "@/hooks/useInboxMessages";
import { supabase } from "@/integrations/supabase/client";

interface MessageThreadProps {
  conversationId: string | null;
}

export function MessageThread({ conversationId }: MessageThreadProps) {
  const { messages, loading, reload } = useInboxMessages(conversationId);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [optimistic, setOptimistic] = useState<InboxMessage[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom whenever messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, optimistic]);

  // Clear draft when switching conversations
  useEffect(() => {
    setText("");
    setOptimistic([]);
  }, [conversationId]);

  async function handleSend() {
    if (!text.trim() || !conversationId || sending) return;
    const msg = text.trim();
    setText("");
    const tempId = `opt-${Date.now()}`;
    setOptimistic((prev) => [
      ...prev,
      {
        id: tempId,
        direction: "out",
        text: msg,
        timestamp: new Date().toISOString(),
        status: "sent",
      } satisfies InboxMessage,
    ]);
    setSending(true);
    try {
      await supabase.functions.invoke("social-rpc", {
        body: {
          action: "inbox.message.send",
          payload: { conversation_id: conversationId, message: msg },
        },
      });
      // Reconcile after 1 s
      setTimeout(() => {
        reload();
        setOptimistic([]);
      }, 1000);
    } catch {
      setOptimistic((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: "failed" as const } : m)),
      );
    } finally {
      setSending(false);
    }
  }

  if (!conversationId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <MessageSquareDashed className="w-10 h-10 opacity-30" />
        <p className="text-sm">Select a conversation to start messaging</p>
      </div>
    );
  }

  const allMessages = [...messages, ...optimistic].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
            <span className="text-sm">Loading messages…</span>
          </div>
        )}
        <div className="space-y-2">
          {allMessages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
        </div>
        <div ref={bottomRef} />
      </ScrollArea>

      {/* Compose */}
      <div className="border-t border-border p-3 flex gap-2 items-end flex-shrink-0">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message… (Enter to send, Shift+Enter for new line)"
          className="min-h-[40px] max-h-32 resize-none text-sm"
          rows={1}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button
          size="icon"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="flex-shrink-0 h-9 w-9"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
