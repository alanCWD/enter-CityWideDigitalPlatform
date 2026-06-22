import { NavLink, useNavigate, useParams } from "react-router-dom";
import { LogOut, Store, Share2, BarChart3, Home, Shield, Activity, Users, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { Logo, LogoOnDark } from "@/components/branding/Logo";

const TABS = [
  { name: "Overview",  path: "",          icon: Home,     end: true  },
  { name: "Health",    path: "health",    icon: Activity, end: false },
  { name: "GBP",       path: "gbp",       icon: Store,    end: false },
  { name: "Social",    path: "social",    icon: Share2,   end: false },
  { name: "CRM",       path: "crm",       icon: Users,    end: false },
  { name: "Analytics", path: "analytics", icon: BarChart3,end: false },
  { name: "Vault",     path: "vault",     icon: Shield,   end: false },
];

interface PortalSidebarProps {
  connection: PortalConnection;
  otherConnections: PortalConnection[];
}

export function PortalTopBar({ connection, otherConnections }: PortalSidebarProps) {
  const { user, signOut } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();
  const { clientId } = useParams();

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-56 flex flex-col bg-sidebar border-r border-sidebar-border">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-sidebar-border">
        {/* Adaptive logo */}
        <Logo size="sm" className="dark:hidden" />
        <LogoOnDark size="sm" className="hidden dark:block" />

        <div className="mt-3">
          <div className="text-[9px] font-bold text-primary uppercase tracking-widest mb-0.5">Client Portal</div>
          <div className="text-sidebar-foreground font-bold text-sm leading-tight truncate">
            {connection.business_name || connection.client_label}
          </div>
        </div>

        {otherConnections.length > 0 && (
          <select
            value={clientId}
            onChange={(e) => navigate(`/portal/${e.target.value}`)}
            className="mt-2 w-full bg-muted/50 border border-sidebar-border rounded-lg px-2 py-1.5 text-[11px] text-sidebar-foreground focus:outline-none focus:border-primary"
          >
            <option value={connection.id}>
              {connection.business_name || connection.client_label}
            </option>
            {otherConnections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.business_name || c.client_label}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/portal/${clientId}${tab.path ? "/" + tab.path : ""}`}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all w-full",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
              )
            }
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" />
            {tab.name}
          </NavLink>
        ))}
      </nav>

      {/* Bottom: theme toggle + user + sign out */}
      <div className="px-4 py-4 border-t border-sidebar-border space-y-2">
        {/* Theme toggle — appears pressed-in when light mode is active */}
        <button
          onClick={toggle}
          title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
          className={cn(
            "flex items-center gap-2 w-full px-3 py-2 rounded-lg text-[11px] font-bold transition-all",
            theme === "light"
              ? "bg-primary/15 text-primary shadow-[inset_0_1px_3px_rgba(0,0,0,0.15)] border border-primary/20"
              : "text-sidebar-foreground/55 hover:text-sidebar-foreground hover:bg-sidebar-accent border border-transparent"
          )}
        >
          <Sun className="w-3.5 h-3.5 flex-shrink-0" />
          Light mode
        </button>

        {/* User email */}
        <div className="text-[10px] text-sidebar-foreground/40 truncate px-3">{user?.email}</div>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full text-[11px] font-bold text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent px-3 py-2 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
