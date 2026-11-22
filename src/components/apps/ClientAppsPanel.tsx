import { AlertCircle, RotateCw } from "lucide-react";
import { InboxProCard } from "@/components/apps/InboxProCard";
import { useClientApps } from "@/hooks/useClientApps";
import { INBOX_PRO_APP_KEY } from "@/lib/apps";

interface ClientAppsPanelProps {
  client: {
    id: string;
    name: string;
    plan?: string | null;
    seats?: number | null;
  };
}

/**
 * The Apps tab on a client record. Shows the client's Inbox Pro assignment, or
 * the not-connected state when no assignment exists.
 */
export function ClientAppsPanel({ client }: ClientAppsPanelProps) {
  const { rows, loading, error, reload } = useClientApps({ clientId: client.id });
  const inboxPro = rows.find((row) => row.app_key === INBOX_PRO_APP_KEY) ?? null;

  const plan = client.plan ?? inboxPro?.client_plan ?? null;
  const seats = client.seats ?? inboxPro?.client_seats ?? null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Apps
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            What {client.name} has from Citywide. Inbox Pro is the first app in the catalog.
          </p>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span>
            Client plan:{" "}
            <span className="font-semibold text-foreground">{plan ?? "Not set"}</span>
          </span>
          <span>
            Client seats:{" "}
            <span className="font-semibold text-foreground">{seats ?? "Not set"}</span>
          </span>
        </div>
      </div>

      {loading && (
        <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-6 animate-pulse">
          <div className="h-4 w-40 bg-muted rounded" />
          <div className="h-3 w-64 bg-muted rounded mt-3" />
          <div className="h-3 w-52 bg-muted rounded mt-2" />
        </div>
      )}

      {!loading && error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-5">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-destructive">
                Could not load this client's apps
              </p>
              <p className="text-xs text-destructive/90 mt-1 break-words">{error}</p>
              <p className="text-[11px] text-destructive/80 mt-1">
                No app state is shown until this read succeeds.
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

      {!loading && !error && (
        <InboxProCard
          app={inboxPro}
          client={{ id: client.id, name: client.name, plan, seats }}
          onChanged={reload}
        />
      )}
    </div>
  );
}
