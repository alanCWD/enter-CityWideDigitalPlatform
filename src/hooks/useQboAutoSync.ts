import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// The scheduled db job (pg_cron → qbo-poll-invoices) is the intended daily trigger,
// but its HTTP delivery layer has been unreliable, so while an agency user has the
// app open we also run the poll periodically. The poll refreshes expired QBO tokens
// itself and dedupes per-customer, so re-running it is safe (no duplicate emails).
const SYNC_INTERVAL_MS = 60 * 60 * 1000; // 60 minutes
const LAST_RUN_KEY = "qbo-auto-sync-last-run-at";

/** Periodically run the QBO invoice poll (sends review requests) while the app is open. */
export function useQboAutoSync() {
  const inFlight = useRef(false);

  useEffect(() => {
    async function syncNow() {
      if (inFlight.current) return;
      // Only run for authenticated users — the poll sends review emails.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Don't re-sync on every route change — only if enough time has passed
      // since the last successful run (localStorage survives navigation).
      const lastRun = Number(localStorage.getItem(LAST_RUN_KEY) ?? 0);
      if (Date.now() - lastRun < SYNC_INTERVAL_MS) return;

      inFlight.current = true;
      try {
        await supabase.functions.invoke("qbo-poll-invoices", { body: {} });
        localStorage.setItem(LAST_RUN_KEY, String(Date.now()));
      } catch (e) {
        console.warn("[qbo-auto-sync] poll failed:", e);
      } finally {
        inFlight.current = false;
      }
    }

    const onVisibility = () => {
      if (!document.hidden) syncNow();
    };

    // One attempt on mount (guarded by the interval check), then a heartbeat.
    syncNow();
    const interval = setInterval(() => {
      if (!document.hidden) syncNow();
    }, SYNC_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
