import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Utensils,
  ShoppingCart,
  Plus,
  Store,
  Star,
  Link,
  Video,
  Bell,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

type Tab = "orders" | "menu" | "pos" | "googlesync" | "notifications";

const TABS: { id: Tab; label: string; icon: React.FC<{ className?: string }> }[] = [
  { id: "orders", label: "Live Orders", icon: ShoppingCart },
  { id: "menu", label: "Menu Manager", icon: Utensils },
  { id: "pos", label: "POS Integration", icon: Store },
  { id: "googlesync", label: "Google Sync", icon: Star },
  { id: "notifications", label: "Notifications", icon: Bell },
];

const liveOrders = [
  { id: "#1082", customer: "Table 4", items: "Ribeye, House Salad, IPA x2", total: "$68", status: "New", time: "2m" },
  { id: "#1081", customer: "Delivery – Mike R.", items: "Margherita x2, Garlic Bread", total: "$44", status: "Preparing", time: "12m" },
  { id: "#1080", customer: "Table 9", items: "Spaghetti Bolognese, Tiramisu", total: "$52", status: "Ready", time: "18m" },
];

const menuItems = [
  { name: "Ribeye Steak", cat: "Entrees", price: "$38", photo: true, pos: true },
  { name: "Margherita Pizza", cat: "Mains", price: "$18", photo: true, pos: false },
  { name: "House Salad", cat: "Starters", price: "$12", photo: false, pos: true },
  { name: "Tiramisu", cat: "Desserts", price: "$11", photo: true, pos: true },
];

const posOptions = [
  { name: "Square", logo: "■", connected: true },
  { name: "Toast", logo: "T", connected: false },
  { name: "Clover", logo: "♣", connected: false },
  { name: "Lightspeed", logo: "⚡", connected: false },
];

