import { Check, X, AlertTriangle, HelpCircle, MinusCircle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { STATUS_COLOR } from "@/lib/health";
import type { HealthStatus } from "@/lib/healthCatalog";
import type { HealthCheckRow } from "@/lib/health";
import { checkDef } from "@/lib/healthCatalog";

interface Props {
  row: HealthCheckRow;
  readOnly?: boolean;
  onToggle?: (status: HealthStatus) => void;
  onVisibility?: (visible: boolean) => void;
}

const ICON: Record<HealthStatus, typeof Check> = {
  pass: Check, warn: AlertTriangle, fail: X, unknown: HelpCircle, skipped: MinusCircle,
};

export function CheckRow({ row, readOnly, onToggle, onVisibility }: Props) {
  const def = checkDef(row.key);
  const Icon = ICON[row.status];
  const color = STATUS_COLOR[row.status];

  return (
    <div className="flex items-start gap-3 py-2.5 px-3 rounded-lg hover:bg-muted/40 dark:bg-white/3 transition-colors">
      <span
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
        style={{ backgroundColor: color.bg, color: color.fg }}
      >
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-foreground dark:text-[#EEF1FA] leading-snug">{def?.label ?? row.key}</p>
          {row.weight >= 4 && (
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/60 dark:bg-white/5 border border-border dark:border-white/10 rounded px-1.5 py-0.5">
              High impact
            </span>
          )}
        </div>
        {row.evidence && (
          <p className="text-xs text-muted-foreground mt-0.5 break-words">
            {row.evidence}
            {row.evidence_url && (
              <a href={row.evidence_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 ml-2 text-[#0078D7] hover:underline">
                view <ExternalLink className="w-2.5 h-2.5" />
              </a>
            )}
          </p>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center gap-1 shrink-0">
          {onVisibility && (
            <button
              onClick={() => onVisibility(!row.client_visible)}
              title={row.client_visible ? "Visible to client — click to hide" : "Hidden from client — click to share"}
              className="p-1.5 rounded text-muted-foreground hover:text-foreground dark:text-[#EEF1FA] hover:bg-muted/60 dark:bg-white/5"
            >
              {row.client_visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          )}
          {onToggle && (
            <select
              value={row.status}
              onChange={(e) => onToggle(e.target.value as HealthStatus)}
              className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded text-[10px] uppercase tracking-wider font-bold px-1.5 py-1 text-muted-foreground"
              title="Override status"
            >
              <option value="pass">Pass</option>
              <option value="warn">Warn</option>
              <option value="fail">Fail</option>
              <option value="unknown">Unknown</option>
              <option value="skipped">Skipped</option>
            </select>
          )}
        </div>
      )}
    </div>
  );
}
