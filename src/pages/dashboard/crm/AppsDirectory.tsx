import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertCircle, ArrowRight, ExternalLink, Inbox, Loader2, RotateCw } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { StatusPill } from "@/components/crm/StatusPill";
import { LaunchResultBanner } from "@/components/apps/LaunchResultBanner";
import { useClientApps } from "@/hooks/useClientApps";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import {
  APP_STATUS_LABEL,
  INBOX_PRO_APP_KEY,
  SAMPLE_CLIENT_APPS,
  formatWhen,
  launchBlockedReason,
  sortClientApps,
  type AppStatus,
  type ClientApp,
} from "@/lib/apps";
import { crm, type CrmClient } from "@/lib/crm";
import { handOffToInboxPro, requestInboxLaunch } from "@/lib/inboxLaunch";
import { cn } from "@/lib/utils";

const STATUSES: AppStatus[] = ["active", "paused", "needs_attention", "not_connected"];

/** A client with no Inbox Pro record still gets a row: "Not connected". */
function unconnectedClientApp(client: CrmClient): ClientApp {
  return {
    id: `unconnected-${client.id}`,
    client_id: client.id,
    app_key: INBOX_PRO_APP_KEY,
    status: "not_connected",
    citywide_client_id: null,
    workspace_slug: null,
    plan: null,
    seats: null,
    last_sync_at: null,
    last_checked_at: null,
    last_error: null,
    client_name: client.name,
    client_status: client.status,
    client_email: client.billing_email,
    is_sample: false,
  };
}

/**
 * Every client and their Inbox Pro, for agency users. A client without a
 * workspace is listed too, so the page answers "who is not connected yet".
 */
