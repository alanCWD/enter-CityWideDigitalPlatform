import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/portal/PortalLayout";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { ReviewsList, ReviewItem } from "@/components/portal/ReviewsList";
import { PostsList, PostItem } from "@/components/portal/PostsList";
import { NapDetails } from "@/components/portal/NapDetails";

function GBPContent({ connection }: { connection: PortalConnection }) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
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
      if (cancelled) return;
      setReviews((reviewsRes.data ?? []) as ReviewItem[]);
      setPosts((postsRes.data ?? []) as PostItem[]);
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [connection.id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Google Business Profile</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your live Google data, managed by CityWide Digital.
        </p>
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
