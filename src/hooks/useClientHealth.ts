import { useEffect, useState, useCallback } from "react";
import { fetchHealthSummary, refreshAutoChecks, runLighthouse, runCitations, toggleCheck, type HealthSummary, type HealthBucket, type CitationProbeResult } from "@/lib/health";
import type { HealthStatus } from "@/lib/healthCatalog";

const EMPTY: HealthSummary = { score: 0, bucket: "critical" as HealthBucket, label: "—", checks: [], audits: [] };

export function useClientHealth(clientId: string | undefined) {
  const [data, setData] = useState<HealthSummary>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "auto" | "lighthouse" | "citations" | "toggle">(null);
  const [lastCitations, setLastCitations] = useState<CitationProbeResult[] | null>(null);

  const reload = useCallback(async () => {
    if (!clientId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetchHealthSummary(clientId);
      setData(res);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [clientId]);

  useEffect(() => { reload(); }, [reload]);

  const doRefreshAuto = useCallback(async () => {
    if (!clientId) return;
    setBusy("auto"); setError(null);
    try { setData(await refreshAutoChecks(clientId)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }, [clientId]);

  const doLighthouse = useCallback(async (url?: string) => {
    if (!clientId) return;
    setBusy("lighthouse"); setError(null);
    try { setData(await runLighthouse(clientId, url)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }, [clientId]);

  const doCitations = useCallback(async () => {
    if (!clientId) return;
    setBusy("citations"); setError(null);
    try {
      const res = await runCitations(clientId);
      setData(res);
      setLastCitations(res.results ?? null);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }, [clientId]);

  const doToggle = useCallback(async (key: string, status: HealthStatus, opts?: { evidence?: string; client_visible?: boolean }) => {
    if (!clientId) return;
    setBusy("toggle"); setError(null);
    try { setData(await toggleCheck(clientId, key, status, opts)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }, [clientId]);

  return { data, loading, error, busy, lastCitations, reload, doRefreshAuto, doLighthouse, doCitations, doToggle };
}
