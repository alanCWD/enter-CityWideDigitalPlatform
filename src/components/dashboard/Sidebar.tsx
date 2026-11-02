import { NavLink } from "react-router-dom";
import { X, Menu, TrendingUp, MessagesSquare, ExternalLink, Store } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useAgency } from "@/contexts/AgencyContext";
import { AgencySwitcher } from "./AgencySwitcher";

export function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile Toggle */}
      <button
        onClick={() => setIsMobileOpen(!isMobileOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-xl bg-sidebar backdrop-blur-2xl text-sidebar-foreground border border-sidebar-border shadow-lg"
      >
        {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-sidebar backdrop-blur-2xl border-r border-sidebar-border fixed top-0 left-0 bottom-0 z-40">
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
              className="fixed top-0 left-0 bottom-0 w-60 bg-sidebar backdrop-blur-2xl border-r border-sidebar-border z-50 md:hidden flex flex-col"
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
  const { agency } = useAgency();

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* Agency Switcher — replaces logo area */}
      <AgencySwitcher />

      {/* Nav Items — agency-specific */}
      <nav className="flex-1 p-3 space-y-0.5">
        {agency.navItems.map((item) =>
          item.external ? (
            /* External app (e.g. Review Engine) — opens in a new tab */
            <a
              key={item.path + item.name}
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onNav}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 w-full font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground group"
            >
              <item.icon className="w-4 h-4 flex-shrink-0 text-sidebar-foreground/50 group-hover:text-primary" />
              <span className="flex-1">{item.name}</span>
              <ExternalLink className="w-3 h-3 text-sidebar-foreground/30 group-hover:text-sidebar-foreground/60" />
            </a>
          ) : (
            <NavLink
              key={item.path + item.name}
              to={item.path}
              onClick={onNav}
              end={item.end ?? false}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 w-full font-medium",
                  isActive
                    ? "bg-primary/15 text-foreground font-semibold border border-primary/30 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
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
          ),
        )}

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
      <div className="mx-3 mb-3 p-3 rounded-xl bg-primary/10 border border-primary/20 backdrop-blur-xl">
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
