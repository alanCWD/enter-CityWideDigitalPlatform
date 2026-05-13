import { useEffect, useState } from "react";
import { Loader2, Activity, Globe, MapPin, Gauge, Search, ListChecks, Briefcase, AlertCircle } from "lucide-react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import type { PortalConnection } from "@/hooks/usePortalConnections";
import { ScoreHero } from "@/components/crm/health/ScoreHero";
import { CategoryCard } from "@/components/crm/health/CategoryCard";
import { LighthouseCard } from "@/components/crm/health/LighthouseCard";
import { CitationsCard } from "@/components/crm/health/CitationsCard";
import type { HealthAuditRow, HealthBucket, HealthCheckRow } from "@/lib/health";
import type { HealthCategory } from "@/lib/healthCatalog";
import type { LucideIcon } from "lucide-react";

interface PortalHealthData {
  score: number;
  bucket: HealthBucket;
  label: string;
  client_name: string;
  checks: Array<Pick<HealthCheckRow, "key" | "category" | "status" | "weight" | "evidence" | "evidence_url" | "metric_value" | "updated_at">>;
  audits: HealthAuditRow[];
}

const CATEGORY_ICON: Record<HealthCategory, LucideIcon> = {
  foundation: Globe, gbp: MapPin, performance: Gauge, search: Search, citations: ListChecks, ops: Briefcase,
};
const CATEGORY_ORDER: HealthCategory[] = ["foundation", "gbp", "performance", "search", "citations", "ops"];

function HealthContent({ connection }: { connection: PortalConnection }) {
  const [data, setData] = useState<PortalHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError(null);
    supabase.functions.invoke("portal-health", { body: { connection_id: connection.id } })
      .then(({ data: d, error: err }) => {
        if (cancelled) return;
        if (err) { setError(err.message); return; }
        if (d && typeof d === "object" && "error" in d && d.error) { setError(String(d.error)); return; }
        setData(d as PortalHealthData);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [connection.id]);

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-[rgba(238,241,250,0.6)]"><Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading health profile…</div>;
  }
  if (error) {
    return (
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-5 py-4 text-sm text-amber-200">
        <p className="font-bold flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Health snapshot unavailable</p>
        <p className="text-xs mt-1 opacity-80">{error}</p>
      </div>
    );
  }
  if (!data) return null;

  const checks = data.checks as HealthCheckRow[];
  const grouped: Record<HealthCategory, HealthCheckRow[]> = { foundation: [], gbp: [], performance: [], search: [], citations: [], ops: [] };
  for (const r of checks) (grouped[r.category as HealthCategory] ??= []).push(r);

  const passCount = checks.filter((c) => c.status === "pass").length;
  const failCount = checks.filter((c) => c.status === "fail").length;
  const empty = checks.length === 0;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-[#EEF1FA] flex items-center gap-2">
          <Activity className="w-5 h-5 text-[#0078D7]" /> Digital Health
        </h1>
        <p className="text-sm text-[rgba(238,241,250,0.55)] mt-1">
          A live snapshot of your business's online presence — what's working and what we're improving for you.
        </p>
      </div>

      {empty ? (
        <div className="bg-[#111E33] border border-white/8 rounded-xl px-5 py-10 text-center">
          <Activity className="w-10 h-10 mx-auto text-[rgba(238,241,250,0.3)] mb-3" />
          <p className="text-sm text-[rgba(238,241,250,0.6)]">Your digital health snapshot is being prepared.</p>
          <p className="text-xs text-[rgba(238,241,250,0.45)] mt-1">Check back shortly — your agency is putting it together.</p>
        </div>
      ) : (
        <>
          <ScoreHero score={data.score} bucket={data.bucket} label={data.label} totalChecks={checks.length} passCount={passCount} failCount={failCount} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <LighthouseCard audits={data.audits} readOnly />
            <CitationsCard citationRows={grouped.citations} lastResults={null} readOnly />
          </div>

          <div className="grid grid-cols-1 gap-4">
            {CATEGORY_ORDER.map((cat) => (
              <CategoryCard
                key={cat}
                category={cat}
                icon={CATEGORY_ICON[cat]}
                rows={grouped[cat] ?? []}
                readOnly
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function PortalHealth() {
  return <PortalLayout>{(c) => <HealthContent connection={c} />}</PortalLayout>;
}
