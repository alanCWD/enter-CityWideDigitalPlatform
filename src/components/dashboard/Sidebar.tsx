import { NavLink } from "react-router-dom";
import {
  Building2,
  LayoutTemplate,
  Store,
  BarChart3,
  Bell,
  Utensils,
  X,
  Menu,
  TrendingUp,
  MessagesSquare,
  ExternalLink,
  Receipt,
  Users,
  Package,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Logo, LogoOnDark } from "@/components/branding/Logo";
import { useTheme } from "@/hooks/useTheme";

const NAV_ITEMS = [
  { name: "Dashboard", path: "/dashboard", icon: Building2 },
  { name: "App Builder", path: "/builder", icon: LayoutTemplate },
  { name: "GBP Integration", path: "/gbp", icon: Store },
  { name: "Ordering & Menus", path: "/restaurant", icon: Utensils },
  { name: "Analytics", path: "/analytics", icon: BarChart3 },
  { name: "Leads & Alerts", path: "/leads", icon: Bell },
  { name: "CRM & Billing", path: "/dashboard/crm", icon: Receipt },
  { name: "Clients", path: "/dashboard/crm/clients", icon: Users },
  { name: "Products & Plans", path: "/dashboard/crm/catalog", icon: Package },
];

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-sidebar text-sidebar-foreground border border-sidebar-border shadow-lg"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-sidebar border-r border-sidebar-border fixed top-0 left-0 bottom-0 z-40">
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
              className="fixed top-0 left-0 bottom-0 w-60 bg-sidebar border-r border-sidebar-border z-50 md:hidden flex flex-col"
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
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-border flex items-center justify-between gap-2">
        {isDark ? <LogoOnDark size="sm" /> : <Logo size="sm" />}
        <div className="text-[#0078D7] text-[9px] font-bold uppercase tracking-wider whitespace-nowrap">
          Command Center
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 p-3 space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onNav}
            end={item.path === "/dashboard" || item.path === "/dashboard/crm"}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 w-full font-medium",
                isActive
                  ? "bg-primary/15 text-primary font-semibold border border-primary/20"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className={cn("w-4 h-4 flex-shrink-0", isActive ? "text-primary" : "text-sidebar-foreground/50")} />
                {item.name}
              </>
            )}
          </NavLink>
        ))}

        {/* External link: Community Forum */}
        <a
          href="https://forum.citywidedigital.ca/"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNav}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 w-full text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground font-medium group"
        >
          <MessagesSquare className="w-4 h-4 flex-shrink-0 text-sidebar-foreground/50 group-hover:text-primary" />
          <span className="flex-1">Forum</span>
          <ExternalLink className="w-3 h-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60" />
        </a>
      </nav>

      {/* Lead Velocity Widget */}
      <div className="mx-3 mb-3 p-3 rounded-xl bg-primary/10 border border-primary/20">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-sidebar-foreground/50 uppercase tracking-wider">Lead Velocity</span>
          <TrendingUp className="w-3 h-3 text-[#22C55E]" />
        </div>
        <div className="text-xl font-extrabold text-sidebar-foreground">+142</div>
        <div className="text-[10px] text-[#22C55E] font-semibold">+12% this month</div>
        <div className="mt-2 h-1 bg-sidebar-foreground/10 rounded-full">
          <div className="h-1 bg-[linear-gradient(90deg,#0078D7,#22C55E)] rounded-full w-3/4" />
        </div>
        <div className="text-[10px] text-sidebar-foreground/40 mt-1">Next tier: Enterprise Scale</div>
      </div>

      {/* Settings */}
      <div className="p-3 border-t border-sidebar-border">
        <NavLink
          to="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
        >
          <Store className="w-4 h-4" />
          Settings
        </NavLink>
      </div>
    </div>
  );
}
