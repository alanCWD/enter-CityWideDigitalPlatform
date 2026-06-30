import { PortalLayout } from "@/components/portal/PortalLayout";
import { CheckCircle, AlertCircle, Clock, MinusCircle, MapPin, RefreshCw, Wifi, WifiOff } from "lucide-react";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { useSynupListings, type SynupListing } from "@/lib/synup";

// ── Mock data (shown when synup_location_id is not yet set) ─────────────────
const MOCK_DIRECTORIES = [
  { site_name: "Google Business Profile", category: "Search",    status: "live",        site_slug: "google"        },
  { site_name: "Yelp",                    category: "Reviews",   status: "live",        site_slug: "yelp"          },
  { site_name: "Apple Maps",              category: "Maps",      status: "live",        site_slug: "apple_maps"    },
  { site_name: "Bing Places",             category: "Search",    status: "live",        site_slug: "bing"          },
  { site_name: "Facebook",               category: "Social",    status: "live",        site_slug: "facebook"      },
  { site_name: "Foursquare",             category: "Maps",      status: "live",        site_slug: "foursquare"    },
  { site_name: "TripAdvisor",            category: "Reviews",   status: "in_progress", site_slug: "tripadvisor"   },
  { site_name: "Yellow Pages",           category: "Directory", status: "live",        site_slug: "yellowpages"   },
  { site_name: "BBB",                    category: "Trust",     status: "live",        site_slug: "bbb"           },
  { site_name: "Angi",                   category: "Local",     status: "failed",      site_slug: "angi"          },
  { site_name: "Nextdoor",               category: "Local",     status: "in_progress", site_slug: "nextdoor"      },
  { site_name: "Alignable",              category: "B2B",       status: "live",        site_slug: "alignable"     },
  { site_name: "ChamberOfCommerce",      category: "B2B",       status: "failed",      site_slug: "chamber"       },
  { site_name: "Hotfrog",                category: "Directory", status: "not_found",   site_slug: "hotfrog"       },
  { site_name: "Superpages",             category: "Directory", status: "live",        site_slug: "superpages"    },
  { site_name: "Cylex",                  category: "Directory", status: "not_found",   site_slug: "cylex"         },
  { site_name: "MerchantCircle",         category: "Local",     status: "live",        site_slug: "merchantcircle"},
  { site_name: "Local.com",              category: "Directory", status: "failed",      site_slug: "local"         },
  { site_name: "Infobel",               category: "Directory", status: "live",        site_slug: "infobel"       },
  { site_name: "MapQuest",              category: "Maps",      status: "not_found",   site_slug: "mapquest"      },
];

const NAP_FIELDS = [
  { field: "Business Name", value: "HyperDrii Inc.",                       consistent: true  },
  { field: "Address",       value: "123 Main St, Toronto, ON M5V 2T6",     consistent: true  },
  { field: "Phone",         value: "+1 (226) 225-8333",                    consistent: true  },
  { field: "Website",       value: "hyperdrii.com",                        consistent: false },
  { field: "Category",      value: "Digital Marketing Agency",             consistent: true  },
];

// ── Status config ──────────────────────────────────────────────────────────
type StatusKey = "live" | "verified" | "in_progress" | "not_found" | "failed";

const STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; className: string; spinning?: boolean }> = {
  live:        { label: "Live",        icon: CheckCircle, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  verified:    { label: "Verified",    icon: CheckCircle, className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  in_progress: { label: "Syncing",     icon: RefreshCw,   className: "text-blue-400 bg-blue-500/10 border-blue-500/20", spinning: true },
  not_found:   { label: "Not Found",   icon: MinusCircle, className: "text-muted-foreground bg-muted border-border" },
  failed:      { label: "Error",       icon: AlertCircle, className: "text-destructive bg-destructive/10 border-destructive/20" },
};

function getStatusCfg(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG["not_found"];
}

function computeStats(dirs: SynupListing[]) {
  const synced  = dirs.filter(d => d.status === "live" || d.status === "verified").length;
  const pending = dirs.filter(d => d.status === "in_progress").length;
  const errors  = dirs.filter(d => d.status === "failed").length;
  const total   = dirs.length;
  const score   = total > 0 ? Math.round((synced / total) * 100) : 0;
  return { synced, pending, errors, total, score };
}

// ── UI ────────────────────────────────────────────────────────────────────
function ListingsContent({ connection }: { connection: PortalConnection }) {
  const biz = connection.business_name || connection.client_label;
  const { listings, loading, error } = useSynupListings(connection.synup_location_id);

  const isLive = !!connection.synup_location_id;
  const dirs: SynupListing[] = listings ?? MOCK_DIRECTORIES;
  const { score, synced, pending, errors } = computeStats(dirs);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <MapPin className="w-5 h-5 text-primary" /> Listings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Local presence for <span className="text-foreground font-semibold">{biz}</span>
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
          This is sample data. Your agency will connect your Synup location to show live listing status.
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-xl px-5 py-3 text-sm text-destructive">
          Could not load live data: {error}. Showing sample data.
        </div>
      )}

      {/* Score + stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 col-span-2 md:col-span-1 flex flex-col items-center justify-center">
          {loading ? (
            <div className="h-12 w-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
          ) : (
            <div className="text-5xl font-extrabold text-primary">{score}</div>
          )}
          <div className="text-xs font-semibold text-muted-foreground mt-1 uppercase tracking-wide">Listing Score</div>
          <div className="w-full mt-3 bg-muted rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${score}%` }} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="text-2xl font-bold text-emerald-500">{synced}</div>
          <div className="text-xs text-muted-foreground">Live</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="text-2xl font-bold text-amber-400">{pending}</div>
          <div className="text-xs text-muted-foreground">Syncing</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="text-2xl font-bold text-destructive">{errors}</div>
          <div className="text-xs text-muted-foreground">Errors</div>
        </div>
      </div>

      {/* NAP Consistency (static — shown always) */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">NAP Consistency</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Name, Address & Phone accuracy across directories</p>
        </div>
        <div className="divide-y divide-border">
          {NAP_FIELDS.map((n) => (
            <div key={n.field} className="flex items-center justify-between px-5 py-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{n.field}</p>
                <p className="text-sm text-foreground mt-0.5">{n.value}</p>
              </div>
              {n.consistent ? (
                <span className="flex items-center gap-1 text-xs text-emerald-500 font-semibold">
                  <CheckCircle className="w-3.5 h-3.5" /> Consistent
                </span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-amber-400 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5" /> Inconsistent
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Directory grid */}
      <div>
        <h2 className="text-sm font-bold text-foreground mb-3">Directory Status</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {dirs.map((dir) => {
            const cfg = getStatusCfg(dir.status);
            const Icon = cfg.icon;
            const initials = (dir.site_slug ?? dir.site_name).slice(0, 2).toUpperCase();
            return (
              <div key={dir.site_name} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{dir.site_name}</p>
                  {dir.category && <p className="text-[10px] text-muted-foreground">{dir.category}</p>}
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.className}`}>
                  <Icon className={`w-3 h-3 ${cfg.spinning ? "animate-spin" : ""}`} />
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Powered by Synup · Data refreshes every 24 hours
      </p>
    </div>
  );
}

export default function PortalListings() {
  return <PortalLayout>{(c) => <ListingsContent connection={c} />}</PortalLayout>;
}
