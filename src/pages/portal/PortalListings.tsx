// TODO: Replace mock data with Synup Agency API — GET /v2/businesses/{id}/listings
import { PortalLayout } from "@/components/portal/PortalLayout";
import { CheckCircle, AlertCircle, Clock, MinusCircle, MapPin, RefreshCw } from "lucide-react";
import type { PortalConnection } from "@/hooks/usePortalConnections";

const MOCK_STATS = { score: 84, synced: 38, pending: 4, errors: 3, total: 45 };

const MOCK_DIRECTORIES = [
  { name: "Google Business Profile", category: "Search", status: "verified",  logo: "G" },
  { name: "Yelp",                    category: "Reviews", status: "verified",  logo: "Y" },
  { name: "Apple Maps",              category: "Maps",    status: "verified",  logo: "A" },
  { name: "Bing Places",             category: "Search",  status: "verified",  logo: "B" },
  { name: "Facebook",                category: "Social",  status: "verified",  logo: "F" },
  { name: "Foursquare",              category: "Maps",    status: "verified",  logo: "4" },
  { name: "TripAdvisor",             category: "Reviews", status: "syncing",   logo: "T" },
  { name: "Yellow Pages",            category: "Directory",status:"verified",  logo: "YP"},
  { name: "BBB",                     category: "Trust",   status: "verified",  logo: "B" },
  { name: "Angi",                    category: "Local",   status: "error",     logo: "An"},
  { name: "Nextdoor",                category: "Local",   status: "syncing",   logo: "N" },
  { name: "Alignable",               category: "B2B",     status: "verified",  logo: "Al"},
  { name: "ChamberOfCommerce",       category: "B2B",     status: "error",     logo: "C" },
  { name: "Hotfrog",                 category: "Directory",status:"pending",   logo: "H" },
  { name: "Superpages",              category: "Directory",status:"verified",  logo: "S" },
  { name: "Cylex",                   category: "Directory",status:"pending",   logo: "Cy"},
  { name: "MerchantCircle",          category: "Local",   status: "verified",  logo: "M" },
  { name: "Local.com",               category: "Directory",status:"error",     logo: "L" },
  { name: "Infobel",                 category: "Directory",status:"verified",  logo: "I" },
  { name: "MapQuest",                category: "Maps",    status: "pending",   logo: "MQ"},
];

const NAP_FIELDS = [
  { field: "Business Name", value: "HyperDrii Inc.", consistent: true },
  { field: "Address",       value: "123 Main St, Toronto, ON M5V 2T6", consistent: true },
  { field: "Phone",         value: "+1 (226) 225-8333", consistent: true },
  { field: "Website",       value: "hyperdrii.com", consistent: false },
  { field: "Category",      value: "Digital Marketing Agency", consistent: true },
];

type StatusKey = "verified" | "syncing" | "pending" | "error";

const STATUS_CONFIG: Record<StatusKey, { label: string; icon: typeof CheckCircle; className: string }> = {
  verified: { label: "Verified",  icon: CheckCircle,  className: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
  syncing:  { label: "Syncing",   icon: RefreshCw,    className: "text-blue-400 bg-blue-500/10 border-blue-500/20" },
  pending:  { label: "Pending",   icon: Clock,        className: "text-amber-400 bg-amber-500/10 border-amber-500/20" },
  error:    { label: "Error",     icon: AlertCircle,  className: "text-destructive bg-destructive/10 border-destructive/20" },
};

function ListingsContent({ connection }: { connection: PortalConnection }) {
  const biz = connection.business_name || connection.client_label;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" /> Listings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Local presence for <span className="text-foreground font-semibold">{biz}</span> — synced across {MOCK_STATS.total}+ directories.
        </p>
      </div>

      {/* Score + stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 col-span-2 md:col-span-1 flex flex-col items-center justify-center">
          <div className="text-5xl font-extrabold text-primary">{MOCK_STATS.score}</div>
          <div className="text-xs font-semibold text-muted-foreground mt-1 uppercase tracking-wide">Listing Score</div>
          <div className="w-full mt-3 bg-muted rounded-full h-1.5">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${MOCK_STATS.score}%` }} />
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="text-2xl font-bold text-emerald-500">{MOCK_STATS.synced}</div>
          <div className="text-xs text-muted-foreground">Synced</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="text-2xl font-bold text-amber-400">{MOCK_STATS.pending}</div>
          <div className="text-xs text-muted-foreground">Pending</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
          <div className="text-2xl font-bold text-destructive">{MOCK_STATS.errors}</div>
          <div className="text-xs text-muted-foreground">Errors</div>
        </div>
      </div>

      {/* NAP Consistency */}
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
          {MOCK_DIRECTORIES.map((dir) => {
            const cfg = STATUS_CONFIG[dir.status as StatusKey];
            const Icon = cfg.icon;
            return (
              <div key={dir.name} className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                  {dir.logo}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{dir.name}</p>
                  <p className="text-[10px] text-muted-foreground">{dir.category}</p>
                </div>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${cfg.className}`}>
                  <Icon className={`w-3 h-3 ${dir.status === "syncing" ? "animate-spin" : ""}`} />
                  {cfg.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground text-center pt-2">
        Powered by Synup · Data refreshes every 24 hours · Last sync: today at 6:00 AM
      </p>
    </div>
  );
}

export default function PortalListings() {
  return <PortalLayout>{(c) => <ListingsContent connection={c} />}</PortalLayout>;
}
