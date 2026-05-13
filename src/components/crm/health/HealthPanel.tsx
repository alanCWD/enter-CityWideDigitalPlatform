import { Activity, Globe, MapPin, Gauge, Search, ListChecks, Briefcase, RefreshCcw, Loader2, AlertCircle } from "lucide-react";
import { useClientHealth } from "@/hooks/useClientHealth";
import { ScoreHero } from "./ScoreHero";
import { CategoryCard } from "./CategoryCard";
import { LighthouseCard } from "./LighthouseCard";
import { CitationsCard } from "./CitationsCard";
import type { HealthCategory, HealthStatus } from "@/lib/healthCatalog";
import type { LucideIcon } from "lucide-react";

interface Props {
  clientId: string;
}

const CATEGORY_ICON: Record<HealthCategory, LucideIcon> = {
  foundation: Globe,
  gbp: MapPin,
  performance: Gauge,
  search: Search,
  citations: ListChecks,
  ops: Briefcase,
};

const CATEGORY_ORDER: HealthCategory[] = ["foundation", "gbp", "performance", "search", "citations", "ops"];

export function HealthPanel({ clientId }: Props) {
  const { data, loading, error, busy, lastCitations, doRefreshAuto, doLighthouse, doCitations, doToggle } = useClientHealth(clientId);

  const grouped: Record<HealthCategory, typeof data.checks> = {
    foundation: [], gbp: [], performance: [], search: [], citations: [], ops: [],
  };
  for (const r of data.checks) (grouped[r.category as HealthCategory] ??= []).push(r);

  const passCount = data.checks.filter((c) => c.status === "pass").length;
  const failCount = data.checks.filter((c) => c.status === "fail").length;

  const handleToggle = (key: string, status: HealthStatus) => doToggle(key, status);
  const handleVisibility = (key: string, visible: boolean) => {
    const row = data.checks.find((r) => r.key === key);
    if (!row) return;
    doToggle(key, row.status, { client_visible: visible });
  };

  return (
    <div className="space-y-5">
      {/* Header bar with refresh actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#0078D7]" />
            <h1 className="text-lg font-extrabold text-[#EEF1FA] uppercase tracking-wider">Digital Health</h1>
          </div>
          <p className="text-xs text-[rgba(238,241,250,0.6)] mt-1">
            One score, one dashboard — every fix this client needs to win locally.
          </p>
        </div>
        <button
          onClick={doRefreshAuto}
          disabled={busy === "auto"}
          className="bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50 text-[#EEF1FA] text-xs font-bold px-3 py-2 rounded-lg inline-flex items-center gap-2 self-start sm:self-auto"
        >
          {busy === "auto" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCcw className="w-3.5 h-3.5" />}
          Refresh auto-checks
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span className="break-words">{error}</span>
        </div>
      )}

      {loading && data.checks.length === 0 ? (
        <div className="bg-[#111E33] border border-white/10 rounded-2xl p-12 text-center">
          <Loader2 className="w-6 h-6 text-[#0078D7] animate-spin mx-auto mb-3" />
          <p className="text-sm text-[rgba(238,241,250,0.7)]">Loading health profile…</p>
        </div>
      ) : data.checks.length === 0 ? (
        <div className="bg-[#111E33] border border-white/10 rounded-2xl p-12 text-center">
          <Activity className="w-12 h-12 text-[#0078D7] mx-auto mb-3" />
          <h3 className="text-base font-bold text-[#EEF1FA] mb-1">No health data yet</h3>
          <p className="text-sm text-[rgba(238,241,250,0.6)] mb-4">
            Click "Refresh auto-checks" to compute the website, GBP, vault, and subscription signals for this client.
          </p>
          <button
            onClick={doRefreshAuto}
            disabled={busy === "auto"}
            className="bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg inline-flex items-center gap-2"
          >
            {busy === "auto" ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCcw className="w-4 h-4" />}
            Run first scan
          </button>
        </div>
      ) : (
        <>
          <ScoreHero
            score={data.score}
            bucket={data.bucket}
            label={data.label}
            totalChecks={data.checks.length}
            passCount={passCount}
            failCount={failCount}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LighthouseCard audits={data.audits} busy={busy === "lighthouse"} onRun={() => doLighthouse()} />
            <CitationsCard
              citationRows={grouped.citations}
              lastResults={lastCitations}
              busy={busy === "citations"}
              onRun={doCitations}
            />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {CATEGORY_ORDER.map((cat) => (
              <CategoryCard
                key={cat}
                category={cat}
                icon={CATEGORY_ICON[cat]}
                rows={grouped[cat] ?? []}
                onToggle={handleToggle}
                onVisibility={handleVisibility}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
