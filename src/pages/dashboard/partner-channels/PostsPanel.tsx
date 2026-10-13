// Scheduled and recent posts for one client company.
//
// The engine stores one row *per platform*, so a two-platform post arrives as two
// rows sharing a `scheduled_for` — grouped here into one card, which is how the
// handoff says to read them. A row with no `scheduled_for` is never merged with
// another, so unrelated publish-now posts cannot collapse together.

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  cancelPost, isPartnerSocialError, listPosts, platformLabel,
  type PartnerPost,
} from "@/lib/partner-social";
import { PlatformMark } from "./ChannelCard";

const POST_PAGE_LIMIT = 50;

const STATUS_STYLE: Record<string, string> = {
  pending: "border-border bg-muted text-muted-foreground",
  publishing: "border-primary/40 bg-primary/10 text-primary",
  published: "border-success/40 bg-success/10 text-success",
  failed: "border-destructive/40 bg-destructive/10 text-destructive",
  cancelled: "border-border text-muted-foreground/70",
};

interface PostCard {
  key: string;
  when: string | null;
  rows: PartnerPost[];
}

/** Newest first, then one card per shared `scheduled_for`. */
function groupPosts(posts: PartnerPost[]): PostCard[] {
  const sorted = [...posts].sort((a, b) => timestamp(b) - timestamp(a));

  const cards: PostCard[] = [];
  const byWhen = new Map<string, PostCard>();

  for (const post of sorted) {
    const when = post.scheduled_for ?? null;
    if (!when) {
      cards.push({ key: `solo:${post.id}`, when: null, rows: [post] });
      continue;
    }
    const existing = byWhen.get(when);
    if (existing) {
      existing.rows.push(post);
      continue;
    }
    const card: PostCard = { key: when, when, rows: [post] };
    byWhen.set(when, card);
    cards.push(card);
  }

  return cards;
}

function timestamp(post: PartnerPost): number {
  const raw = post.scheduled_for ?? post.created_at;
  const value = raw ? new Date(raw).getTime() : 0;
  return Number.isNaN(value) ? 0 : value;
}

interface PostsPanelProps {
  businessRef: string;
  /** bump to reload after a publish */
  refreshKey: number;
}

export function PostsPanel({ businessRef, refreshKey }: PostsPanelProps) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<PartnerPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPosts(await listPosts({ businessRef, limit: POST_PAGE_LIMIT }));
      setFailure(null);
    } catch (e) {
      setFailure((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [businessRef]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  async function cancel(rows: PartnerPost[], key: string) {
    const pending = rows.filter((row) => row.status === "pending");
    if (pending.length === 0) return;
    const plural = pending.length === 1 ? "" : "s";
    if (!window.confirm(`Cancel ${pending.length} pending row${plural} for this post?`)) return;

    setBusyKey(key);
    let cancelled = 0;
    const claimed: string[] = [];

    for (const row of pending) {
      try {
        await cancelPost(businessRef, row.id);
        cancelled += 1;
      } catch (e) {
        if (isPartnerSocialError(e) && e.code === "not_cancellable") {
          // The publishing worker got there first — report, do not retry.
          claimed.push(platformLabel(row.platform));
        } else {
          toast({
            title: "Cancel failed",
            description: (e as Error).message,
            variant: "destructive",
          });
        }
      }
    }

    await load();
    setBusyKey(null);

    if (claimed.length) {
      toast({
        title: "Already publishing",
        description: `${claimed.join(", ")} — the publisher had claimed ${claimed.length === 1 ? "it" : "them"}.`,
      });
    } else if (cancelled) {
      toast({ title: "Cancelled", description: `${cancelled} row${cancelled === 1 ? "" : "s"}.` });
    }
  }

  const cards = groupPosts(posts);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Scheduled &amp; recent posts
        </p>
        <Button size="sm" variant="ghost" disabled={loading} onClick={load}>
          <RefreshCw className={cn(loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {loading && posts.length === 0 ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Loading posts…
        </div>
      ) : failure ? (
        <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
          {failure}
        </p>
      ) : cards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No posts for this company yet.
        </p>
      ) : (
        <div className="space-y-2">
          {cards.map((card) => {
            const anyPending = card.rows.some((row) => row.status === "pending");
            const head = card.rows[0];
            return (
              <div key={card.key} className="rounded-xl border border-border bg-card p-4">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {card.when
                        ? new Date(card.when).toLocaleString()
                        : `Published ${new Date(head.created_at).toLocaleString()}`}
                    </p>
                    {head.excerpt && (
                      <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">
                        {head.excerpt}
                      </p>
                    )}
                  </div>
                  {anyPending && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyKey === card.key}
                      onClick={() => cancel(card.rows, card.key)}
                    >
                      {busyKey === card.key
                        ? <Loader2 className="animate-spin" />
                        : <XCircle />}
                      Cancel
                    </Button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {card.rows.map((row) => (
                    <div key={row.id} className="flex flex-wrap items-center gap-2">
                      <PlatformMark platform={row.platform} />
                      <span className="text-xs font-medium text-foreground">
                        {platformLabel(row.platform)}
                      </span>
                      <span className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        STATUS_STYLE[row.status] ?? "border-border bg-muted text-muted-foreground",
                      )}>
                        {row.status === "publishing" && (
                          <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                        )}
                        {row.status}
                      </span>
                      {row.image_url && (
                        <img src={row.image_url} alt="" className="h-8 w-8 rounded border border-border object-cover" />
                      )}
                      {row.error_message && (
                        <span className="text-[11px] text-destructive">{row.error_message}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
