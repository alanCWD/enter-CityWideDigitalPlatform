import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  User as UserIcon,
  LogOut,
  LogIn,
  LayoutDashboard,
  Users,
  Briefcase,
  ChevronDown,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";

/**
 * Profile menu dropdown shown in the top-right of the public navbar.
 *
 * Behaviour:
 * - Signed out → shows "Sign in" link to /portal/login
 * - Signed in  → shows user avatar/email; menu contents adapt to role:
 *     • admins  → Dashboard + User Management + Sign out
 *     • agency  → Dashboard + Sign out
 *     • clients → Client Portal + Sign out
 */
export function ProfileMenu() {
  const { user, signOut } = useAuth();
  const { isAdmin, isAgency, isClient } = useUserRole(user?.id);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleSignOut = async () => {
    setOpen(false);
    await signOut();
    navigate("/");
  };

  if (!user) {
    return (
      <Link
        to="/portal/login"
        className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border border-white/20 text-[rgba(238,241,250,0.65)] hover:text-[#EEF1FA] hover:bg-white/10 transition-all"
      >
        <LogIn className="w-3.5 h-3.5" /> Sign in
      </Link>
    );
  }

  const initial = (user.email || "U").charAt(0).toUpperCase();

  // Build menu items based on role. Admins see everything.
  const items: { label: string; to: string; icon: typeof UserIcon; badge?: string }[] = [];
  if (isAgency) {
    items.push({ label: "Dashboard", to: "/dashboard", icon: LayoutDashboard });
  }
  if (isAdmin) {
    items.push({ label: "User Management", to: "/admin/users", icon: Users, badge: "Admin" });
  }
  if (isClient && !isAgency) {
    items.push({ label: "Client Portal", to: "/portal", icon: Briefcase });
  }
  // Fallback for users with no role yet — still let them reach the portal
  if (items.length === 0) {
    items.push({ label: "Client Portal", to: "/portal", icon: Briefcase });
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-full border transition-all",
          open
            ? "bg-white/10 border-[#0078D7]/40"
            : "bg-white/5 border-white/15 hover:bg-white/10 hover:border-white/25",
        )}
        aria-label="Profile menu"
      >
        <div className="w-7 h-7 rounded-full bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center text-white text-xs font-bold shadow-[0_2px_6px_rgba(0,120,215,0.4)]">
          {initial}
        </div>
        <ChevronDown
          className={cn(
            "w-3 h-3 text-[rgba(238,241,250,0.55)] transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-[#111E33] border border-white/10 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden z-50">
          {/* Account header */}
          <div className="p-3 border-b border-white/8">
            <div className="flex items-center gap-2 mb-1">
              <UserIcon className="w-3 h-3 text-[#0078D7]" />
              <span className="text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider">
                Signed in
              </span>
              {isAdmin && (
                <span className="ml-auto flex items-center gap-1 text-[9px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-1.5 py-0.5 rounded-full">
                  <Shield className="w-2.5 h-2.5" /> Admin
                </span>
              )}
            </div>
            <p className="text-xs font-semibold text-[#EEF1FA] truncate">{user.email}</p>
          </div>

          {/* Menu items */}
          <nav className="p-1.5">
            {items.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-[rgba(238,241,250,0.75)] hover:bg-white/5 hover:text-[#EEF1FA] transition-colors"
              >
                <item.icon className="w-3.5 h-3.5 text-[#0078D7]" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Sign out */}
          <div className="border-t border-white/8 p-1.5">
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold text-[rgba(238,241,250,0.65)] hover:bg-red-500/10 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
