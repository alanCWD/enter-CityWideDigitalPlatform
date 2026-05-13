import { ListChecks, Loader2, ExternalLink, Check, X, AlertTriangle, HelpCircle } from "lucide-react";
import type { CitationProbeResult, HealthCheckRow } from "@/lib/health";
import { STATUS_COLOR } from "@/lib/health";
import { checkLabel } from "@/lib/healthCatalog";
import type { HealthStatus } from "@/lib/healthCatalog";

interface Props {
  citationRows: HealthCheckRow[];   // current persisted check rows for citations
  lastResults: CitationProbeResult[] | null;
  busy?: boolean;
  onRun?: () => void;
  readOnly?: boolean;
}

const ICON: Record<HealthStatus, typeof Check> = {
  pass: Check, warn: AlertTriangle, fail: X, unknown: HelpCircle, skipped: HelpCircle,
};

export function CitationsCard({ citationRows, lastResults, busy, onRun, readOnly }: Props) {
  // Build a list keyed by directory check key (citation_*)
  const directoryRows = citationRows.filter((r) => r.key.startsWith("citation_"));
  const passing = directoryRows.filter((r) => r.status === "pass").length;
  const total = directoryRows.length;

  return (
    <div className="bg-[#111E33] border border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center">
            <ListChecks className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-[#EEF1FA]">Citations & Listings</h3>
            <p className="text-xs text-[rgba(238,241,250,0.55)]">Heuristic scan across {total || 15} key directories — checks if your business appears.</p>
          </div>
        </div>
        {!readOnly && onRun && (
          <button
            onClick={onRun}
            disabled={busy}
            className="bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 shrink-0"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ListChecks className="w-3.5 h-3.5" />}
            {busy ? "Scanning…" : "Scan listings"}
          </button>
        )}
      </div>

      {total > 0 && (
        <div className="mb-3 flex items-center gap-3">
          <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${(passing / total) * 100}%`, backgroundColor: passing >= total * 0.7 ? "#22C55E" : passing >= total * 0.4 ? "#F97316" : "#EF4444" }} />
          </div>
          <span className="text-xs font-bold text-[#EEF1FA] tabular-nums">{passing}/{total}</span>
        </div>
      )}

      {directoryRows.length === 0 ? (
        <div className="bg-white/3 border border-white/10 rounded-lg p-5 text-center">
          <p className="text-xs text-[rgba(238,241,250,0.55)]">
            No citation scan yet. {readOnly ? "Your agency hasn't run a listing scan." : 'Click "Scan listings" — takes about 10 seconds.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {directoryRows.map((r) => {
            const Icon = ICON[r.status];
            const color = STATUS_COLOR[r.status];
            const liveResult = lastResults?.find((x) => x.key === r.key);
            const url = liveResult?.listing_url ?? r.evidence_url;
            return (
              <li key={r.key} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: color.bg, color: color.fg }}>
                  <Icon className="w-3 h-3" />
                </span>
                <span className="text-xs text-[#EEF1FA] flex-1 truncate">
                  {checkLabel(r.key).replace(/^Listed on /, "")}
                </span>
                {url && (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#0078D7] hover:underline inline-flex items-center gap-0.5 shrink-0">
                    open <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[10px] text-[rgba(238,241,250,0.4)] mt-3">
        Heuristic: matches business name + city/postal/phone in directory search results. False positives possible — verify before sharing externally.
      </p>
    </div>
  );
}