export function AppsDirectory() {
  const { rows, loading, error, reload } = useClientApps();
  const { user } = useAuth();
  const { isAgency } = useUserRole(user?.id);
  const [clients, setClients] = useState<CrmClient[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [clientsError, setClientsError] = useState<string | null>(null);
  const [params, setParams] = useSearchParams();
  const launchCode = params.get("code") ?? params.get("error");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await crm<{ clients: CrmClient[] }>("clients.list", { limit: 200 });
        if (!cancelled) { setClients(data.clients ?? []); setClientsError(null); }
      } catch (e) {
        if (!cancelled) setClientsError((e as Error).message);
      } finally {
        if (!cancelled) setClientsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const dismissLaunchResult = () => {
    const next = new URLSearchParams(params);
    next.delete("code");
    next.delete("error");
    setParams(next, { replace: true });
  };

  // Every client, with its app row when one exists.
  const byClient = new Map(rows.map((row) => [row.client_id, row]));
  const merged: ClientApp[] = clients.length
    ? clients.map((client) => byClient.get(client.id) ?? unconnectedClientApp(client))
    : rows;

  const showingSamples = !loading && !error && merged.length === 0;
  const displayed = sortClientApps(showingSamples ? SAMPLE_CLIENT_APPS : merged);
  const count = (status: AppStatus) => displayed.filter((r) => r.status === status).length;
  const readError = error || clientsError;

  return (
    <DashboardLayout>
      <TopBar title="Apps" subtitle="Every client's apps — starting with Inbox Pro" />

      <div className="px-6 py-6 space-y-4">
        <LaunchResultBanner code={launchCode} onDismiss={dismissLaunchResult} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            A client's Inbox Pro reads <span className="font-semibold text-foreground">Active</span>{" "}
            only after a successful status read or sync confirmed it.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {STATUSES.map((status) => (
              <span
                key={status}
                className="inline-flex items-center gap-1.5 rounded-full border border-border dark:border-white/15 bg-card dark:bg-[#111E33] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {APP_STATUS_LABEL[status]}
                <span className="text-foreground">{count(status)}</span>
              </span>
            ))}
          </div>
        </div>

        {(loading || clientsLoading) && !readError && (
          <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-6 space-y-3 animate-pulse">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-5/6 bg-muted rounded" />
          </div>
        )}

        {!loading && readError && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-destructive">Could not load app records</p>
                <p className="text-xs text-destructive/90 mt-1 break-words">{readError}</p>
                <p className="text-[11px] text-destructive/80 mt-1">
                  Nothing is shown as connected until this read succeeds.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void reload()}
              className="mt-3 inline-flex items-center gap-1.5 bg-transparent hover:bg-destructive/10 text-destructive text-xs font-bold px-3 py-2 rounded-lg border border-destructive/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Try again
            </button>
          </div>
        )}

        {showingSamples && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-amber-700 dark:text-amber-300">
                Sample data — no clients exist yet
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                These rows are illustrative, are not saved anywhere, and disappear as soon as a real
                client exists.
              </p>
            </div>
          </div>
        )}

        {!loading && !readError && displayed.length > 0 && (
          <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px]">
                <thead>
                  <tr className="border-b border-border dark:border-white/10">
                    {["Client", "Status", "Plan", "Seats", "Open conversations", "Last activity", "Last checked", "Inbox Pro"].map(
                      (heading) => (
                        <th
                          key={heading}
                          scope="col"
                          className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/60 dark:border-white/5 last:border-0 hover:bg-accent/40 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {row.client_name ?? "Unnamed client"}
                          </span>
                          {row.is_sample && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border border-amber-500/40 text-amber-600 dark:text-amber-400">
                              Sample
                            </span>
                          )}
                        </div>
                        {row.client_email && (
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-[240px]">
                            {row.client_email}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {row.plan ?? <span className="text-muted-foreground">Not set</span>}
                      </td>
                      <td
                        className="px-4 py-3 text-sm text-foreground whitespace-nowrap"
                        title={
                          row.seats != null && row.seats_used == null
                            ? "Seats in use need a status read from Inbox Pro."
                            : undefined
                        }
                      >
                        {row.seats == null ? (
                          <span className="text-muted-foreground">Not set</span>
                        ) : row.seats_used == null ? (
                          <>
                            <span className="text-muted-foreground">—</span>
                            <span className="text-muted-foreground"> / {row.seats}</span>
                          </>
                        ) : (
                          <>
                            {row.seats_used}
                            <span className="text-muted-foreground"> / {row.seats}</span>
                          </>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">
                        {row.open_conversations ?? (
                          <span className="text-muted-foreground" title="Needs a status read from Inbox Pro.">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {formatWhen(row.last_activity_at) ?? (
                          <span className="text-muted-foreground" title="Needs a status read from Inbox Pro.">
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                        {formatWhen(row.last_checked_at) ?? (
                          <span className="text-muted-foreground">Never</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {row.is_sample ? (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            Sample row
                          </span>
                        ) : (
                          <div className="flex flex-col items-end gap-1">
                            {isAgency && (
                              <LaunchRowButton app={row} />
                            )}
                            <Link
                              to={`/dashboard/crm/clients/${row.client_id}?tab=apps`}
                              className={cn(
                                "inline-flex items-center gap-1 text-[11px] font-bold text-[#0078D7] hover:underline whitespace-nowrap",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded",
                              )}
                            >
                              Open client
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
          <Inbox className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <p>
            Each launch is signed for that client's own workspace. A workspace is paused, never
            deleted — Citywide keeps no delete action for any app.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

/** Launch straight into one client's workspace, with the reason when blocked. */
function LaunchRowButton({ app }: { app: ClientApp }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = launchBlockedReason(app);

  const start = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const ticket = await requestInboxLaunch(app.client_id);
      handOffToInboxPro(ticket.url);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => void start()}
        disabled={!!blocked || busy}
        title={blocked ?? "Open this client's Inbox Pro workspace"}
        aria-label={blocked ? blocked : `Open ${app.client_name ?? "client"}'s Inbox Pro`}
        className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#005FA3] text-primary-foreground text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#0078D7]"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
        {busy ? "Opening…" : "Open Inbox Pro"}
      </button>
      {blocked && (
        <span className="max-w-[190px] text-right text-[10px] leading-snug text-amber-700 dark:text-amber-300">
          {blocked}
        </span>
      )}
      {error && (
        <span role="alert" className="max-w-[190px] text-right text-[10px] leading-snug text-destructive break-words">
          {error}
        </span>
      )}
    </div>
  );
}
