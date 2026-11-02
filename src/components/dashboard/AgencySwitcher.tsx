import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAgency } from "@/contexts/AgencyContext";
import { ACCENT_CLASSES } from "@/lib/agencies";
import { cn } from "@/lib/utils";

export function AgencySwitcher() {
  const { agency, agencies, setAgencySlug } = useAgency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const accent = ACCENT_CLASSES[agency.accent];
  const Icon = agency.icon;

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "w-full flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border",
          "hover:bg-sidebar-accent/40 transition-colors text-left"
        )}
      >
        {/* Brand icon */}
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", accent.bg, accent.border, "border")}>
          <Icon className={cn("w-4 h-4", accent.text)} />
        </div>

        {/* Name + tagline */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-sidebar-foreground truncate leading-tight">{agency.name}</p>
          <p className="text-[10px] text-sidebar-foreground/40 truncate leading-tight">{agency.tagline}</p>
        </div>

        <ChevronDown className={cn("w-3.5 h-3.5 text-sidebar-foreground/40 shrink-0 transition-transform", open && "rotate-180")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-sidebar backdrop-blur-2xl border border-sidebar-border rounded-b-xl shadow-[0_24px_60px_-24px_rgba(5,3,18,0.8)] overflow-hidden">
          {agencies.map((a) => {
            const ac = ACCENT_CLASSES[a.accent];
            const AIcon = a.icon;
            const isActive = a.slug === agency.slug;
            return (
              <button
                key={a.slug}
                onClick={() => { setAgencySlug(a.slug); setOpen(false); }}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                  isActive
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/60"
                )}
              >
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", ac.bg, ac.border, "border")}>
                  <AIcon className={cn("w-3.5 h-3.5", ac.text)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-sidebar-foreground truncate">{a.name}</p>
                  <p className="text-[10px] text-sidebar-foreground/40 truncate">{a.tagline}</p>
                </div>
                {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
