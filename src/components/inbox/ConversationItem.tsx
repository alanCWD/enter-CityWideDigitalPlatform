import { cn } from "@/lib/utils";
import { PlatformBadge } from "./PlatformBadge";
import { type InboxConversation } from "@/hooks/useInboxConversations";

function timeAgo(ts: string): string {
  try {
    const diff = (Date.now() - new Date(ts).getTime()) / 1000;
    if (diff < 60)    return "now";
    if (diff < 3600)  return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

interface ConversationItemProps {
  conversation: InboxConversation;
  isSelected: boolean;
  onClick: () => void;
}

export function ConversationItem({ conversation: conv, isSelected, onClick }: ConversationItemProps) {
  const initials = conv.contact.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-accent border border-transparent",
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-muted-foreground overflow-hidden">
          {conv.contact.avatarUrl ? (
            <img
              src={conv.contact.avatarUrl}
              alt={conv.contact.name}
              className="w-10 h-10 object-cover"
            />
          ) : (
            initials
          )}
        </div>
        <div className="absolute -bottom-0.5 -right-1">
          <PlatformBadge platform={conv.platform} />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <span
            className={cn(
              "text-sm truncate",
              conv.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground/90",
            )}
          >
            {conv.contact.name}
          </span>
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {conv.lastMessage ? timeAgo(conv.lastMessage.timestamp) : ""}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <p
            className={cn(
              "text-xs truncate flex-1",
              conv.unreadCount > 0
                ? "text-foreground font-medium"
                : "text-muted-foreground",
            )}
          >
            {conv.lastMessage?.direction === "out" && (
              <span className="opacity-60">You: </span>
            )}
            {conv.lastMessage?.text ?? ""}
          </p>
          {conv.unreadCount > 0 && (
            <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
              {conv.unreadCount > 9 ? "9+" : conv.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
