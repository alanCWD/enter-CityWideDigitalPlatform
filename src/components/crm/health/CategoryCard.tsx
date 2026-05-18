import { ChevronDown, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { CATEGORY_META, type HealthCategory } from "@/lib/healthCatalog";
import type { HealthCheckRow } from "@/lib/health";
import { CheckRow } from "./CheckRow";
import type { HealthStatus } from "@/lib/healthCatalog";

interface Props {
  category: HealthCategory;
  icon: LucideIcon;
  rows: HealthCheckRow[];
  defaultOpen?: boolean;
  readOnly?: boolean;
  onToggle?: (key: string, status: HealthStatus) => void;
  onVisibility?: (key: string, visible: boolean) => void;
}

export function CategoryCard({ category, icon: Icon, rows, defaultOpen = true, readOnly, onToggle, onVisibility }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = CATEGORY_META[category];
  const passing = rows.filter((r) => r.status === "pass").length;
  const total = rows.length;
  const failing = rows.filter((r) => r.status === "fail").length;
  const pct = total > 0 ? Math.round((passing / total) * 100) : 0;

  const dotColor = failing > total / 2 ? "#EF4444" : passing >= total * 0.75 ? "#22C55E" : "#F97316";

  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/40 dark:bg-white/3 transition-colors text-left"
      >
        <span className="w-10 h-10 rounded-xl bg-muted/60 dark:bg-white/5 border border-border dark:border-white/10 flex items-center justify-center text-foreground dark:text-[#EEF1FA] shrink-0">
          <Icon className="w-5 h-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">{meta.label}</h3>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta.blurb}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-extrabold text-foreground dark:text-[#EEF1FA]">{passing}/{total}</div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{pct}% passing</div>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="px-2 pb-3 border-t border-border dark:border-white/5">
          {rows.length === 0 ? (
            <p className="text-xs text-muted-foreground py-3 px-3">No checks in this category yet — run a refresh to populate.</p>
          ) : (
            rows.map((r) => (
              <CheckRow
                key={r.key}
                row={r}
                readOnly={readOnly}
                onToggle={onToggle ? (s) => onToggle(r.key, s) : undefined}
                onVisibility={onVisibility ? (v) => onVisibility(r.key, v) : undefined}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
