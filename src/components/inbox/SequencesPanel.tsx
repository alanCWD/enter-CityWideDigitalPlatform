import { ListOrdered, Plus, Play, Pause, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const SAMPLE_SEQUENCES = [
  { id: "1", name: "New Lead Nurture",   steps: 5, enrollments: 23, status: "active"   },
  { id: "2", name: "Win-Back Campaign",  steps: 3, enrollments: 0,  status: "paused"   },
  { id: "3", name: "Post-Sale Follow-Up", steps: 4, enrollments: 58, status: "active"  },
];

export function SequencesPanel() {
  return (
    <div className="p-4 space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Sequences</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Drip DM campaigns with timed follow-ups</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs h-7">
          <Plus className="w-3.5 h-3.5" />
          New Sequence
        </Button>
      </div>
      <div className="space-y-2">
        {SAMPLE_SEQUENCES.map((s) => (
          <div
            key={s.id}
            className="flex items-center justify-between p-3 rounded-lg border border-border bg-card"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <ListOrdered className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-medium">{s.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{s.steps} steps</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {s.enrollments} enrolled
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] capitalize",
                  s.status === "active" &&
                    "text-green-600 dark:text-green-400 border-green-500/40 bg-green-500/10",
                )}
              >
                {s.status}
              </Badge>
              <Button size="icon" variant="ghost" className="h-7 w-7">
                {s.status === "active" ? (
                  <Pause className="w-3.5 h-3.5" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
