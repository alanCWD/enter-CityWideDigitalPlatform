import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Globe,
  TrendingDown,
  Building2,
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Plus,
  ExternalLink,
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useAgency } from "@/contexts/AgencyContext";
import { ACCENT_CLASSES } from "@/lib/agencies";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

// ── Per-agency KPI config ──────────────────────────────────────────────────
const AGENCY_KPIS: Record<string, {
  mrr: string; mrrChange: string;
  commission: string; commissionChange: string;
  clientLabel: string;
  rankLabel: string;
  showChart: boolean;
}> = {
  citywide:    { mrr: "$68,450", mrrChange: "+8%",  commission: "$1.2M", commissionChange: "+42%", clientLabel: "Active Clients",         rankLabel: "Avg. Local SEO Rank (3-Pack)", showChart: true  },
  legacy_leaf: { mrr: "$21,200", mrrChange: "+5%",  commission: "$310K", commissionChange: "+18%", clientLabel: "Cannabis Shops Managed", rankLabel: "Avg. Local SEO Rank (3-Pack)", showChart: false },
  foodiio:     { mrr: "$34,800", mrrChange: "+11%", commission: "$890K", commissionChange: "+34%", clientLabel: "Restaurant Clients",      rankLabel: "Avg. Commission Defense Rank",  showChart: true  },
  oneprofile:  { mrr: "$8,900",  mrrChange: "+22%", commission: "$0",    commissionChange: "N/A",  clientLabel: "Creator Profiles",        rankLabel: "Avg. Portfolio Visits / Day",   showChart: false },
};

const chartData = [
  { name: "Week 1", native: 4000, aggregator: 2400 },
  { name: "Week 2", native: 4300, aggregator: 2200 },
  { name: "Week 3", native: 5000, aggregator: 1800 },
  { name: "Week 4", native: 5500, aggregator: 1600 },
];

const activityFeed = [
  { client: "Client A", action: "Synced new listing to 38 directories via Synup.", time: "12m ago", type: "success" },
  { client: "Client B", action: "New 5-star review replied automatically.", time: "1h ago", type: "info" },
  { client: "Client C", action: "GBP post published across social channels.", time: "3h ago", type: "success" },
  { client: "Client D", action: "New event page auto-generated from GBP Post.", time: "5h ago", type: "success" },
];

interface GbpClient {
  id: string;
  client_label: string;
  business_name: string | null;
  last_synced_at: string | null;
  synup_location_id: string | null;
}

