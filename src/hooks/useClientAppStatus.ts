import { useCallback, useEffect, useRef, useState } from "react";
import { readClientAppStatus, type ClientAppStatus } from "@/lib/clientApps";

const POLL_MS = 60_000;

/**
 * Live Inbox Pro status for one client.
 *
 * Polls at the same 60-second cadence the server caches at, and stops entirely
 * while the tab is hidden — resuming with one read when it comes back. A failed
 * read keeps the previous numbers and reports why.
 */
export function useClientAppStatus(opts: { clientId?: string | null; enabled?: boolean } = {}) {
  const { clientId, enabled = true } = opts;
  const [data, setData] = useState<ClientAppStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const read = useCallback(async (refresh: boolean) => {
    if (!clientId) return;
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const next = await readClientAppStatus(clientId, refresh);
      if (!mounted.current) return;
      setData(next);
      setError(null);
    } catch (e) {
      if (!mounted.current) return;
      // Keep the last known numbers; say why they are stale.
      setError((e as Error).message);
    } finally {
      if (mounted.current) {
        if (refresh) setRefreshing(false); else setLoading(false);
      }
    }
  }, [clientId]);

  useEffect(() => {
    if (!enabled || !clientId) return;

    let timer: number | null = null;
    const start = () => {
      if (timer === null) timer = window.setInterval(() => void read(false), POLL_MS);
    };
    const stop = () => {
      if (timer !== null) { window.clearInterval(timer); timer = null; }
    };
    const onVisibility = () => {
      if (document.hidden) { stop(); return; }
      start();
      // Returning to the tab reads once; the server cache avoids a burst.
      void read(false);
    };

    void read(false);
    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled, clientId, read]);

  const refresh = useCallback(() => void read(true), [read]);

  return { data, loading, refreshing, error, refresh };
}
