import { Link } from "react-router-dom";
import { AlertCircle, ArrowRight, Inbox, RotateCw } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { StatusPill } from "@/components/crm/StatusPill";
import { useClientApps } from "@/hooks/useClientApps";
import {
  APP_STATUS_LABEL,
  SAMPLE_CLIENT_APPS,
  formatWhen,
  sortClientApps,
  type AppStatus,
} from "@/lib/apps";
import { cn } from "@/lib/utils";

const STATUSES: AppStatus[] = ["active", "paused", "needs_attention", "not_connected"];

/**
 * Every client's Inbox Pro in one place. Only real stored records are shown;
 * when none exist yet, clearly labelled sample rows stand in so the page can be
 * judged. A client's Inbox Pro is never shown as Active without a recorded
 * status read.
 */
export function AppsDirectory() {
  const { rows, loading, error, reload } = useClientApps();

  const showingSamples = !loading && !error && rows.length === 0;
  const displayed = sortClientApps(showingSamples ? SAMPLE_CLIENT_APPS : rows);

  const count = (status: AppStatus) => displayed.filter((r) => r.status === status).length;

  return (
    <DashboardLayout>
      <TopBar
        title="Apps"
        subtitle="Every client's apps — starting with Inbox Pro"
      />

      <div className="px-6 py-6 space-y-4">
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

        {loading && (
          <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-6 space-y-3 animate-pulse">
            <div className="h-4 w-48 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
            <div className="h-3 w-5/6 bg-muted rounded" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-destructive">Could not load app records</p>
                <p className="text-xs text-destructive/90 mt-1 break-words">{error}</p>
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
                Sample data — no client has an Inbox Pro record yet
              </p>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                These rows are illustrative, are not saved anywhere, and disappear as soon as a
                real record exists. Nothing here reflects a client's real Inbox Pro.
              </p>
            </div>
          </div>
        )}

        {!loading && !error && (
          <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px]">
                <thead>
                  <tr className="border-b border-border dark:border-white/10">
                    {["Client", "Status", "Plan", "Seats", "Open conversations", "Last activity", ""].map(
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
                      <td className="px-4 py-3 text-right">
                        {row.is_sample ? (
                          <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                            Sample row
                          </span>
                        ) : (
                          <Link
                            to={`/dashboard/crm/clients/${row.client_id}?tab=apps`}
                            className={cn(
                              "inline-flex items-center gap-1 text-xs font-bold text-[#0078D7] hover:underline whitespace-nowrap",
                              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded",
                            )}
                          >
                            Open client
                            <ArrowRight className="w-3 h-3" />
                          </Link>
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
            Inbox Pro is the first app in the catalog. A workspace is paused, never deleted —
            Citywide keeps no delete action for any app.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
