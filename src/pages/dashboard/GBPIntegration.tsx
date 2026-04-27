import { motion } from "framer-motion";
import {
  Store,
  CheckCircle,
  RefreshCw,
  Star,
  MessageCircle,
  MapPin,
  Phone,
  Globe,
  ShoppingBag,
  UtensilsCrossed,
  Calendar,
  Tag,
  FileText,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

const card = "bg-[#111E33] rounded-xl p-5 border border-white/8";

export function GBPIntegration() {
  return (
    <DashboardLayout>
      <TopBar
        title="Google Business Profile"
        subtitle="Manage connections and sync status for generated websites"
        action={{ label: "Sync Now" }}
      />

      <div className="p-6 space-y-5">
        {/* Connected Profile Banner */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${card} flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4`}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Store className="w-5 h-5 text-[#0078D7]" />
              <h2 className="text-base font-bold text-[#EEF1FA]">Acme Plumbing Services</h2>
              <span className="text-[10px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-2 py-0.5 rounded-full">Connected</span>
            </div>
            <p className="text-xs text-[rgba(238,241,250,0.55)] max-w-lg">
              Your single source of truth. Reviews, posts, menus, products, and business hours are automatically synced to the website in real-time.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button className="flex items-center gap-1.5 bg-[#0078D7]/15 border border-[#0078D7]/30 text-[#0078D7] text-xs font-bold px-3 py-2 rounded-lg hover:bg-[#0078D7]/25 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> Sync Now
            </button>
            <button className="bg-white/5 border border-white/10 text-[rgba(238,241,250,0.7)] text-xs font-bold px-3 py-2 rounded-lg hover:bg-white/10 transition-colors">
              Manage Connection
            </button>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Reviews */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className={card}>
            <div className="flex items-center gap-2 mb-3">
              <Star className="w-4 h-4 text-yellow-400" />
              <h3 className="text-xs font-bold text-[#EEF1FA]">Reviews & Ratings</h3>
            </div>
            <p className="text-[10px] text-[rgba(238,241,250,0.5)] mb-3">Showing top reviews dynamically on the homepage template.</p>
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-[#EEF1FA]">4.8</span>
              <span className="text-xs text-[rgba(238,241,250,0.5)]">/ 5.0</span>
            </div>
            <div className="flex gap-0.5 mt-1">
              {[1,2,3,4,5].map(i => (
                <Star key={i} className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              ))}
            </div>
          </motion.div>

          {/* NAP Consistency */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className={card}>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-[#22C55E]" />
              <h3 className="text-xs font-bold text-[#EEF1FA]">NAP Consistency</h3>
            </div>
            <p className="text-[10px] text-[rgba(238,241,250,0.5)] mb-3">Name, Address, Phone schema perfectly aligned with Google.</p>
            <div className="space-y-1.5">
              {[
                { icon: MapPin, label: "123 Main St, Springfield, IL" },
                { icon: Phone, label: "(555) 123-4567" },
                { icon: Globe, label: "acmeplumbing.com" },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-[10px] text-[#22C55E]">
                  <Icon className="w-3 h-3" /> {label}
                </div>
              ))}
            </div>
          </motion.div>

          {/* Content Publishing */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 }} className={card}>
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle className="w-4 h-4 text-[#0078D7]" />
              <h3 className="text-xs font-bold text-[#EEF1FA]">Content Publishing</h3>
            </div>
            <p className="text-[10px] text-[rgba(238,241,250,0.5)] mb-3">Posts, Offers, and Events are intelligently categorized and routed.</p>
            <div className="space-y-2">
              {[
                { icon: Tag, label: "Active Offers", count: "3", color: "text-[#22C55E]" },
                { icon: Calendar, label: "Upcoming Events", count: "1", color: "text-yellow-400" },
                { icon: FileText, label: "Standard Posts", count: "12", color: "text-[#0078D7]" },
              ].map(({ icon: Icon, label, count, color }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5 text-[rgba(238,241,250,0.6)]">
                    <Icon className={`w-3.5 h-3.5 ${color}`} /> {label}
                  </div>
                  <span className={`font-bold ${color}`}>{count}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Restaurant Menus */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className={card}>
            <div className="flex items-center gap-2 mb-3">
              <UtensilsCrossed className="w-4 h-4 text-orange-400" />
              <h3 className="text-xs font-bold text-[#EEF1FA]">Restaurant Menus</h3>
            </div>
            <p className="text-[10px] text-[rgba(238,241,250,0.5)] mb-3">Sync food and beverage menus directly from Google to digital dining interfaces.</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[rgba(238,241,250,0.5)]">Sync Status</span>
              <span className="text-xs font-bold text-[#22C55E]">Live (42 Items)</span>
            </div>
          </motion.div>

          {/* Retail Products */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.24 }} className={card}>
            <div className="flex items-center gap-2 mb-3">
              <ShoppingBag className="w-4 h-4 text-purple-400" />
              <h3 className="text-xs font-bold text-[#EEF1FA]">Retail Products</h3>
            </div>
            <p className="text-[10px] text-[rgba(238,241,250,0.5)] mb-3">Automatically display your live retail product catalog and in-store inventory.</p>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[rgba(238,241,250,0.5)]">Catalog Items</span>
              <span className="text-xs font-bold text-[#0078D7]">128</span>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
