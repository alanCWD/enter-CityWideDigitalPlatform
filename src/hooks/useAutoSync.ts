import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// In-app fallback for the pg_cron scheduled jobs: the database scheduler
// (pg_cron → net.http_post) has been failing to deliver requests to backend
// functions, so while an authenticated user has the app open we also run the
// same functions on a heartbeat. Each job is idempotent / dedup-safe:
// - publish-scheduled-posts publishes only due, still-queued posts
// - stripe-poll-events replays events from its single stored cursor row
// - qbo-poll-invoices sends review requests (deduped per customer)
const SYNC_JOBS = [
  { name: "publish-scheduled-posts", intervalMs: 5 * 60 * 1000 },
  { name: "stripe-poll-events", intervalMs: 15 * 60 * 1000 },
  { name: "qbo-poll-invoices", intervalMs: 60 * 60 * 1000 },
] as const;

function lastRunKey(name: string) {
  return `auto-sync-${name}-last-run-at`;
}

/** Periodically run scheduled backend jobs while the app is open and authenticated. */
export function useAutoSync() {
  const inFlight = useRef<Record<string, boolean>>({});

  useEffect(() => {
    async function syncJob(name: string, intervalMs: number) {
      if (inFlight.current[name]) return;
      // Only run for authenticated users — some jobs send emails / publish posts.
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      // Skip if the job ran recently (localStorage survives navigation).
      const lastRun = Number(localStorage.getItem(lastRunKey(name)) ?? 0);
      if (Date.now() - lastRun < intervalMs) return;

      inFlight.current[name] = true;
      try {
        await supabase.functions.invoke(name, { body: {} });
        localStorage.setItem(lastRunKey(name), String(Date.now()));
      } catch (e) {
        console.warn(`[auto-sync] ${name} failed:`, e);
      } finally {
        inFlight.current[name] = false;
      }
    }

    const onVisibility = () => {
      if (!document.hidden) SYNC_JOBS.forEach((j) => syncJob(j.name, j.intervalMs));
    };

    const intervals = SYNC_JOBS.map((job) => {
      // One attempt per job on mount (guarded by the interval check), then a heartbeat.
      // Only when the tab is visible, matching the interval ticks below.
      if (!document.hidden) syncJob(job.name, job.intervalMs);
      return setInterval(() => {
        if (!document.hidden) syncJob(job.name, job.intervalMs);
      }, job.intervalMs);
    });
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      intervals.forEach(clearInterval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
}
