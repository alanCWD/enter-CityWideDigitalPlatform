import { motion } from "framer-motion";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Search, TrendingUp, ArrowUp, ArrowDown } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

const searchData = [
  { date: "1", clicks: 120, impressions: 1400 },
  { date: "2", clicks: 132, impressions: 1550 },
  { date: "3", clicks: 101, impressions: 1300 },
  { date: "4", clicks: 145, impressions: 1700 },
  { date: "5", clicks: 160, impressions: 1850 },
  { date: "6", clicks: 210, impressions: 2200 },
  { date: "7", clicks: 190, impressions: 2000 },
];

const topQueries = [
  { q: "plumber near me", c: 342, trend: "+22%", up: true },
  { q: "acme plumbing", c: 210, trend: "+5%", up: true },
  { q: "emergency leak fix", c: 145, trend: "-2%", up: false },
  { q: "water heater installation", c: 98, trend: "+12%", up: true },
];

export function Analytics() {
  return (
    <DashboardLayout>
      <TopBar
        title="Search & Engagement Analytics"
        subtitle="Google Search Console data imported dynamically"
      />

      <div className="p-6 space-y-5">
        <div className="grid lg:grid-cols-3 gap-5">
          {/* Chart */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 bg-[#111E33] rounded-xl p-5 border border-white/8"
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-[#EEF1FA]">Performance on Search</h3>
              </div>
              <span className="text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-2 py-0.5 rounded-full">GSC Connected</span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-5">
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[10px] text-[rgba(238,241,250,0.5)] mb-1">Avg. Position</div>
                <div className="text-2xl font-extrabold text-[#EEF1FA]">4.2</div>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <div className="text-[10px] text-[rgba(238,241,250,0.5)] mb-1">Total Clicks</div>
                <div className="text-2xl font-extrabold text-[#EEF1FA]">12.5k</div>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={searchData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "rgba(238,241,250,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "rgba(238,241,250,0.4)", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#111E33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#EEF1FA" }} />
                <Line type="monotone" dataKey="clicks" stroke="#0078D7" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="impressions" stroke="rgba(238,241,250,0.3)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Top Queries */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#111E33] rounded-xl p-5 border border-white/8"
          >
            <div className="flex items-center gap-2 mb-4">
              <Search className="w-4 h-4 text-[#0078D7]" />
              <h3 className="text-sm font-bold text-[#EEF1FA]">Top Queries</h3>
            </div>
            <div className="space-y-2.5">
              {topQueries.map((item) => (
                <div key={item.q} className="flex items-center justify-between">
                  <span className="text-xs text-[rgba(238,241,250,0.7)] flex-1 truncate pr-2">{item.q}</span>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <div className={`flex items-center gap-0.5 text-[10px] font-bold ${item.up ? "text-[#22C55E]" : "text-red-400"}`}>
                      {item.up ? <ArrowUp className="w-2.5 h-2.5" /> : <ArrowDown className="w-2.5 h-2.5" />}
                      {item.trend}
                    </div>
                    <span className="text-xs font-semibold text-[#EEF1FA]">{item.c}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* SEO Health Score */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#111E33] rounded-xl p-5 border border-white/8"
        >
          <div className="flex items-center gap-3 mb-3">
            <TrendingUp className="w-4 h-4 text-[#22C55E]" />
            <h3 className="text-sm font-bold text-[#EEF1FA]">SEO Health Score</h3>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-4xl font-extrabold text-[#22C55E]">98<span className="text-xl text-[rgba(238,241,250,0.4)]">/100</span></div>
            <p className="text-xs text-[rgba(238,241,250,0.55)] leading-relaxed max-w-md">
              Your latest generated <code className="bg-white/10 px-1 rounded text-[10px]">llms.txt</code> is being crawled. Core Web Vitals are passing perfectly.
            </p>
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
