import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/portal/PortalLayout";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { ReviewsList, ReviewItem } from "@/components/portal/ReviewsList";
import { PostsList, PostItem } from "@/components/portal/PostsList";
import { NapDetails } from "@/components/portal/NapDetails";
import { useToast } from "@/hooks/use-toast";

function GBPContent({ connection }: { connection: PortalConnection }) {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [reviewsRes, postsRes] = await Promise.all([
      supabase
        .from("gbp_reviews")
        .select("id,reviewer_name,rating,comment,reply,review_time")
        .eq("connection_id", connection.id)
        .order("review_time", { ascending: false })
        .limit(50),
      supabase
        .from("gbp_posts")
        .select("id,summary,topic_type,post_time")
        .eq("connection_id", connection.id)
        .order("post_time", { ascending: false })
        .limit(20),
    ]);
    setReviews((reviewsRes.data ?? []) as ReviewItem[]);
    setPosts((postsRes.data ?? []) as PostItem[]);
    setLoading(false);
  }, [connection.id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    if (!connection.zernio_profile_id) {
      toast({ title: "No profile linked", description: "Ask your agency to link a business profile first.", variant: "destructive" });
      return;
    }
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: {
          action: "zernio.syncProfile",
          payload: { connection_id: connection.id, zernio_profile_id: connection.zernio_profile_id },
        },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Sync failed");
      toast({ title: "GBP data synced", description: `Sync log: ${(data.log as string[]).join(" · ")}` });
      await loadData();
    } catch (e) {
      toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-foreground">Google Business Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your live Google data, managed by CityWide Digital.
          </p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncing || loading}
          className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-50 transition-colors flex-shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing…" : "Sync GBP Data"}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading...
        </div>
      ) : (
        <div className="grid md:grid-cols-3 gap-4">
          <section className="bg-card rounded-xl border border-border p-4">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">NAP Details</h2>
            <NapDetails nap={connection} />
          </section>
          <section className="bg-card rounded-xl border border-border p-4">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">
              Recent Reviews ({reviews.length})
            </h2>
            <ReviewsList reviews={reviews} />
          </section>
          <section className="bg-card rounded-xl border border-border p-4">
            <h2 className="text-xs font-bold text-foreground uppercase tracking-wide mb-3">
              Recent Posts ({posts.length})
            </h2>
            <PostsList posts={posts} />
          </section>
        </div>
      )}
    </div>
  );
}

export default function PortalGBP() {
  return <PortalLayout>{(c) => <GBPContent connection={c} />}</PortalLayout>;
}
