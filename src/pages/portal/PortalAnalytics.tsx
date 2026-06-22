import { useEffect, useState } from "react";
import { Loader2, Star, MessageSquare, FileText, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PortalLayout } from "@/components/portal/PortalLayout";
import type { PortalConnection } from "@/hooks/usePortalConnections";

interface Aggregates {
  totalReviews: number;
  avgRating: number | null;
  fiveStarPct: number;
  totalPosts: number;
  postsLast30: number;
  reviewsLast30: number;
}

function AnalyticsContent({ connection }: { connection: PortalConnection }) {
  const [agg, setAgg] = useState<Aggregates | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [reviewsRes, postsRes] = await Promise.all([
        supabase.from("gbp_reviews").select("rating,review_time").eq("connection_id", connection.id),
        supabase.from("gbp_posts").select("post_time").eq("connection_id", connection.id),
      ]);
      if (cancelled) return;
      const reviews = reviewsRes.data ?? [];
      const posts = postsRes.data ?? [];
      const now = Date.now();
      const dayMs = 86_400_000;
      const total = reviews.length;
      const sum = reviews.reduce((acc, r) => acc + (r.rating ?? 0), 0);
      const five = reviews.filter((r) => r.rating === 5).length;
      setAgg({
        totalReviews: total,
        avgRating: total ? sum / total : null,
        fiveStarPct: total ? Math.round((five / total) * 100) : 0,
        totalPosts: posts.length,
        postsLast30: posts.filter((p) => p.post_time && now - new Date(p.post_time).getTime() < 30 * dayMs).length,
        reviewsLast30: reviews.filter((r) => r.review_time && now - new Date(r.review_time).getTime() < 30 * dayMs).length,
      });
      setLoading(false);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [connection.id]);

  if (loading || !agg) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground py-6">
        <Loader2 className="w-4 h-4 animate-spin" /> Crunching numbers...
      </div>
    );
  }

  const cards = [
    { label: "Avg Rating", value: agg.avgRating ? agg.avgRating.toFixed(2) : "—", icon: Star, color: "text-yellow-400" },
    { label: "Total Reviews", value: agg.totalReviews, icon: MessageSquare, color: "text-[#22C55E]" },
    { label: "5-star %", value: `${agg.fiveStarPct}%`, icon: TrendingUp, color: "text-primary" },
    { label: "Posts (all-time)", value: agg.totalPosts, icon: FileText, color: "text-[#A855F7]" },
    { label: "Reviews (30d)", value: agg.reviewsLast30, icon: MessageSquare, color: "text-[#22C55E]" },
    { label: "Posts (30d)", value: agg.postsLast30, icon: FileText, color: "text-[#A855F7]" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Performance metrics for {connection.business_name || connection.client_label}.
        </p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                {c.label}
              </span>
              <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
            </div>
            <div className="text-xl font-bold text-foreground">{c.value}</div>
          </div>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground/70">
        Live analytics integrations (search impressions, GBP views, click-throughs) coming soon.
      </p>
    </div>
  );
}

export default function PortalAnalytics() {
  return <PortalLayout>{(c) => <AnalyticsContent connection={c} />}</PortalLayout>;
}