export function Dashboard() {
  const { agency } = useAgency();
  const kpi = AGENCY_KPIS[agency.slug] ?? AGENCY_KPIS.citywide;
  const accent = ACCENT_CLASSES[agency.accent];

  const [clients, setClients] = useState<GbpClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);

  useEffect(() => {
    setLoadingClients(true);
    supabase
      .from("gbp_connections")
      .select("id,client_label,business_name,last_synced_at,synup_location_id")
      .eq("agency_id", agency.slug)
      .order("client_label", { ascending: true })
      .then(({ data }) => {
        setClients((data ?? []) as GbpClient[]);
        setLoadingClients(false);
      });
  }, [agency.slug]);

  const stats = [
    {
      name: "Agency MRR",
      value: kpi.mrr,
      change: kpi.mrrChange,
      icon: DollarSign,
    },
    {
      name: "Commission Blocked (YTD)",
      value: kpi.commission,
      change: kpi.commissionChange,
      icon: TrendingDown,
      hint: "Money saved for clients",
      skip: agency.slug === "oneprofile",
    },
    {
      name: kpi.clientLabel,
      value: loadingClients ? "…" : String(clients.length),
      change: "+live",
      icon: Building2,
    },
    {
      name: kpi.rankLabel,
      value: "1.4",
      change: "+0.4",
      icon: Globe,
    },
  ];

  return (
    <DashboardLayout>
      <TopBar
        title="Agency Command Centre"
        subtitle={`${agency.name} · ${loadingClients ? "Loading…" : `${clients.length} client${clients.length !== 1 ? "s" : ""}`}`}
      />

      <div className="p-6 space-y-6">
        {/* KPI Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats
            .filter((s) => !s.skip)
            .map((stat, i) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-card rounded-xl p-5 border border-border"
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent.bg} ${accent.border} border`}>
                  <stat.icon className={`w-5 h-5 ${accent.text}`} />
                </div>
                <div className="flex items-center gap-1 text-emerald-500 text-xs font-bold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {stat.change}
                </div>
              </div>
              <div className="text-2xl font-extrabold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.name}</div>
              {"hint" in stat && stat.hint && (
                <div className={`text-[10px] ${accent.text} mt-0.5`}>{stat.hint}</div>
              )}
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart — Foodiio & CityWide only */}
          {kpi.showChart ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="lg:col-span-2 bg-card rounded-xl p-6 border border-border"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Network Volume: Native vs. Aggregator</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Bleeding volume away from DoorDash into native, zero-commission ordering.</p>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-primary" /> Native</div>
                  <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-border" /> Aggregator</div>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorNative" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAgg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#888" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#888" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
                  <XAxis dataKey="name" tick={{ fill: "currentColor", fontSize: 10, opacity: 0.5 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: "currentColor", fontSize: 10, opacity: 0.5 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, color: "hsl(var(--foreground))" }} />
                  <Area type="monotone" dataKey="native" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#colorNative)" />
                  <Area type="monotone" dataKey="aggregator" stroke="#888" strokeWidth={2} fill="url(#colorAgg)" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          ) : (
            /* Placeholder for non-chart agencies */
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className={`lg:col-span-2 rounded-xl p-6 border flex items-center justify-center ${accent.bg} ${accent.border}`}
            >
              <div className="text-center">
                <agency.icon className={`w-10 h-10 mx-auto mb-3 ${accent.text}`} />
                <p className="text-sm font-bold text-foreground">{agency.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{agency.tagline}</p>
              </div>
            </motion.div>
          )}

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-card rounded-xl p-5 border border-border flex flex-col"
          >
            <h3 className="text-sm font-bold text-foreground mb-4">Network Activity</h3>
            <div className="flex-1 space-y-3">
              {activityFeed.map((feed, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    feed.type === "success" ? "bg-emerald-500" :
                    feed.type === "error" ? "bg-red-400" : "bg-primary"
                  }`} />
                  <div>
                    <p className="text-xs text-foreground leading-relaxed">
                      <span className="font-semibold">{feed.client}:</span> {feed.action}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{feed.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Client Roster — live from DB filtered by agency */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-card rounded-xl border border-border overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground">
              Client Roster
              <span className="ml-2 text-[10px] font-normal text-muted-foreground uppercase tracking-wider">
                {agency.name}
              </span>
            </h3>
            <Link
              to="/dashboard/crm/clients"
              className={`flex items-center gap-1.5 text-xs font-semibold ${accent.text} hover:opacity-80 transition-opacity`}
            >
              <Plus className="w-3.5 h-3.5" /> Add Client
            </Link>
          </div>

          {loadingClients ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading clients…</div>
          ) : clients.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-muted-foreground">No clients yet for {agency.name}.</p>
              <Link to="/dashboard/crm/clients" className={`mt-2 inline-block text-xs font-semibold ${accent.text} hover:underline`}>
                Add your first client →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    {["Client", "Business Name", "Synup", "Last Synced", "Portal"].map((h) => (
                      <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clients.map((c) => (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-muted/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                          <span className="text-xs font-medium text-foreground">{c.client_label}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">{c.business_name ?? "—"}</td>
                      <td className="px-5 py-3.5">
                        {c.synup_location_id ? (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">Connected</span>
                        ) : (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Not set</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        {c.last_synced_at
                          ? new Date(c.last_synced_at).toLocaleDateString("en-CA")
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <Link
                          to={`/portal/${c.id}`}
                          target="_blank"
                          className={`flex items-center gap-1 text-[10px] font-bold ${accent.text} hover:opacity-80 transition-opacity`}
                        >
                          <ExternalLink className="w-3 h-3" /> Open Portal
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
