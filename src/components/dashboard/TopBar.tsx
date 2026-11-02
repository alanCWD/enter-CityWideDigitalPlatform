import { Bell, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { ClientSearch } from "./ClientSearch";
import { ThemeToggle } from "./ThemeToggle";
import { ProfileMenu } from "@/components/layout/ProfileMenu";

interface TopBarProps {
  title: string;
  subtitle?: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

const ctaClassName =
  "flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#8b5cf6,#4f46e5)] text-white text-xs font-bold px-3 py-2 transition-all duration-150 shadow-[0_2px_12px_rgba(124,58,237,0.4)] hover:-translate-y-px hover:shadow-[0_4px_18px_rgba(124,58,237,0.5)] active:scale-[0.98]";

export function TopBar({ title, subtitle, action }: TopBarProps) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-white/10 bg-[#0D1526]/95 px-6 py-4 backdrop-blur-2xl">
      <div>
        <h1 className="text-lg font-bold leading-tight text-foreground">{title}</h1>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* GBP Client Search */}
        <ClientSearch />

        {/* Notifications */}
        <button className="relative rounded-xl border border-white/10 bg-white/5 p-2 text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground">
          <Bell className="h-4 w-4" />
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#0078D7] ring-2 ring-background" />
        </button>

        {/* Light / dark theme toggle */}
        <ThemeToggle />

        {/* Action CTA */}
        {action &&
          (action.href ? (
            <Link to={action.href} className={ctaClassName}>
              {action.label}
              <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <button onClick={action.onClick} className={ctaClassName}>
              {action.label}
            </button>
          ))}

        {/* Profile menu (avatar + dropdown) */}
        <ProfileMenu />
      </div>
    </header>
  );
}
