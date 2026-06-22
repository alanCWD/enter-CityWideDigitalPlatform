import { NavLink, useNavigate, useParams } from "react-router-dom";
import { LogOut, Store, Share2, BarChart3, Home, Shield, Activity, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { LogoOnDark } from "@/components/branding/Logo";

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
  const navigate = useNavigate();
  const { clientId } = useParams();

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  return (
    <aside className="fixed inset-y-0 left-0 z-30 w-56 flex flex-col bg-[#0D1526] border-r border-white/8">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/8">
        <LogoOnDark size="sm" />
        <div className="mt-3">
          <div className="text-[9px] font-bold text-[#0078D7] uppercase tracking-widest mb-0.5">Client Portal</div>
          <div className="text-[#EEF1FA] font-bold text-sm leading-tight truncate">
            {connection.business_name || connection.client_label}
          </div>
        </div>

        {otherConnections.length > 0 && (
          <select
            value={clientId}
            onChange={(e) => navigate(`/portal/${e.target.value}`)}
            className="mt-2 w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-[#EEF1FA] focus:outline-none focus:border-[#0078D7]"
          >
            <option value={connection.id} className="bg-[#0D1526]">
              {connection.business_name || connection.client_label}
            </option>
            {otherConnections.map((c) => (
              <option key={c.id} value={c.id} className="bg-[#0D1526]">
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
                  ? "bg-[#0078D7]/20 text-[#0078D7] shadow-[inset_0_0_0_1px_rgba(0,120,215,0.25)]"
                  : "text-[rgba(238,241,250,0.55)] hover:text-[#EEF1FA] hover:bg-white/5"
              )
            }
          >
            <tab.icon className="w-4 h-4 flex-shrink-0" />
            {tab.name}
          </NavLink>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="px-4 py-4 border-t border-white/8">
        <div className="text-[10px] text-[rgba(238,241,250,0.4)] truncate mb-2">{user?.email}</div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 w-full text-[11px] font-bold text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA] hover:bg-white/5 px-3 py-2 rounded-lg transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
