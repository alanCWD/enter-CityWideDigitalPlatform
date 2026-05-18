import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Instagram, Linkedin, Twitter, Facebook, Youtube, FileText, Clock, CheckCircle2, Pencil } from "lucide-react";
import type { CalPost } from "./CalendarMonthView";

const PLATFORM_META: Record<string, { label: string; Icon: React.ElementType }> = {
  google_business: { label: "Google Business", Icon: Globe },
  instagram: { label: "Instagram", Icon: Instagram },
  linkedin: { label: "LinkedIn", Icon: Linkedin },
  twitter: { label: "X", Icon: Twitter },
  facebook: { label: "Facebook", Icon: Facebook },
  youtube: { label: "YouTube", Icon: Youtube },
};

const STATUS_CONFIG = {
  draft: { label: "Draft", Icon: FileText, className: "bg-muted text-muted-foreground" },
  scheduled: { label: "Scheduled", Icon: Clock, className: "bg-primary/10 text-primary" },
  published: { label: "Published", Icon: CheckCircle2, className: "bg-green-500/10 text-green-700 dark:text-green-400" },
};

interface Props {
  posts: CalPost[];
  filter: "all" | "draft" | "scheduled" | "published";
  onEdit: (post: CalPost) => void;
}

export function PostListView({ posts, filter, onEdit }: Props) {
  const filtered = filter === "all" ? posts : posts.filter((p) => p.status === filter);

  const groups: Record<string, CalPost[]> = { draft: [], scheduled: [], published: [] };
  for (const p of filtered) {
    const key = p.status in groups ? p.status : "draft";
    groups[key].push(p);
  }

  const sections = filter === "all"
    ? (["scheduled", "draft", "published"] as const)
    : ([filter] as const);

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
        <FileText className="h-8 w-8 opacity-30" />
        <p className="text-sm">No posts found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {sections.map((status) => {
        const sectionPosts = groups[status];
        if (!sectionPosts?.length) return null;
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <cfg.Icon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">{cfg.label}</h3>
              <Badge variant="secondary" className="text-xs h-5">{sectionPosts.length}</Badge>
            </div>
            <div className="space-y-2">
              {sectionPosts.map((post) => (
                <PostListItem key={post.id} post={post} onEdit={onEdit} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PostListItem({ post, onEdit }: { post: CalPost; onEdit: (p: CalPost) => void }) {
  const cfg = STATUS_CONFIG[post.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.draft;

  const formattedDate = post.scheduled_at
    ? new Date(post.scheduled_at).toLocaleString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      })
    : null;

  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border bg-card p-3 hover:border-primary/40 transition-colors">
      {/* Status dot */}
      <span className={`mt-1 flex-shrink-0 w-2 h-2 rounded-full ${
        post.status === "published" ? "bg-green-500"
        : post.status === "scheduled" ? "bg-primary"
        : "bg-muted-foreground/50"
      }`} />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {post.title || post.content.slice(0, 80)}
        </p>
        {post.title && (
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{post.content}</p>
        )}

        <div className="flex flex-wrap items-center gap-2 mt-2">
          {/* Platforms */}
          <div className="flex items-center gap-1">
            {post.platforms.map((p) => {
              const meta = PLATFORM_META[p];
              if (!meta) return null;
              return <meta.Icon key={p} className="h-3.5 w-3.5 text-muted-foreground" />;
            })}
          </div>

          {/* Date */}
          {formattedDate && (
            <span className="text-xs text-muted-foreground">{formattedDate}</span>
          )}

          {/* Status badge */}
          <Badge className={`text-[10px] h-4 px-1.5 ${cfg.className}`}>
            {cfg.label}
          </Badge>
        </div>
      </div>

      {/* Edit button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
        onClick={() => onEdit(post)}
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
