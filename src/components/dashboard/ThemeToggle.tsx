import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

/**
 * Discourse / forum-style theme toggle: a pill that slides between
 * a sun (light) and moon (dark) face. Click anywhere on the track.
 *
 * The track stays on a faint surface in both themes; the active "thumb"
 * lifts onto a brand-blue surface so the active mode reads at-a-glance.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggle } = useTheme();
  const isLight = theme === "light";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isLight}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      title={`Switch to ${isLight ? "dark" : "light"} mode`}
      onClick={toggle}
      className={cn(
        "relative inline-flex h-9 w-[70px] items-center rounded-full",
        "border transition-colors duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
        isLight
          ? "bg-muted border-border hover:bg-accent"
          : "bg-muted/60 dark:bg-white/5 border-border dark:border-white/10 hover:bg-muted dark:bg-white/10",
        className,
      )}
    >
      {/* Track icons — both visible at low opacity, the active one fades in */}
      <span className="pointer-events-none absolute inset-0 flex items-center justify-between px-2">
        <Sun
          className={cn(
            "w-3.5 h-3.5 transition-opacity duration-200",
            isLight ? "opacity-0" : "opacity-50 text-muted-foreground",
          )}
        />
        <Moon
          className={cn(
            "w-3.5 h-3.5 transition-opacity duration-200",
            isLight ? "opacity-40 text-foreground" : "opacity-0",
          )}
        />
      </span>

      {/* Sliding thumb */}
      <span
        className={cn(
          "relative z-10 inline-flex h-7 w-7 items-center justify-center rounded-full",
          "bg-[linear-gradient(135deg,#8b5cf6,#4f46e5)] text-white shadow-[0_2px_10px_rgba(124,58,237,0.45)]",
          "transition-transform duration-200 ease-out",
          isLight ? "translate-x-[37px]" : "translate-x-[4px]",
        )}
      >
        {isLight ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
      </span>
    </button>
  );
}
