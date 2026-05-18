import { Gauge, Loader2, Smartphone, Monitor } from "lucide-react";
import type { HealthAuditRow } from "@/lib/health";

interface Props {
  audits: HealthAuditRow[];
  busy?: boolean;
  onRun?: () => void;
  readOnly?: boolean;
}

export function LighthouseCard({ audits, busy, onRun, readOnly }: Props) {
  // Take the latest mobile + desktop record
  const latestMobile = audits.find((a) => a.strategy === "mobile");
  const latestDesktop = audits.find((a) => a.strategy === "desktop");

  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <span className="w-9 h-9 rounded-xl bg-[#0078D7]/15 text-[#0078D7] flex items-center justify-center">
            <Gauge className="w-4 h-4" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">Lighthouse Audit</h3>
            <p className="text-xs text-muted-foreground">Powered by Google PageSpeed Insights — runs against the live website.</p>
          </div>
        </div>
        {!readOnly && onRun && (
          <button
            onClick={onRun}
            disabled={busy}
            className="bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-1.5 shrink-0"
          >
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Gauge className="w-3.5 h-3.5" />}
            {busy ? "Running…" : "Run audit"}
          </button>
        )}
      </div>

      {!latestMobile && !latestDesktop ? (
        <div className="bg-muted/40 dark:bg-white/3 border border-border dark:border-white/10 rounded-lg p-5 text-center">
          <p className="text-xs text-muted-foreground">
            No audit yet. {readOnly ? "Your agency hasn't run a Lighthouse audit." : 'Click "Run audit" — usually takes 20–40 seconds.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {latestMobile && <StrategyBlock icon={Smartphone} label="Mobile" audit={latestMobile} />}
          {latestDesktop && <StrategyBlock icon={Monitor} label="Desktop" audit={latestDesktop} />}
        </div>
      )}

      {latestMobile && (
        <p className="text-[10px] text-muted-foreground mt-3 text-right">
          Last run {new Date(latestMobile.created_at).toLocaleString()} · {latestMobile.url}
        </p>
      )}
    </div>
  );
}

function StrategyBlock({ icon: Icon, label, audit }: { icon: typeof Smartphone; label: string; audit: HealthAuditRow }) {
  return (
    <div className="bg-[#0D1526] border border-border dark:border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <ScoreCell label="Performance" value={audit.performance} />
        <ScoreCell label="SEO" value={audit.seo} />
        <ScoreCell label="A11y" value={audit.accessibility} />
        <ScoreCell label="Best practices" value={audit.best_practices} />
      </div>
      <div className="mt-3 pt-3 border-t border-border dark:border-white/5 grid grid-cols-3 gap-2">
        <CwvCell label="LCP" value={audit.lcp_ms ? `${(audit.lcp_ms / 1000).toFixed(1)}s` : "—"} good={!!audit.lcp_ms && audit.lcp_ms <= 2500} />
        <CwvCell label="CLS" value={audit.cls != null ? audit.cls.toFixed(2) : "—"} good={audit.cls != null && audit.cls <= 0.1} />
        <CwvCell label="INP" value={audit.inp_ms ? `${audit.inp_ms}ms` : "—"} good={audit.inp_ms != null && (audit.inp_ms === 0 || audit.inp_ms <= 200)} />
      </div>
    </div>
  );
}

function ScoreCell({ label, value }: { label: string; value: number | null }) {
  const v = value ?? 0;
  const color = v >= 90 ? "#22C55E" : v >= 50 ? "#F97316" : "#EF4444";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-1">{label}</div>
      <div className="text-xl font-extrabold leading-none" style={{ color }}>{value ?? "—"}</div>
    </div>
  );
}

function CwvCell({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
      <div className="text-sm font-extrabold mt-0.5" style={{ color: good ? "#22C55E" : "#F97316" }}>{value}</div>
    </div>
  );
}
