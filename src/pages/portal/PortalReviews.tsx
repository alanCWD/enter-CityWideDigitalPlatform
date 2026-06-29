// TODO: Replace mock data with Synup Agency API — GET /v2/businesses/{id}/reviews
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Star, MessageSquare, TrendingUp, ThumbsUp } from "lucide-react";
import type { PortalConnection } from "@/hooks/usePortalConnections";

const MOCK_SUMMARY = { average: 4.3, total: 127, responseRate: 78, sentiment: "Positive" };
const MOCK_BREAKDOWN = [
  { stars: 5, count: 68 }, { stars: 4, count: 31 },
  { stars: 3, count: 18 }, { stars: 2, count: 7 }, { stars: 1, count: 3 },
];
const MOCK_PLATFORMS = [
  { name: "Google",   count: 82, avg: 4.4, color: "text-blue-400" },
  { name: "Yelp",     count: 21, avg: 4.0, color: "text-red-400" },
  { name: "Facebook", count: 24, avg: 4.5, color: "text-blue-500" },
];
const MOCK_REVIEWS = [
  {
    id: 1, platform: "Google", author: "Sarah M.", rating: 5,
    text: "Absolutely fantastic service! Our website traffic doubled in the first month. Highly recommend CityWide Digital to any local business.",
    date: "Jun 24, 2026", replied: true,
  },
  {
    id: 2, platform: "Google", author: "James T.", rating: 4,
    text: "Great team, very responsive. The social sync feature saves us hours every week. Would love to see more analytics.",
    date: "Jun 20, 2026", replied: false,
  },
  {
    id: 3, platform: "Yelp", author: "Linda K.", rating: 5,
    text: "Our Google listing is now fully updated and consistent everywhere. Found us on Apple Maps and Bing too — never had that before.",
    date: "Jun 18, 2026", replied: true,
  },
  {
    id: 4, platform: "Facebook", author: "Marco D.", rating: 3,
    text: "Good service overall. Onboarding took longer than expected but the results are showing now.",
    date: "Jun 15, 2026", replied: true,
  },
  {
    id: 5, platform: "Google", author: "Priya S.", rating: 5,
    text: "The review monitoring is a game changer. We get notified instantly and can respond quickly. 10/10.",
    date: "Jun 12, 2026", replied: true,
  },
  {
    id: 6, platform: "Facebook", author: "Tom R.", rating: 4,
    text: "Solid platform. Our online presence has improved dramatically. The directory sync is worth it alone.",
    date: "Jun 10, 2026", replied: false,
  },
];

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "lg" }) {
  const sz = size === "lg" ? "w-5 h-5" : "w-3.5 h-3.5";
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`${sz} ${s <= rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </div>
  );
}

const PLATFORM_BADGE: Record<string, string> = {
  Google:   "bg-blue-500/15 text-blue-400 border-blue-500/20",
  Yelp:     "bg-red-500/15 text-red-400 border-red-500/20",
  Facebook: "bg-blue-600/15 text-blue-500 border-blue-600/20",
};

function ReviewsContent({ connection }: { connection: PortalConnection }) {
  const biz = connection.business_name || connection.client_label;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Star className="w-5 h-5 text-primary" /> Reviews
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reputation overview for <span className="text-foreground font-semibold">{biz}</span>
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col items-center col-span-2 md:col-span-1">
          <div className="text-5xl font-extrabold text-amber-400">{MOCK_SUMMARY.average}</div>
          <Stars rating={Math.round(MOCK_SUMMARY.average)} size="lg" />
          <div className="text-xs text-muted-foreground mt-1">{MOCK_SUMMARY.total} reviews</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <TrendingUp className="w-4 h-4 text-emerald-500 mb-1" />
          <div className="text-2xl font-bold text-foreground">{MOCK_SUMMARY.responseRate}%</div>
          <div className="text-xs text-muted-foreground">Response rate</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <ThumbsUp className="w-4 h-4 text-primary mb-1" />
          <div className="text-2xl font-bold text-foreground">{MOCK_SUMMARY.sentiment}</div>
          <div className="text-xs text-muted-foreground">Avg. sentiment</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <MessageSquare className="w-4 h-4 text-primary mb-1" />
          <div className="text-2xl font-bold text-foreground">{MOCK_SUMMARY.total}</div>
          <div className="text-xs text-muted-foreground">Total reviews</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Rating breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">Rating Breakdown</h2>
          <div className="space-y-2">
            {MOCK_BREAKDOWN.map(({ stars, count }) => (
              <div key={stars} className="flex items-center gap-2">
                <div className="flex items-center gap-0.5 w-20 shrink-0">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className={`w-3 h-3 ${s <= stars ? "text-amber-400 fill-amber-400" : "text-muted-foreground/20"}`} />
                  ))}
                </div>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-amber-400 h-2 rounded-full"
                    style={{ width: `${(count / MOCK_SUMMARY.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground w-6 text-right">{count}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Platform breakdown */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-bold text-foreground mb-4">By Platform</h2>
          <div className="space-y-3">
            {MOCK_PLATFORMS.map((p) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className={`w-16 text-xs font-bold ${p.color}`}>{p.name}</div>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{ width: `${(p.count / MOCK_SUMMARY.total) * 100}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground w-12 text-right">{p.count} · {p.avg}★</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent reviews */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">Recent Reviews</h2>
        <div className="space-y-3">
          {MOCK_REVIEWS.map((r) => (
            <div key={r.id} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                    {r.author.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{r.author}</p>
                    <Stars rating={r.rating} />
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${PLATFORM_BADGE[r.platform]}`}>
                    {r.platform}
                  </span>
                  {r.replied && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
                      Replied
                    </span>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{r.text}</p>
              <p className="text-[10px] text-muted-foreground/50 mt-2">{r.date}</p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Powered by Synup · Reviews monitored 24/7 · Last sync: today at 6:00 AM
      </p>
    </div>
  );
}

export default function PortalReviews() {
  return <PortalLayout>{(c) => <ReviewsContent connection={c} />}</PortalLayout>;
}
