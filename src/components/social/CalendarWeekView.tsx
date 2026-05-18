import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { CalPost } from "./CalendarMonthView";

interface Props {
  weekStart: Date; // Monday of the week
  posts: CalPost[];
  onDayClick: (date: string) => void;
  onPostClick: (post: CalPost) => void;
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-muted-foreground/30",
  scheduled: "bg-primary/10 text-primary border-primary/40",
  published: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/40",
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function CalendarWeekView({ weekStart, posts, onDayClick, onPostClick }: Props) {
  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const today = new Date().toDateString();

  const postsForDay = (day: Date) =>
    posts.filter((p) => p.scheduled_at?.startsWith(isoDate(day)));

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="grid grid-cols-7 border-b border-border">
        {days.map((day, i) => {
          const isToday = day.toDateString() === today;
          return (
            <div
              key={i}
              className="py-3 text-center"
            >
              <p className="text-xs font-medium text-muted-foreground">{DAY_NAMES[i]}</p>
              <span
                className={cn(
                  "inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold mt-0.5",
                  isToday
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground"
                )}
              >
                {day.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Post lanes */}
      <div className="grid grid-cols-7 min-h-[400px]">
        {days.map((day, i) => {
          const dayPosts = postsForDay(day);
          return (
            <div
              key={i}
              onClick={() => onDayClick(isoDate(day))}
              className={cn(
                "border-r border-border/40 p-2 cursor-pointer transition-colors hover:bg-accent/30 space-y-1.5",
                day.toDateString() === today && "bg-primary/5"
              )}
            >
              {dayPosts.length === 0 && (
                <div className="flex items-center justify-center h-full min-h-[80px]">
                  <span className="text-xs text-muted-foreground/50">+</span>
                </div>
              )}
              {dayPosts.map((post) => (
                <button
                  key={post.id}
                  onClick={(e) => { e.stopPropagation(); onPostClick(post); }}
                  className={cn(
                    "w-full text-left text-xs px-2 py-2 rounded border font-medium transition-opacity hover:opacity-80",
                    STATUS_STYLES[post.status] ?? STATUS_STYLES.draft
                  )}
                >
                  <div className="truncate">{post.title || post.content.slice(0, 40)}</div>
                  {post.scheduled_at && (
                    <div className="text-[10px] opacity-70 mt-0.5">
                      {new Date(post.scheduled_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {post.platforms.slice(0, 3).map((p) => (
                      <span key={p} className="text-[9px] bg-background/50 rounded px-1 capitalize">
                        {p.replace("_", " ")}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
