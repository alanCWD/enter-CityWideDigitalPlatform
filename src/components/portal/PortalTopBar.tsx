import { NavLink, useNavigate, useParams } from "react-router-dom";
import { LogOut, Store, Share2, BarChart3, GraduationCap, Home } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { LogoOnDark } from "@/components/branding/Logo";

const TABS = [
  { name: "Overview", path: "", icon: Home, end: true },
  { name: "GBP", path: "gbp", icon: Store, end: false },
  { name: "Social", path: "social", icon: Share2, end: false },
  { name: "Coach", path: "coach", icon: GraduationCap, end: false },
  { name: "Analytics", path: "analytics", icon: BarChart3, end: false },
];

interface PortalTopBarProps {
  connection: PortalConnection;
  /** Other connections this user can switch to. */
  otherConnections: PortalConnection[];
}

export function PortalTopBar({ connection, otherConnections }: PortalTopBarProps) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { clientId } = useParams();

  const handleSignOut = async () => {
    await signOut();
    navigate("/portal/login");
  };

  const handleSwitch = (id: string) => {
    navigate(`/portal/${id}`);
  };

  return (
    <header className="sticky top-0 z-30 bg-[#0D1526]/90 backdrop-blur-xl border-b border-white/8">
      <div className="px-6 py-3.5 flex items-center justify-between gap-4">
        {/* Brand + business name */}
        <div className="flex items-center gap-3 min-w-0">
          <LogoOnDark size="sm" className="flex-shrink-0" />
          <div className="hidden sm:block w-px h-6 bg-white/10 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[10px] font-bold text-[#0078D7] uppercase tracking-wider">Client Portal</div>
            <div className="text-[#EEF1FA] font-bold text-sm truncate">
              {connection.business_name || connection.client_label}
            </div>
          </div>

          {otherConnections.length > 0 && (
            <select
              value={clientId}
              onChange={(e) => handleSwitch(e.target.value)}
              className="ml-3 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-[#EEF1FA] focus:outline-none focus:border-[#0078D7]"
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

        {/* Account menu */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[rgba(238,241,250,0.5)] hidden sm:block">{user?.email}</span>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-[rgba(238,241,250,0.6)] hover:text-[#EEF1FA] hover:bg-white/10 text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
          >
            <LogOut className="w-3 h-3" />
            Sign out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <nav className="px-6 flex items-center gap-1 overflow-x-auto">
        {TABS.map((tab) => (
          <NavLink
            key={tab.path}
            to={`/portal/${clientId}${tab.path ? "/" + tab.path : ""}`}
            end={tab.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold border-b-2 transition-colors flex-shrink-0",
                isActive
                  ? "text-[#0078D7] border-[#0078D7]"
                  : "text-[rgba(238,241,250,0.5)] border-transparent hover:text-[#EEF1FA]"
              )
            }
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.name}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}
