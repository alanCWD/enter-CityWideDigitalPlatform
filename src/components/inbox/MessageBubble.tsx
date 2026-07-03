import { cn } from "@/lib/utils";
import { Check, CheckCheck, AlertCircle } from "lucide-react";
import { type InboxMessage } from "@/hooks/useInboxMessages";

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function StatusTick({ status }: { status?: InboxMessage["status"] }) {
  if (!status) return null;
  if (status === "failed")   return <AlertCircle className="w-3 h-3 text-destructive" />;
  if (status === "read")     return <CheckCheck className="w-3 h-3 text-primary" />;
  if (status === "delivered") return <CheckCheck className="w-3 h-3 text-muted-foreground" />;
  return <Check className="w-3 h-3 text-muted-foreground" />;
}

interface MessageBubbleProps {
  message: InboxMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOut = message.direction === "out";
  return (
    <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[72%] rounded-2xl px-3.5 py-2 text-sm shadow-sm",
          isOut
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted text-foreground rounded-bl-sm",
        )}
      >
        {message.text && (
          <p className="leading-relaxed whitespace-pre-wrap">{message.text}</p>
        )}
        <div
          className={cn(
            "flex items-center gap-1 mt-0.5",
            isOut ? "justify-end" : "justify-start",
          )}
        >
          <span
            className={cn(
              "text-[10px]",
              isOut ? "text-primary-foreground/60" : "text-muted-foreground",
            )}
          >
            {formatTime(message.timestamp)}
          </span>
          {isOut && <StatusTick status={message.status} />}
        </div>
      </div>
    </div>
  );
}
