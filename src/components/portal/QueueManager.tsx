import { useEffect, useState, useCallback } from "react";
import { CheckCircle, XCircle, Clock, X, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PLATFORM_LABELS: Record<string, string> = {
  google_business: "GBP",
  facebook: "FB",
  twitter: "X",
  linkedin: "LI",
};

const PLATFORM_COLORS: Record<string, string> = {
  google_business: "#EA4335",
  facebook: "#1877F2",
  twitter: "#1DA1F2",
  linkedin: "#0A66C2",
};

const STATUS_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  queued:    { label: "Queued",    icon: Clock,        color: "text-primary" },
  published: { label: "Published", icon: CheckCircle,  color: "text-[#22C55E]" },
  failed:    { label: "Failed",    icon: AlertCircle,  color: "text-red-400" },
  cancelled: { label: "Cancelled", icon: XCircle,      color: "text-[rgba(238,241,250,0.3)]" },
  draft:     { label: "Draft",     icon: Clock,        color: "text-muted-foreground" },
};

interface Post {
  id: string;
  content: string;
  platforms: string[];
  scheduled_at: string | null;
  status: string;
  platform_states: Record<string, string>;
  created_at: string;
}

interface Props {
  clientId: string;
  refreshKey: number;
}

export function QueueManager({ clientId, refreshKey }: Props) {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "posts.list", payload: { client_id: clientId } },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message);
      setPosts(data.posts ?? []);
    } catch (e) {
      console.error("Failed to load queue:", e);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts, refreshKey]);

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(fetchPosts, 30_000);
    return () => clearInterval(interval);
  }, [fetchPosts]);

  const cancelPost = async (id: string) => {
    setCancelling(id);
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "posts.cancel", payload: { id, client_id: clientId } },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message);
      toast({ title: "Post cancelled" });
      fetchPosts();
    } catch (e) {
      toast({ title: "Could not cancel post", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  };

  const fmt = (d: string) => new Date(d).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[rgba(238,241,250,0.3)] text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Loading queue…
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Clock className="w-8 h-8 text-[rgba(238,241,250,0.15)] mb-3" />
        <div className="text-sm font-bold text-muted-foreground">No posts yet</div>
        <div className="text-xs text-muted-foreground/50 mt-1">Posts you compose will appear here</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
          {posts.length} post{posts.length !== 1 ? "s" : ""}
        </div>
        <button onClick={fetchPosts} className="text-[rgba(238,241,250,0.3)] hover:text-muted-foreground transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {posts.map((post) => {
        const meta = STATUS_META[post.status] ?? STATUS_META.queued;
        const StatusIcon = meta.icon;
        const states: Record<string, string> = typeof post.platform_states === "object" ? post.platform_states as Record<string, string> : {};

        return (
          <div key={post.id} className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm text-foreground leading-relaxed line-clamp-2 flex-1">{post.content}</p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <StatusIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                <span className={`text-[11px] font-bold ${meta.color}`}>{meta.label}</span>
              </div>
            </div>

            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
              {/* Platform state badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {(post.platforms as string[]).map((p) => {
                  const pState = states[p] ?? "queued";
                  const pMeta = STATUS_META[pState] ?? STATUS_META.queued;
                  const PIcon = pMeta.icon;
                  return (
                    <span
                      key={p}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted border border-border"
                      style={{ color: PLATFORM_COLORS[p] ?? "#EEF1FA" }}
                      title={`${PLATFORM_LABELS[p] ?? p}: ${pState}`}
                    >
                      {PLATFORM_LABELS[p] ?? p}
                      <PIcon className={`w-2.5 h-2.5 ${pMeta.color}`} />
                    </span>
                  );
                })}
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-[rgba(238,241,250,0.3)]">
                  {post.scheduled_at ? fmt(post.scheduled_at) : fmt(post.created_at)}
                </span>
                {post.status === "queued" && (
                  <button
                    onClick={() => cancelPost(post.id)}
                    disabled={cancelling === post.id}
                    className="text-muted-foreground/50 hover:text-red-400 transition-colors disabled:opacity-40"
                    title="Cancel post"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
