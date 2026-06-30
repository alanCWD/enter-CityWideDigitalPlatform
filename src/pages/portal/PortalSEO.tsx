import { PortalLayout } from "@/components/portal/PortalLayout";
import { Search, TrendingUp, TrendingDown, Minus, Globe, BarChart3, Wifi, WifiOff } from "lucide-react";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { useSynupKeywords, type SynupKeyword } from "@/lib/synup";

// ── Mock data ────────────────────────────────────────────────────────────────
const MOCK_KEYWORDS: SynupKeyword[] = [
  { keyword: "digital marketing toronto",      current_rank: 3,  previous_rank: 5,  search_volume: 880  },
  { keyword: "google business profile setup",  current_rank: 4,  previous_rank: 4,  search_volume: 590  },
  { keyword: "local seo agency ontario",       current_rank: 6,  previous_rank: 9,  search_volume: 320  },
  { keyword: "social media management canada", current_rank: 8,  previous_rank: 6,  search_volume: 1200 },
  { keyword: "listing management service",     current_rank: 9,  previous_rank: 12, search_volume: 260  },
  { keyword: "review management software",     current_rank: 11, previous_rank: 11, search_volume: 480  },
  { keyword: "website for small business",     current_rank: 14, previous_rank: 18, search_volume: 2400 },
  { keyword: "online presence management",     current_rank: 17, previous_rank: 15, search_volume: 390  },
  { keyword: "business directory sync",        current_rank: 22, previous_rank: 25, search_volume: 140  },
  { keyword: "gbp optimization service",       current_rank: 28, previous_rank: 31, search_volume: 110  },
];

const MOCK_TOP_PAGES = [
  { page: "/services/social-sync",   clicks: 642, impressions: 9800,  ctr: 6.5 },
  { page: "/",                       clicks: 531, impressions: 12400, ctr: 4.3 },
  { page: "/services/listing-sync",  clicks: 418, impressions: 7200,  ctr: 5.8 },
  { page: "/pricing",                clicks: 312, impressions: 5600,  ctr: 5.6 },
  { page: "/services/review-engine", clicks: 287, impressions: 4900,  ctr: 5.9 },
];

const MOCK_TRAFFIC = [
  { month: "Jan", clicks: 1820 }, { month: "Feb", clicks: 2100 },
  { month: "Mar", clicks: 2050 }, { month: "Apr", clicks: 2380 },
  { month: "May", clicks: 2490 }, { month: "Jun", clicks: 2840 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function ChangeChip({ change }: { change: number }) {
  if (change > 0) return <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500"><TrendingUp className="w-3 h-3" />+{change}</span>;
  if (change < 0) return <span className="flex items-center gap-0.5 text-[10px] font-bold text-destructive"><TrendingDown className="w-3 h-3" />{change}</span>;
  return <span className="flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground"><Minus className="w-3 h-3" />–</span>;
}

function PositionBadge({ pos }: { pos: number }) {
  const color = pos <= 3 ? "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
    : pos <= 10 ? "text-primary bg-primary/10 border-primary/20"
    : "text-muted-foreground bg-muted border-border";
  return (
    <span className={`inline-flex items-center justify-center w-8 h-6 rounded-md text-[10px] font-bold border ${color}`}>
      #{pos}
    </span>
  );
}

function computeMetrics(kws: SynupKeyword[]) {
  const top10 = kws.filter(k => k.current_rank <= 10).length;
  const top3  = kws.filter(k => k.current_rank <= 3).length;
  const avg   = kws.length > 0 ? Math.round(kws.reduce((s, k) => s + k.current_rank, 0) / kws.length * 10) / 10 : 0;
  return { top10, top3, avg };
}

const maxClicks = Math.max(...MOCK_TRAFFIC.map(t => t.clicks));

// ── UI ────────────────────────────────────────────────────────────────────────
function SEOContent({ connection }: { connection: PortalConnection }) {
  const biz = connection.business_name || connection.client_label;
  const { keywords, loading, error } = useSynupKeywords(connection.synup_location_id);

  const isLive = !!connection.synup_location_id;
  const kws: SynupKeyword[] = keywords ?? MOCK_KEYWORDS;
  const { top10, avg } = computeMetrics(kws);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Search className="w-5 h-5 text-primary" /> SEO
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Rankings & organic performance for <span className="text-foreground font-semibold">{biz}</span>
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
          This is sample data. Your agency will connect your Synup location to show live keyword rankings.
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-3 text-sm text-destructive">
          Could not load live data: {error}. Showing sample data.
        </div>
      )}

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Domain Authority</p>
          <p className="text-2xl font-bold text-foreground">32<span className="text-sm text-muted-foreground">/100</span></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Keywords Top 10</p>
          {loading
            ? <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mt-1" />
            : <p className="text-2xl font-bold text-primary">{top10}</p>}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Monthly Clicks</p>
          <p className="text-2xl font-bold text-foreground">
            {isLive ? "—" : "2,840"}
            {!isLive && <span className="text-xs font-semibold text-emerald-500 ml-1">+14%</span>}
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Avg. Position</p>
          {loading
            ? <div className="h-8 w-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin mt-1" />
            : <p className="text-2xl font-bold text-foreground">{avg || "—"}</p>}
        </div>
      </div>

      {/* Traffic trend (static sample chart — live clicks available via GBP analytics) */}
      {!isLive && (
        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Organic Traffic (6 months · sample)</h2>
          </div>
          <div className="flex items-end gap-2 h-28">
            {MOCK_TRAFFIC.map(({ month, clicks }) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-muted-foreground font-semibold">{clicks.toLocaleString()}</span>
                <div className="w-full rounded-t-md bg-primary/60 hover:bg-primary transition-colors" style={{ height: `${(clicks / maxClicks) * 80}px` }} />
                <span className="text-[10px] text-muted-foreground">{month}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Keyword rankings */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Keyword Rankings</h2>
          <p className="text-xs text-muted-foreground">Position vs. last month</p>
        </div>
        {kws.length === 0 && !loading ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            No keywords tracked yet. Your agency will add your target keywords in Synup.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Keyword</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Position</th>
                  <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Change</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {kws.map((kw) => {
                  const change = kw.previous_rank - kw.current_rank; // positive = improved
                  return (
                    <tr key={kw.keyword} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-sm text-foreground">{kw.keyword}</td>
                      <td className="px-3 py-3 text-center"><PositionBadge pos={kw.current_rank} /></td>
                      <td className="px-3 py-3 text-center"><ChangeChip change={change} /></td>
                      <td className="px-5 py-3 text-right text-xs text-muted-foreground tabular-nums">
                        {kw.search_volume != null ? `${kw.search_volume.toLocaleString()}/mo` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top pages — static, shown only for demo */}
      {!isLive && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
            <Globe className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Top Performing Pages <span className="text-muted-foreground font-normal">(sample)</span></h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Page</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Clicks</th>
                  <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Impressions</th>
                  <th className="text-right px-5 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">CTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {MOCK_TOP_PAGES.map((p) => (
                  <tr key={p.page} className="hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3 text-xs font-mono text-primary">{p.page}</td>
                    <td className="px-3 py-3 text-right text-sm text-foreground tabular-nums">{p.clicks.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground tabular-nums">{p.impressions.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-xs text-emerald-500 font-semibold">{p.ctr}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Powered by Synup · Rankings updated weekly
      </p>
    </div>
  );
}

export default function PortalSEO() {
  return <PortalLayout>{(c) => <SEOContent connection={c} />}</PortalLayout>;
}
