import { useMemo } from "react";
import { cn } from "@/lib/utils";

export interface CalPost {
  id: string;
  title: string;
  content: string;
  platforms: string[];
  scheduled_at: string | null;
  status: string;
}

interface Props {
  year: number;
  month: number; // 0-indexed
  posts: CalPost[];
  onDayClick: (date: string) => void;
  onPostClick: (post: CalPost) => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-primary/15 text-primary",
  published: "bg-green-500/15 text-green-700 dark:text-green-400",
};

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarMonthView({ year, month, posts, onDayClick, onPostClick }: Props) {
  const { days, startOffset } = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { days: daysInMonth, startOffset: firstDay };
  }, [year, month]);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const postsForDay = (day: number): CalPost[] => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return posts.filter((p) => p.scheduled_at?.startsWith(dateStr));
  };

  const isoDate = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const cells = Array.from({ length: startOffset + days }, (_, i) =>
    i < startOffset ? null : i - startOffset + 1
  );

  return (
    <div className="flex flex-col gap-0">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_LABELS.map((d) => (
          <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 flex-1">
        {cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="min-h-[100px] border-b border-r border-border/40 bg-muted/20" />;
          }
          const dayPosts = postsForDay(day);
          return (
            <div
              key={day}
              onClick={() => onDayClick(isoDate(day))}
              className={cn(
                "min-h-[100px] p-1.5 border-b border-r border-border/40 cursor-pointer transition-colors hover:bg-accent/40",
                isToday(day) && "bg-primary/5"
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium mb-1",
                  isToday(day)
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {day}
              </span>
              <div className="space-y-0.5">
                {dayPosts.slice(0, 3).map((post) => (
                  <button
                    key={post.id}
                    onClick={(e) => { e.stopPropagation(); onPostClick(post); }}
                    className={cn(
                      "w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate font-medium",
                      STATUS_STYLES[post.status] ?? STATUS_STYLES.draft
                    )}
                  >
                    {post.title || post.content.slice(0, 30)}
                  </button>
                ))}
                {dayPosts.length > 3 && (
                  <p className="text-[10px] text-muted-foreground pl-1">
                    +{dayPosts.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
