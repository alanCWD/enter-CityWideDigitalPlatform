import { Zap, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const SAMPLE_AUTOMATIONS = [
  {
    id: "1",
    name: "Comment → DM Promo Code",
    trigger: "Any Instagram comment",
    replies: 89,
    active: true,
  },
  {
    id: "2",
    name: "Keyword: 'price'",
    trigger: "Facebook comment containing 'price'",
    replies: 12,
    active: false,
  },
  {
    id: "3",
    name: "Story reply → Welcome DM",
    trigger: "Instagram story reply",
    replies: 34,
    active: true,
  },
];

export function AutomationsPanel() {
  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Comment-to-DM Automations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically send a DM when someone comments on your posts
          </p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
          <Plus className="w-3.5 h-3.5" />
          New Automation
        </Button>
      </div>
      <div className="space-y-2">
        {SAMPLE_AUTOMATIONS.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                  a.active ? "bg-primary/10" : "bg-muted",
                )}
              >
                <Zap
                  className={cn(
                    "w-4 h-4",
                    a.active ? "text-primary" : "text-muted-foreground",
                  )}
                />
              </div>
              <div>
                <p className="text-sm font-medium">{a.name}</p>
                <p className="text-xs text-muted-foreground">
                  {a.trigger} · {a.replies} DMs sent
                </p>
              </div>
            </div>
            <Switch checked={a.active} />
          </div>
        ))}
      </div>
    </div>
  );
}
