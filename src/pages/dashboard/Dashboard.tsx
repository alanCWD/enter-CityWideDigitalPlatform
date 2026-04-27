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
} from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

const chartData = [
  { name: "Week 1", nativeOrders: 4000, doordash: 2400 },
  { name: "Week 2", nativeOrders: 4300, doordash: 2200 },
  { name: "Week 3", nativeOrders: 5000, doordash: 1800 },
  { name: "Week 4", nativeOrders: 5500, doordash: 1600 },
];

const clients = [
  { id: 1, name: "Acme Plumbing Burgers", status: "Live", mrr: "$499", commissionSaved: "$4,250", features: ["GBP Sync", "Bunny CDN"], health: "healthy" },
  { id: 2, name: "Luigi's NY Pizza", status: "Live", mrr: "$499", commissionSaved: "$8,900", features: ["GBP Sync", "Bunny CDN", "Video Engine"], health: "healthy" },
  { id: 3, name: "The Rusty Anchor", status: "Onboarding", mrr: "$299", commissionSaved: "$0", features: ["Pending POS"], health: "warning" },
  { id: 4, name: "Downtown Sushi", status: "Live", mrr: "$799", commissionSaved: "$12,400", features: ["Full Suite", "Multi-loc"], health: "healthy" },
];

const activityFeed = [
  { client: "Acme Burgers", action: "Stitched & published new video review to Bunny.net via GBP webhook.", time: "12m ago", type: "success" },
  { client: "Luigi's Pizza", action: "Intercepted 42 DoorDash searches, mapped to Native Order UI.", time: "1h ago", type: "info" },
  { client: "The Rusty Anchor", action: "Square POS integration dropped.", time: "3h ago", type: "error" },
  { client: "Downtown Sushi", action: "New Event Page auto-generated from GBP Post.", time: "5h ago", type: "success" },
];

export function Dashboard() {
  const stats = [
    { name: "Agency MRR", value: "$68,450", change: "+8%", icon: DollarSign, trend: "up" },
    { name: "Commission Blocked (YTD)", value: "$1.2M", change: "+42%", icon: TrendingDown, trend: "up", hint: "Money saved for clients" },
    { name: "Active Restaurant Sites", value: "142", change: "+12", icon: Building2, trend: "up" },
    { name: "Avg. Local SEO Rank (3-Pack)", value: "1.4", change: "+0.4", icon: Globe, trend: "up" },
  ];

  return (
    <DashboardLayout>
      <TopBar
        title="Agency Command Center"
        subtitle="Managing 142 clients · Focus: Commission Defense & Local SEO"
        action={{ label: "+ Deploy New Restaurant" }}
      />

      <div className="p-6 space-y-6">
        {/* KPI Stats */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.name}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-[#111E33] rounded-xl p-5 border border-white/8"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-[#0078D7]/15 flex items-center justify-center">
                  <stat.icon className="w-5 h-5 text-[#0078D7]" />
                </div>
                <div className="flex items-center gap-1 text-[#22C55E] text-xs font-bold">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {stat.change}
                </div>
              </div>
              <div className="text-2xl font-extrabold text-[#EEF1FA]">{stat.value}</div>
              <div className="text-xs text-[rgba(238,241,250,0.5)] mt-0.5">{stat.name}</div>
              {stat.hint && <div className="text-[10px] text-[#0078D7] mt-0.5">{stat.hint}</div>}
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 bg-[#111E33] rounded-xl p-6 border border-white/8"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-sm font-bold text-[#EEF1FA]">Network Volume: Native vs. Aggregator</h3>
                <p className="text-xs text-[rgba(238,241,250,0.5)] mt-0.5">Proof of value: Bleeding volume away from DoorDash into native, zero-commission ordering.</p>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[#0078D7]" /> Native</div>
                <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-[rgba(238,241,250,0.25)]" /> DoorDash</div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorNative" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0078D7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0078D7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorDoor" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EEF1FA" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#EEF1FA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" tick={{ fill: "rgba(238,241,250,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(238,241,250,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#111E33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#EEF1FA" }} />
                <Area type="monotone" dataKey="nativeOrders" stroke="#0078D7" strokeWidth={2} fill="url(#colorNative)" />
                <Area type="monotone" dataKey="doordash" stroke="rgba(238,241,250,0.3)" strokeWidth={2} fill="url(#colorDoor)" />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Activity Feed */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-[#111E33] rounded-xl p-5 border border-white/8 flex flex-col"
          >
            <h3 className="text-sm font-bold text-[#EEF1FA] mb-4">Network Activity</h3>
            <div className="flex-1 space-y-3">
              {activityFeed.map((feed, i) => (
                <div key={i} className="flex gap-2.5">
                  <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${
                    feed.type === "success" ? "bg-[#22C55E]" :
                    feed.type === "error" ? "bg-red-400" : "bg-[#0078D7]"
                  }`} />
                  <div>
                    <p className="text-xs text-[#EEF1FA] leading-relaxed">
                      <span className="font-semibold">{feed.client}:</span> {feed.action}
                    </p>
                    <p className="text-[10px] text-[rgba(238,241,250,0.4)] mt-0.5">{feed.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Client Roster */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-[#111E33] rounded-xl border border-white/8 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-white/8 flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#EEF1FA]">Client Roster</h3>
            <button className="flex items-center gap-1.5 text-xs font-semibold text-[#0078D7] hover:text-[#5BB8FF] transition-colors">
              <Plus className="w-3.5 h-3.5" /> Add Client
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  {["Restaurant Name", "Status", "MRR", "Commissions Blocked", "Active Modules", "Action"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-[rgba(238,241,250,0.4)] uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {c.health === "warning" ? (
                          <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0" />
                        )}
                        <span className="text-[#EEF1FA] text-xs font-medium">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${
                        c.status === "Live" ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-yellow-400/15 text-yellow-400"
                      }`}>{c.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-[#EEF1FA] font-semibold">{c.mrr}</td>
                    <td className="px-5 py-3.5 text-xs text-[#22C55E] font-semibold">{c.commissionSaved}</td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {c.features.map(f => (
                          <span key={f} className="text-[10px] bg-[#0078D7]/15 text-[#0078D7] rounded px-1.5 py-0.5 font-medium">{f}</span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <button className="text-[10px] font-bold text-[#0078D7] hover:text-[#5BB8FF] transition-colors">
                        Open Hub →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
