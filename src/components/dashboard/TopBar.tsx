import { Bell, Search, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function TopBar({ title, subtitle, action }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-[#0D1526]/95 backdrop-blur border-b border-white/8 px-6 py-4 flex items-center justify-between gap-4">
      <div>
        <h1 className="text-lg font-bold text-[#EEF1FA] leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-[rgba(238,241,250,0.5)] mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden sm:flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-[rgba(238,241,250,0.4)] w-52">
          <Search className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="text-xs">Search clients...</span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 rounded-lg bg-white/5 border border-white/10 text-[rgba(238,241,250,0.6)] hover:text-[#EEF1FA] hover:bg-white/10 transition-colors">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#0078D7] rounded-full" />
        </button>

        {/* Action CTA */}
        {action && (
          action.href ? (
            <Link
              to={action.href}
              className="flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-[0_2px_8px_rgba(0,120,215,0.3)]"
            >
              {action.label}
              <ExternalLink className="w-3 h-3" />
            </Link>
          ) : (
            <button
              onClick={action.onClick}
              className="flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] text-white text-xs font-bold px-3 py-2 rounded-lg transition-colors shadow-[0_2px_8px_rgba(0,120,215,0.3)]"
            >
              {action.label}
            </button>
          )
        )}

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
          AG
        </div>
      </div>
    </header>
  );
}
