import { useState } from "react";
import { Search, RefreshCw, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationItem } from "./ConversationItem";
import { useInboxConversations } from "@/hooks/useInboxConversations";
import { cn } from "@/lib/utils";

const PLATFORM_FILTERS = [
  { label: "All",      value: ""          },
  { label: "WA",       value: "whatsapp"  },
  { label: "IG",       value: "instagram" },
  { label: "MG",       value: "messenger" },
  { label: "TG",       value: "telegram"  },
  { label: "X",        value: "twitter"   },
  { label: "Reddit",   value: "reddit"    },
  { label: "Bluesky",  value: "bluesky"   },
];

interface ConversationListProps {
  profileId: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ profileId, selectedId, onSelect }: ConversationListProps) {
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("");
  const { conversations, loading, error, reload } = useInboxConversations(
    profileId,
    platform,
    search,
  );

  return (
    <div className="flex flex-col h-full border-r border-border">
      {/* Header */}
      <div className="p-3 border-b border-border space-y-2 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search conversations…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 flex-shrink-0"
            onClick={reload}
            disabled={loading}
          >
            <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
          </Button>
        </div>

        {/* Platform filters */}
        <div className="flex gap-1 flex-wrap">
          {PLATFORM_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setPlatform(f.value)}
              className={cn(
                "px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wide transition-colors",
                platform === f.value
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/20 hover:text-foreground",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {loading && conversations.length === 0 && (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              <span className="text-sm">Loading…</span>
            </div>
          )}
          {!loading && error && (
            <div className="px-3 py-6 text-center space-y-1">
              <p className="text-xs text-destructive">Failed to load</p>
              <p className="text-[11px] text-muted-foreground">{error}</p>
            </div>
          )}
          {!loading && !error && conversations.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No conversations found.
            </div>
          )}
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onClick={() => onSelect(conv.id)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