export function RestaurantHub() {
  const [tab, setTab] = useState<Tab>("orders");

  return (
    <DashboardLayout>
      <TopBar
        title="Ordering & Menus"
        subtitle="Native ordering engine · Zero third-party commission"
        action={{ label: "+ New Order" }}
      />

      <div className="p-6 space-y-5">
        {/* Tab Bar */}
        <div className="flex items-center gap-1 bg-[#111E33] rounded-xl p-1 w-fit border border-white/8 flex-wrap">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all",
                tab === t.id
                  ? "bg-[#0078D7] text-white shadow-[0_2px_6px_rgba(0,120,215,0.3)]"
                  : "text-[rgba(238,241,250,0.55)] hover:text-[#EEF1FA] hover:bg-white/5"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Live Orders */}
          {tab === "orders" && (
            <motion.div key="orders" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid md:grid-cols-3 gap-4">
                {["New", "Preparing", "Ready"].map((status) => (
                  <div key={status} className="bg-[#111E33] rounded-xl border border-white/8">
                    <div className={cn(
                      "px-4 py-3 border-b border-white/8 flex items-center justify-between",
                    )}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", {
                          "bg-[#0078D7]": status === "New",
                          "bg-yellow-400": status === "Preparing",
                          "bg-[#22C55E]": status === "Ready",
                        })} />
                        <span className="text-xs font-bold text-[#EEF1FA]">{status}</span>
                      </div>
                      <span className="text-[10px] text-[rgba(238,241,250,0.4)]">
                        {liveOrders.filter((o) => o.status === status).length} order{liveOrders.filter((o) => o.status === status).length !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="p-3 space-y-2.5">
                      {liveOrders
                        .filter((o) => o.status === status)
                        .map((order) => (
                          <div key={order.id} className="bg-white/3 rounded-lg p-3 border border-white/5">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-[#EEF1FA]">{order.id}</span>
                              <div className="flex items-center gap-1 text-[10px] text-[rgba(238,241,250,0.4)]">
                                <Clock className="w-3 h-3" /> {order.time}
                              </div>
                            </div>
                            <p className="text-[10px] font-semibold text-[rgba(238,241,250,0.7)] mb-1">{order.customer}</p>
                            <p className="text-[10px] text-[rgba(238,241,250,0.5)] mb-2">{order.items}</p>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#22C55E]">{order.total}</span>
                              <button className="text-[10px] font-bold bg-[#0078D7]/20 text-[#0078D7] px-2 py-1 rounded hover:bg-[#0078D7]/30 transition-colors">
                                {status === "New" ? "Accept" : status === "Preparing" ? "Mark Ready" : "Complete"}
                              </button>
                            </div>
                          </div>
                        ))}
                      {liveOrders.filter((o) => o.status === status).length === 0 && (
                        <p className="text-[10px] text-center text-[rgba(238,241,250,0.3)] py-3">No orders</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Menu Manager */}
          {tab === "menu" && (
            <motion.div key="menu" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111E33] rounded-xl border border-white/8 overflow-hidden">
                <div className="px-5 py-4 border-b border-white/8 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-[#EEF1FA]">Menu Items</h3>
                  <button className="flex items-center gap-1.5 text-xs font-bold text-[#0078D7] hover:text-[#5BB8FF] transition-colors">
                    <Plus className="w-3.5 h-3.5" /> Add Item
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/8">
                        {["Item Name", "Category", "Price", "Photo", "POS Mapped"].map(h => (
                          <th key={h} className="text-left px-5 py-3 text-[10px] font-bold text-[rgba(238,241,250,0.4)] uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {menuItems.map((item) => (
                        <tr key={item.name} className="border-b border-white/5 hover:bg-white/3 transition-colors">
                          <td className="px-5 py-3 text-xs text-[#EEF1FA] font-medium">{item.name}</td>
                          <td className="px-5 py-3 text-xs text-[rgba(238,241,250,0.6)]">{item.cat}</td>
                          <td className="px-5 py-3 text-xs text-[#22C55E] font-bold">{item.price}</td>
                          <td className="px-5 py-3">
                            {item.photo ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : <AlertCircle className="w-4 h-4 text-yellow-400" />}
                          </td>
                          <td className="px-5 py-3">
                            {item.pos ? <CheckCircle2 className="w-4 h-4 text-[#22C55E]" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* POS Integration */}
          {tab === "pos" && (
            <motion.div key="pos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {posOptions.map((pos) => (
                  <div key={pos.name} className={cn("bg-[#111E33] rounded-xl p-5 border transition-all", pos.connected ? "border-[#22C55E]/30" : "border-white/8")}>
                    <div className="text-3xl mb-3 font-bold text-[#EEF1FA]">{pos.logo}</div>
                    <h4 className="text-sm font-bold text-[#EEF1FA] mb-1">{pos.name}</h4>
                    {pos.connected ? (
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#22C55E] mb-3">
                        <CheckCircle2 className="w-3 h-3" /> Connected
                      </div>
                    ) : (
                      <div className="text-[10px] text-[rgba(238,241,250,0.4)] mb-3">Not connected</div>
                    )}
                    <button className={cn(
                      "w-full text-xs font-bold py-2 rounded-lg transition-colors",
                      pos.connected
                        ? "bg-white/5 border border-white/10 text-[rgba(238,241,250,0.6)] hover:bg-white/10"
                        : "bg-[#0078D7] text-white hover:bg-[#00447A]"
                    )}>
                      {pos.connected ? "Manage" : "Connect"}
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Google Sync */}
          {tab === "googlesync" && (
            <motion.div key="googlesync" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  {
                    icon: Star,
                    title: "GBP-Driven Events",
                    desc: "Google Posts categorized as Events are auto-imported and showcased on the homepage timeline.",
                    color: "text-yellow-400",
                    bg: "bg-yellow-400/10",
                    status: "Active",
                  },
                  {
                    icon: Link,
                    title: "First-Party Order Links",
                    desc: "Google's \"Order Food\" or \"Book\" buttons are deep-linked to the native ordering engine, bypassing aggregators.",
                    color: "text-[#22C55E]",
                    bg: "bg-[#22C55E]/10",
                    status: "Active",
                  },
                  {
                    icon: Star,
                    title: "Review Schema Bridging",
                    desc: "Top 3 reviews are embedded with ReviewSchema markup, feeding Google's rich results algorithm.",
                    color: "text-[#0078D7]",
                    bg: "bg-[#0078D7]/10",
                    status: "Active",
                  },
                  {
                    icon: Video,
                    title: "Video Reviews (Bunny.net)",
                    desc: "New 5-star reviews trigger the Bunny.net API to stitch and publish a short-form review video.",
                    color: "text-pink-400",
                    bg: "bg-pink-400/10",
                    status: "Pending API Key",
                  },
                ].map(({ icon: Icon, title, desc, color, bg, status }) => (
                  <div key={title} className="bg-[#111E33] rounded-xl p-5 border border-white/8">
                    <div className="flex items-start gap-3">
                      <div className={cn("w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center", bg)}>
                        <Icon className={cn("w-5 h-5", color)} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-bold text-[#EEF1FA]">{title}</h4>
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full", status === "Active" ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-yellow-400/15 text-yellow-400")}>
                            {status}
                          </span>
                        </div>
                        <p className="text-[10px] text-[rgba(238,241,250,0.5)] leading-relaxed">{desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Notifications */}
          {tab === "notifications" && (
            <motion.div key="notifications" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              <div className="bg-[#111E33] rounded-xl p-5 border border-white/8 space-y-4">
                <h3 className="text-sm font-bold text-[#EEF1FA]">Order Routing & Alerts</h3>
                {[
                  { label: "New order received", sub: "Notify kitchen printer + tablet", enabled: true },
                  { label: "Order ready for pickup", sub: "SMS customer automatically", enabled: true },
                  { label: "Daily revenue summary", sub: "Email report at 11pm", enabled: false },
                  { label: "Low stock alert", sub: "When menu item runs out", enabled: true },
                ].map(({ label, sub, enabled }) => (
                  <div key={label} className="flex items-center justify-between py-3 border-b border-white/8 last:border-b-0">
                    <div>
                      <div className="text-xs font-semibold text-[#EEF1FA]">{label}</div>
                      <div className="text-[10px] text-[rgba(238,241,250,0.4)]">{sub}</div>
                    </div>
                    <div className={cn("w-11 h-6 rounded-full relative transition-colors cursor-pointer", enabled ? "bg-[#22C55E]" : "bg-white/20")}>
                      <div className={cn("absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform", enabled ? "translate-x-5" : "translate-x-0.5")} />
                    </div>
                  </div>
                ))}
                <div className="pt-2 flex items-center gap-3">
                  <DollarSign className="w-4 h-4 text-[#22C55E]" />
                  <span className="text-xs text-[rgba(238,241,250,0.6)]">Revenue this week: <strong className="text-[#22C55E]">$14,820</strong></span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
