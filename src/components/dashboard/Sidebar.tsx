import { NavLink } from "react-router-dom";
import {
  Building2,
  LayoutTemplate,
  Store,
  BarChart3,
  Bell,
  GraduationCap,
  Utensils,
  Zap,
  X,
  Menu,
  TrendingUp,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard", icon: Building2 },
  { name: "App Builder", path: "/builder", icon: LayoutTemplate },
  { name: "GBP Integration", path: "/gbp", icon: Store },
  { name: "Ordering & Menus", path: "/restaurant", icon: Utensils },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Leads & Alerts", path: "/leads", icon: Bell },
  { name: "GSO Coach", path: "/coaching", icon: GraduationCap },
];

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-[#0A1120] border border-white/10 text-[#EEF1FA] shadow-lg"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-[#0A1120] border-r border-white/10 fixed top-0 left-0 bottom-0 z-40">
        <SidebarContent onNav={() => {}} />
      </aside>

      {/* Mobile Overlay */}
      <AnimatePresence>
        {isMobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 z-40 md:hidden"
              onClick={() => setIsMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -240 }}
              animate={{ x: 0 }}
              exit={{ x: -240 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed top-0 left-0 bottom-0 w-60 bg-[#0A1120] border-r border-white/10 z-50 md:hidden flex flex-col"
            >
              <SidebarContent onNav={() => setIsMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function SidebarContent({ onNav }: { onNav: () => void }) {
  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center shadow-[0_2px_8px_rgba(0,120,215,0.4)]">
          <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <div className="text-[#EEF1FA] font-bold text-sm leading-tight">CityWide</div>
          <div className="text-[#0078D7] text-[10px] font-semibold uppercase tracking-wider">Command Center</div>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNav}
            end={item.path === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 w-full",
                isActive
                  ? "bg-[#0078D7]/15 text-[#0078D7] font-semibold border border-[#0078D7]/20"
                  : "text-[rgba(238,241,250,0.65)] hover:bg-white/5 hover:text-[#EEF1FA] font-medium"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-[#0078D7]" : "text-[rgba(238,241,250,0.5)]")} />
                {item.name}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Lead Velocity Widget */}
      <div className="mx-3 mb-3 p-3 rounded-xl bg-[#0078D7]/10 border border-[#0078D7]/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider">Lead Velocity</span>
          <TrendingUp className="w-3 h-3 text-[#22C55E]" />
        </div>
        <div className="text-xl font-extrabold text-[#EEF1FA]">+142</div>
        <div className="text-[10px] text-[#22C55E] font-semibold">+12% this month</div>
        <div className="mt-2 h-1 bg-white/10 rounded-full">
          <div className="h-1 bg-[linear-gradient(90deg,#0078D7,#22C55E)] rounded-full w-3/4" />
        </div>
        <div className="text-[10px] text-[rgba(238,241,250,0.4)] mt-1">Next tier: Enterprise Scale</div>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-white/10">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[rgba(238,241,250,0.5)] hover:bg-white/5 hover:text-[#EEF1FA] transition-colors"
        >
          <Store className="w-4 h-4" />
          Settings
        </NavLink>
      </div>
    </div>
  );
}
