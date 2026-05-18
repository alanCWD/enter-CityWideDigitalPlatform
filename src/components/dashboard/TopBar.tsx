import { Bell, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ClientSearch } from "./ClientSearch";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function TopBar({ title, subtitle, action }: TopBarProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 backdrop-blur border-b px-6 py-4 flex items-center justify-between gap-4",
        isDark
          ? "bg-[#0D1526]/95 border-white/8"
          : "bg-background/95 border-border",
      )}
    >
      <div>
        <h1
          className={cn(
            "text-lg font-bold leading-tight",
            isDark ? "text-[#EEF1FA]" : "text-foreground",
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p
            className={cn(
              "text-xs mt-0.5",
              isDark ? "text-[rgba(238,241,250,0.5)]" : "text-muted-foreground",
            )}
          >
            {subtitle}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        {/* GBP Client Search */}
        <ClientSearch />

        {/* Notifications */}
        <button
          className={cn(
            "relative p-2 rounded-lg border transition-colors",
            isDark
              ? "bg-white/5 border-white/10 text-[rgba(238,241,250,0.6)] hover:text-[#EEF1FA] hover:bg-white/10"
              : "bg-muted border-border text-muted-foreground hover:text-foreground hover:bg-accent",
          )}
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-[#0078D7] rounded-full" />
        </button>

        {/* Light / dark theme toggle */}
        <ThemeToggle />

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

        {/* Profile menu (avatar + dropdown) */}
        <ProfileMenu />
      </div>
    </header>
  );
}
