// TODO: Replace mock data with Synup Agency API — GET /v2/businesses/{id}/analytics/seo
import { PortalLayout } from "@/components/portal/PortalLayout";
import { Search, TrendingUp, TrendingDown, Minus, Globe, BarChart3 } from "lucide-react";
import type { PortalConnection } from "@/hooks/usePortalConnections";

const MOCK_METRICS = {
  domainAuthority: 32,
  keywordsTop10: 18,
  keywordsTop3: 6,
  monthlyClicks: 2840,
  clicksChange: +14,
  impressions: 41200,
  avgPosition: 8.4,
};

const MOCK_KEYWORDS = [
  { keyword: "digital marketing toronto",      position: 3,  prev: 5,  volume: 880,  change: +2  },
  { keyword: "google business profile setup",  position: 4,  prev: 4,  volume: 590,  change:  0  },
  { keyword: "local seo agency ontario",       position: 6,  prev: 9,  volume: 320,  change: +3  },
  { keyword: "social media management canada", position: 8,  prev: 6,  volume: 1200, change: -2  },
  { keyword: "listing management service",     position: 9,  prev: 12, volume: 260,  change: +3  },
  { keyword: "review management software",     position: 11, prev: 11, volume: 480,  change:  0  },
  { keyword: "website for small business",     position: 14, prev: 18, volume: 2400, change: +4  },
  { keyword: "online presence management",     position: 17, prev: 15, volume: 390,  change: -2  },
  { keyword: "business directory sync",        position: 22, prev: 25, volume: 140,  change: +3  },
  { keyword: "gbp optimization service",       position: 28, prev: 31, volume: 110,  change: +3  },
];

const MOCK_TOP_PAGES = [
  { page: "/services/social-sync",    clicks: 642, impressions: 9800, ctr: 6.5, position: 4.2 },
  { page: "/",                        clicks: 531, impressions: 12400, ctr: 4.3, position: 7.1 },
  { page: "/services/listing-sync",   clicks: 418, impressions: 7200, ctr: 5.8, position: 5.8 },
  { page: "/pricing",                 clicks: 312, impressions: 5600, ctr: 5.6, position: 6.4 },
  { page: "/services/review-engine",  clicks: 287, impressions: 4900, ctr: 5.9, position: 5.2 },
];

// 6-month traffic trend (mock)
const MOCK_TRAFFIC = [
  { month: "Jan", clicks: 1820 }, { month: "Feb", clicks: 2100 },
  { month: "Mar", clicks: 2050 }, { month: "Apr", clicks: 2380 },
  { month: "May", clicks: 2490 }, { month: "Jun", clicks: 2840 },
];

function ChangeChip({ change }: { change: number }) {
  if (change > 0)  return <span className="flex items-center gap-0.5 text-[10px] font-bold text-emerald-500"><TrendingUp className="w-3 h-3" />+{change}</span>;
  if (change < 0)  return <span className="flex items-center gap-0.5 text-[10px] font-bold text-destructive"><TrendingDown className="w-3 h-3" />{change}</span>;
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

const maxClicks = Math.max(...MOCK_TRAFFIC.map((t) => t.clicks));

function SEOContent({ connection }: { connection: PortalConnection }) {
  const biz = connection.business_name || connection.client_label;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Search className="w-5 h-5 text-primary" /> SEO
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search rankings & organic performance for <span className="text-foreground font-semibold">{biz}</span>
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Domain Authority</p>
          <p className="text-2xl font-bold text-foreground">{MOCK_METRICS.domainAuthority}<span className="text-sm text-muted-foreground">/100</span></p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Keywords Top 10</p>
          <p className="text-2xl font-bold text-primary">{MOCK_METRICS.keywordsTop10}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Monthly Clicks</p>
          <p className="text-2xl font-bold text-foreground">
            {MOCK_METRICS.monthlyClicks.toLocaleString()}
            <span className="text-xs font-semibold text-emerald-500 ml-1">+{MOCK_METRICS.clicksChange}%</span>
          </p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground font-medium mb-1">Avg. Position</p>
          <p className="text-2xl font-bold text-foreground">{MOCK_METRICS.avgPosition}</p>
        </div>
      </div>

      {/* Traffic trend */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Organic Traffic (6 months)</h2>
        </div>
        <div className="flex items-end gap-2 h-28">
          {MOCK_TRAFFIC.map(({ month, clicks }) => (
            <div key={month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-[9px] text-muted-foreground font-semibold">{clicks.toLocaleString()}</span>
              <div
                className="w-full rounded-t-md bg-primary/60 hover:bg-primary transition-colors"
                style={{ height: `${(clicks / maxClicks) * 80}px` }}
              />
              <span className="text-[10px] text-muted-foreground">{month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Keyword rankings */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Keyword Rankings</h2>
          <p className="text-xs text-muted-foreground">Position changes vs. last month</p>
        </div>
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
              {MOCK_KEYWORDS.map((kw) => (
                <tr key={kw.keyword} className="hover:bg-muted/20 transition-colors">
                  <td className="px-5 py-3 text-sm text-foreground">{kw.keyword}</td>
                  <td className="px-3 py-3 text-center"><PositionBadge pos={kw.position} /></td>
                  <td className="px-3 py-3 text-center"><ChangeChip change={kw.change} /></td>
                  <td className="px-5 py-3 text-right text-xs text-muted-foreground tabular-nums">{kw.volume.toLocaleString()}/mo</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top pages */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border flex items-center gap-2">
          <Globe className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">Top Performing Pages</h2>
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

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Powered by Synup · Rankings updated weekly · Data reflects last 30 days
      </p>
    </div>
  );
}

export default function PortalSEO() {
  return <PortalLayout>{(c) => <SEOContent connection={c} />}</PortalLayout>;
}
