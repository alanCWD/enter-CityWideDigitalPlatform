import { useState, useEffect, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, ChevronRight, Plus, CalendarDays, LayoutGrid, List } from "lucide-react";
import { CalendarMonthView } from "@/components/social/CalendarMonthView";
import { CalendarWeekView } from "@/components/social/CalendarWeekView";
import { PostListView } from "@/components/social/PostListView";
import { PostComposerDialog, PostDraft } from "@/components/social/PostComposerDialog";
import type { CalPost } from "@/components/social/CalendarMonthView";

type ViewMode = "month" | "week" | "list";
type ListFilter = "all" | "draft" | "scheduled" | "published";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday as first day
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ContentCalendar() {
  const [view, setView] = useState<ViewMode>("month");
  const [listFilter, setListFilter] = useState<ListFilter>("all");
  const [today] = useState(new Date());
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState(() => getWeekStart(today));
  const [posts, setPosts] = useState<CalPost[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | undefined>();
  const [editingPost, setEditingPost] = useState<PostDraft | undefined>();

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select("id, title, content, platforms, scheduled_at, status, media_urls, gbp_cta_type, gbp_cta_url")
      .eq("client_id", "citywide")
      .order("scheduled_at", { ascending: true });

    if (!error && data) {
      setPosts(
        data.map((p) => ({
          id: p.id,
          title: (p as { title?: string }).title ?? "",
          content: p.content ?? "",
          platforms: (p as { platforms?: string[] }).platforms ?? [],
          scheduled_at: p.scheduled_at ?? null,
          status: p.status ?? "draft",
          media_urls: (p as { media_urls?: string[] }).media_urls ?? [],
          gbp_cta_type: (p as { gbp_cta_type?: string }).gbp_cta_type ?? "",
          gbp_cta_url: (p as { gbp_cta_url?: string }).gbp_cta_url ?? "",
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Navigation
  function prevPeriod() {
    if (view === "month") {
      if (month === 0) { setMonth(11); setYear((y) => y - 1); }
      else setMonth((m) => m - 1);
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setWeekStart(d);
    }
  }

  function nextPeriod() {
    if (view === "month") {
      if (month === 11) { setMonth(0); setYear((y) => y + 1); }
      else setMonth((m) => m + 1);
    } else {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setWeekStart(d);
    }
  }

  function goToToday() {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    setWeekStart(getWeekStart(today));
  }

  function handleDayClick(date: string) {
    setSelectedDate(date);
    setEditingPost(undefined);
    setComposerOpen(true);
  }

  function handlePostClick(post: CalPost) {
    setEditingPost({
      id: post.id,
      title: post.title,
      content: post.content,
      platforms: post.platforms,
      scheduled_at: post.scheduled_at ?? "",
      status: post.status,
      media_urls: (post as PostDraft).media_urls ?? [],
      gbp_cta_type: (post as PostDraft).gbp_cta_type ?? "",
      gbp_cta_url: (post as PostDraft).gbp_cta_url ?? "",
    });
    setSelectedDate(undefined);
    setComposerOpen(true);
  }

  // Period label
  const periodLabel =
    view === "month"
      ? `${MONTH_NAMES[month]} ${year}`
      : (() => {
          const end = new Date(weekStart);
          end.setDate(end.getDate() + 6);
          const fmt = (d: Date) =>
            d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
          return `${fmt(weekStart)} – ${fmt(end)}, ${end.getFullYear()}`;
        })();

  // Status legend counts
  const draftCount = posts.filter((p) => p.status === "draft").length;
  const scheduledCount = posts.filter((p) => p.status === "scheduled").length;
  const publishedCount = posts.filter((p) => p.status === "published").length;

  return (
    <DashboardLayout>
      <TopBar title="Content Calendar" subtitle="Schedule and publish posts across all connected platforms." />

      <div className="p-6 space-y-4">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Navigation — hidden in list view */}
          {view !== "list" && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={goToToday}>
                Today
              </Button>
              <Button variant="ghost" size="icon" onClick={prevPeriod}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={nextPeriod}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <span className="text-sm font-semibold min-w-[180px]">{periodLabel}</span>
            </div>
          )}

          {/* Status legend — hidden in list view */}
          {view !== "list" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-muted-foreground/50 inline-block" />
                <span className="text-muted-foreground">{draftCount} Draft</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary inline-block" />
                <span className="text-muted-foreground">{scheduledCount} Scheduled</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                <span className="text-muted-foreground">{publishedCount} Published</span>
              </span>
            </div>
          )}

          {/* View toggle + New Post */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border overflow-hidden">
              <Button
                variant={view === "month" ? "default" : "ghost"}
                size="sm"
                className="rounded-none border-0 h-8 px-3"
                onClick={() => setView("month")}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
                Month
              </Button>
              <Button
                variant={view === "week" ? "default" : "ghost"}
                size="sm"
                className="rounded-none border-0 border-l border-border h-8 px-3"
                onClick={() => setView("week")}
              >
                <CalendarDays className="h-3.5 w-3.5 mr-1.5" />
                Week
              </Button>
              <Button
                variant={view === "list" ? "default" : "ghost"}
                size="sm"
                className="rounded-none border-0 border-l border-border h-8 px-3"
                onClick={() => setView("list")}
              >
                <List className="h-3.5 w-3.5 mr-1.5" />
                List
              </Button>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setSelectedDate(new Date().toISOString().slice(0, 10));
                setEditingPost(undefined);
                setComposerOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              New Post
            </Button>
          </div>
        </div>

        {/* Calendar / List grid */}
        {view === "list" ? (
          <div className="space-y-3">
            {/* Filter tabs */}
            <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
              {(["all", "scheduled", "draft", "published"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setListFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    listFilter === f
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              {loading ? (
                <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                  Loading posts…
                </div>
              ) : (
                <PostListView
                  posts={posts}
                  filter={listFilter}
                  onEdit={handlePostClick}
                />
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            {loading ? (
              <div className="h-96 flex items-center justify-center text-muted-foreground text-sm">
                Loading posts…
              </div>
            ) : view === "month" ? (
              <CalendarMonthView
                year={year}
                month={month}
                posts={posts}
                onDayClick={handleDayClick}
                onPostClick={handlePostClick}
              />
            ) : (
              <CalendarWeekView
                weekStart={weekStart}
                posts={posts}
                onDayClick={handleDayClick}
                onPostClick={handlePostClick}
              />
            )}
          </div>
        )}
      </div>

      {/* Post Composer */}
      <PostComposerDialog
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        defaultDate={selectedDate}
        initialPost={editingPost}
        onSaved={fetchPosts}
      />
    </DashboardLayout>
  );
}
