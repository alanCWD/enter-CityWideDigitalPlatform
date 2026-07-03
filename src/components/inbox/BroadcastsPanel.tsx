import { Radio, Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const SAMPLE_BROADCASTS = [
  { id: "1", name: "Summer Sale Announcement", platform: "Instagram", status: "draft",  recipients: 0   },
  { id: "2", name: "Welcome New Followers",     platform: "WhatsApp",  status: "sent",   recipients: 347 },
  { id: "3", name: "Holiday Promo Code",        platform: "Telegram",  status: "scheduled", recipients: 120 },
];

export function BroadcastsPanel() {
  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Broadcasts</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Send mass DMs to your contact segments</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
          <Plus className="w-3.5 h-3.5" />
          New Broadcast
        </Button>
      </div>
      <div className="space-y-2">
        {SAMPLE_BROADCASTS.map((b) => (
          <div
            key={b.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Radio className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{b.name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.platform} · {b.recipients.toLocaleString()} recipients
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] capitalize">{b.status}</Badge>
              {b.status === "draft" && (
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                  <Send className="w-3 h-3" />
                  Send
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
