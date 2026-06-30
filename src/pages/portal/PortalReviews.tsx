import { PortalLayout } from "@/components/portal/PortalLayout";
import { Star, MessageSquare, TrendingUp, ThumbsUp, Wifi, WifiOff } from "lucide-react";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { useSynupReviews, type SynupInteraction } from "@/lib/synup";

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_SUMMARY = { average_rating: 4.3, total_count: 127, response_rate: 78 };
const MOCK_DISTRIBUTION: Record<string, number> = { "5": 68, "4": 31, "3": 18, "2": 7, "1": 3 };
const MOCK_INTERACTIONS: SynupInteraction[] = [
  { id: "1", source: "google",   author_name: "Sarah M.",  rating: 5, response: { comment: "Thank you!" }, created_at: "2026-06-24", comment: "Absolutely fantastic service! Our website traffic doubled in the first month." },
  { id: "2", source: "google",   author_name: "James T.",  rating: 4, response: null,                      created_at: "2026-06-20", comment: "Great team, very responsive. The social sync feature saves us hours every week." },
  { id: "3", source: "yelp",     author_name: "Linda K.",  rating: 5, response: { comment: "Appreciate it!" }, created_at: "2026-06-18", comment: "Our Google listing is now fully updated and consistent everywhere." },
  { id: "4", source: "facebook", author_name: "Marco D.",  rating: 3, response: { comment: "We'll do better!" }, created_at: "2026-06-15", comment: "Good service overall. Onboarding took longer than expected." },
  { id: "5", source: "google",   author_name: "Priya S.",  rating: 5, response: { comment: "Thanks!" },    created_at: "2026-06-12", comment: "The review monitoring is a game changer. We get notified instantly." },
  { id: "6", source: "facebook", author_name: "Tom R.",    rating: 4, response: null,                      created_at: "2026-06-10", comment: "Solid platform. Our online presence has improved dramatically." },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} className={`${sz} ${s <= Math.round(rating) ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );
}

const SOURCE_BADGE: Record<string, string> = {
  google:   "bg-blue-500/15 text-blue-400 border-blue-500/20",
  yelp:     "bg-red-500/15 text-red-400 border-red-500/20",
  facebook: "bg-blue-600/15 text-blue-500 border-blue-600/20",
};

function badgeClass(source: string) {
  return SOURCE_BADGE[source.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
}

function computePlatformBreakdown(reviews: SynupInteraction[]) {
  const map: Record<string, { count: number; total: number }> = {};
  for (const r of reviews) {
    const src = r.source.toLowerCase();
    if (!map[src]) map[src] = { count: 0, total: 0 };
    map[src].count++;
    map[src].total += r.rating;
  }
  return Object.entries(map).map(([name, { count, total }]) => ({
    name,
    count,
    avg: count > 0 ? Math.round((total / count) * 10) / 10 : 0,
  }));
}

// ── UI ────────────────────────────────────────────────────────────────────────
function ReviewsContent({ connection }: { connection: PortalConnection }) {
  const biz = connection.business_name || connection.client_label;
  const { interactions, analytics, loading, error } = useSynupReviews(connection.synup_location_id);

  const isLive = !!connection.synup_location_id;
  const reviews = interactions ?? MOCK_INTERACTIONS;
  const totalCount = analytics?.total_count ?? (isLive ? 0 : MOCK_SUMMARY.total_count);
  const avgRating = analytics?.average_rating ?? (isLive ? 0 : MOCK_SUMMARY.average_rating);
  const responseRate = analytics?.response_rate != null
    ? Math.round(analytics.response_rate * 100)
    : isLive
      ? Math.round(reviews.filter(r => r.response).length / Math.max(reviews.length, 1) * 100)
      : MOCK_SUMMARY.response_rate;

  const distribution: Record<string, number> =
    analytics?.rating_distribution ??
    (isLive
      ? Object.fromEntries(
          ["5","4","3","2","1"].map((s) => [s, reviews.filter(r => Math.round(r.rating) === Number(s)).length])
        )
      : MOCK_DISTRIBUTION);

  const platforms = computePlatformBreakdown(reviews);
  const totalReviews = Object.values(distribution).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Star className="w-5 h-5 text-primary" /> Reviews
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Reputation for <span className="text-foreground font-semibold">{biz}</span>
          </p>
        </div>
        {isLive ? (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full">
            <Wifi className="w-3.5 h-3.5" /> Live data
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full">
            <WifiOff className="w-3.5 h-3.5" /> Sample data
          </span>
        )}
      </div>

      {!isLive && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl px-5 py-3 text-sm text-amber-400">
          This is sample data. Your agency will connect your Synup location to show live reviews.
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-3 text-sm text-destructive">
          Could not load live data: {error}. Showing sample data.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center col-span-2 md:col-span-1">
          {loading ? (
            <div className="h-10 w-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          ) : (
            <div className="text-5xl font-extrabold text-amber-400">{avgRating.toFixed(1)}</div>
          )}
          <Stars rating={avgRating} size="lg" />
          <div className="text-xs text-muted-foreground mt-1">{totalCount} reviews</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
          <div className="text-2xl font-bold text-foreground">{responseRate}%</div>
          <div className="text-xs text-muted-foreground">Response rate</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <ThumbsUp className="w-4 h-4 text-primary mb-1" />
          <div className="text-2xl font-bold text-foreground">{avgRating >= 4 ? "Positive" : avgRating >= 3 ? "Mixed" : "Negative"}</div>
          <div className="text-xs text-muted-foreground">Avg. sentiment</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <MessageSquare className="w-4 h-4 text-primary mb-1" />
          <div className="text-2xl font-bold text-foreground">{totalCount}</div>
          <div className="text-xs text-muted-foreground">Total reviews</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Rating breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">Rating Breakdown</h2>
          <div className="space-y-2">
            {[5,4,3,2,1].map((stars) => {
              const count = distribution[String(stars)] ?? 0;
              return (
                <div key={stars} className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5 w-20 shrink-0">
                    {[1,2,3,4,5].map((s) => (
                      <Star key={s} className={`w-3 h-3 ${s <= stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
                    ))}
                  </div>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-amber-400 h-2 rounded-full transition-all" style={{ width: `${(count / totalReviews) * 100}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground w-6 text-right">{count}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">By Platform</h2>
          {platforms.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">No platform data yet.</p>
          ) : (
            <div className="space-y-3">
              {(platforms.length > 0 ? platforms : [
                { name: "google", count: 82, avg: 4.4 },
                { name: "yelp", count: 21, avg: 4.0 },
                { name: "facebook", count: 24, avg: 4.5 },
              ]).map((p) => (
                <div key={p.name} className="flex items-center gap-3">
                  <div className="w-16 text-xs font-bold capitalize text-muted-foreground">{p.name}</div>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${(p.count / totalReviews) * 100}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground w-14 text-right tabular-nums">{p.count} · {p.avg}★</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Reviews list */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">Recent Reviews</h2>
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {r.author_name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.author_name}</p>
                    <Stars rating={r.rating} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border capitalize ${badgeClass(r.source)}`}>
                    {r.source}
                  </span>
                  {r.response && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      Replied
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.comment}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-2">
                {new Date(r.created_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Powered by Synup · Reviews monitored 24/7
      </p>
    </div>
  );
}

export default function PortalReviews() {
  return <PortalLayout>{(c) => <ReviewsContent connection={c} />}</PortalLayout>;
}
