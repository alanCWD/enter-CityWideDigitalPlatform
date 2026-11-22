import { useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Inbox,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Settings2,
} from "lucide-react";
import { StatusPill } from "@/components/crm/StatusPill";
import { formatWhen, launchBlockedReason, type ClientApp } from "@/lib/apps";
import { useClientAppStatus } from "@/hooks/useClientAppStatus";
import { handOffToInboxPro, requestInboxLaunch } from "@/lib/inboxLaunch";
import {
  connectClientApp,
  pauseClientApp,
  resumeClientApp,
  setClientAppPlan,
  syncClientApp,
} from "@/lib/clientApps";
import { cn } from "@/lib/utils";

interface ClientSummary {
  id: string;
  name: string;
  plan?: string | null;
  seats?: number | null;
}

interface InboxProCardProps {
  app: ClientApp | null;
  client: ClientSummary;
  /** Tighter spacing when the card sits in the directory list. */
  compact?: boolean;
  /** Called after a change lands, so the surrounding view reloads the record. */
  onChanged?: () => void;
}

type PendingAction = "connect" | "sync" | "pause" | "resume";

export function InboxProCard({ app, client, compact = false, onChanged }: InboxProCardProps) {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [planOpen, setPlanOpen] = useState(false);

  const isSample = app?.is_sample === true;

  const { data: live, refreshing, refresh, error: liveError } = useClientAppStatus({
    clientId: app?.client_id,
    // Nothing to poll until Inbox Pro knows this client at all.
    enabled: !!app?.citywide_client_id && !isSample,
  });

  const run = async (key: PendingAction, action: () => Promise<unknown>) => {
    setPending(key);
    setActionError(null);
    try {
      await action();
      onChanged?.();
      refresh();
    } catch (e) {
      setActionError((e as Error).message);
      // A failed sync still changed the record (needs attention), so refresh it.
      onChanged?.();
      refresh();
    } finally {
      setPending(null);
    }
  };

  if (!app) {
    const connecting = pending === "connect";
    return (
      <div className="bg-card dark:bg-[#111E33] border border-dashed border-border dark:border-white/15 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
            <Inbox className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-foreground">Inbox Pro</h3>
              <StatusPill status="not_connected" />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Not connected yet — no Inbox Pro workspace is recorded for {client.name}.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void run("connect", () => connectClientApp(client.id))}
                disabled={connecting}
                className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#005FA3] text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {connecting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Inbox className="w-3.5 h-3.5" />
                )}
                {connecting ? "Connecting…" : "Connect Inbox Pro"}
              </button>
              <span className="text-[11px] text-muted-foreground">
                Creates the workspace once and sends this client's plan and seats.
              </span>
            </div>

            {actionError && (
              <div
                role="alert"
                className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2"
              >
                <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-destructive break-words">{actionError}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const sample = isSample;
  const when = (iso: string | null | undefined) => formatWhen(iso);

  // Live read wins over the stored snapshot; the snapshot is the fallback.
  const view = live ?? {
    linked: app.status !== "not_connected",
    status: app.status,
    plan: app.plan,
    seats: app.seats,
    seats_used: app.seats_used ?? null,
    open_conversations: app.open_conversations ?? null,
    last_activity_at: app.last_activity_at ?? null,
    last_checked_at: app.last_checked_at,
    status_ok_at: app.status_ok_at ?? null,
    error: app.last_error,
  };

  const viewError = view.error ?? liveError ?? null;
  const hasNumbers = view.seats_used != null || view.open_conversations != null;
  // A failed read keeps the last known numbers and says so.
  const stale = !!viewError && hasNumbers && !!view.status_ok_at;
  const blockedReason = launchBlockedReason({ ...app, status: view.status });
  const isPaused = view.status === "paused";
  const notConnected = view.status === "not_connected";
  const needsRetry = view.status === "needs_attention" || !!view.error;

  const launch = async () => {
    if (blockedReason || launching) return;
    setLaunching(true);
    setLaunchError(null);
    try {
      const ticket = await requestInboxLaunch(app.client_id);
      // The token exists only inside this navigation.
      handOffToInboxPro(ticket.url);
    } catch (e) {
      setLaunchError((e as Error).message);
      setLaunching(false);
    }
  };

  const busy = (key: PendingAction) => pending === key;

  return (
    <div
      className={cn(
        "bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl",
        compact ? "p-5" : "p-6",
      )}
    >
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-[#0078D7]/10 flex items-center justify-center flex-shrink-0">
          <Inbox className="w-5 h-5 text-[#0078D7]" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-foreground">Inbox Pro</h3>
                <StatusPill status={view.status} />
                {sample && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border border-amber-500/40 text-amber-600 dark:text-amber-400">
                    Sample
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Shared team inbox for client conversations, broadcasts and follow-ups.
              </p>
              {app.workspace_slug && (
                <p className="text-[11px] text-muted-foreground mt-1 font-mono break-all">
                  Workspace: {app.workspace_slug}
                </p>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-3 mt-5">
            <Stat label="Plan" value={view.plan ?? null} emptyHint="No Inbox Pro plan recorded." />
            <Stat
              label="Seats"
              value={
                view.seats == null
                  ? null
                  : view.seats_used == null
                    ? `— / ${view.seats}`
                    : `${view.seats_used} / ${view.seats}`
              }
              emptyHint="No seat limit recorded for this workspace."
              hint={
                view.seats != null && view.seats_used == null
                  ? "Seats in use need a successful status read from Inbox Pro."
                  : undefined
              }
            />
            <Stat
              label="Open conversations"
              value={view.open_conversations == null ? null : String(view.open_conversations)}
              emptyHint="Open conversations need a successful status read from Inbox Pro."
            />
            <Stat
              label="Last activity"
              value={when(view.last_activity_at)}
              emptyHint="No activity recorded — it arrives with a successful status read."
            />
            <Stat
              label="Last checked"
              value={when(view.last_checked_at)}
              emptyHint="Never checked against Inbox Pro."
            />
          </dl>

          {viewError && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-destructive">
                  {view.status === "needs_attention" ? "Needs attention" : "Last read failed"}
                </p>
                <p className="text-[11px] text-destructive break-words">{viewError}</p>
                {stale && (
                  <p className="text-[11px] text-destructive/80 mt-1">
                    Showing the last known numbers from {when(view.status_ok_at)} — they are stale
                    until a read succeeds.
                  </p>
                )}
              </div>
            </div>
          )}

          {actionError && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2"
            >
              <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-destructive break-words">{actionError}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {notConnected ? (
              <button
                type="button"
                onClick={() => void run("connect", () => connectClientApp(app.client_id))}
                disabled={sample || busy("connect")}
                className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#005FA3] text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy("connect") ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Inbox className="w-3.5 h-3.5" />
                )}
                {busy("connect") ? "Connecting…" : "Connect Inbox Pro"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void launch()}
                disabled={!!blockedReason || launching}
                aria-describedby={blockedReason ? `launch-blocked-${app.id}` : undefined}
                className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#005FA3] text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#0078D7]"
              >
                {launching ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ExternalLink className="w-3.5 h-3.5" />
                )}
                {launching ? "Opening Inbox Pro…" : "Open Inbox Pro"}
              </button>
            )}

            <ActionButton
              icon={RefreshCw}
              label={refreshing ? "Refreshing…" : "Refresh"}
              disabled={sample || refreshing}
              onClick={refresh}
            />

            <ActionButton
              icon={Settings2}
              label="Manage plan"
              disabled={sample}
              onClick={() => { setActionError(null); setPlanOpen(true); }}
            />

            {isPaused ? (
              <ActionButton
                icon={Play}
                label={busy("resume") ? "Resuming…" : "Resume"}
                disabled={sample || busy("resume")}
                onClick={() => void run("resume", () => resumeClientApp(app.client_id))}
              />
            ) : (
              !notConnected && (
                <ActionButton
                  icon={Pause}
                  label={busy("pause") ? "Pausing…" : "Pause"}
                  disabled={sample || busy("pause")}
                  onClick={() => void run("pause", () => pauseClientApp(app.client_id))}
                />
              )
            )}

            {needsRetry && (
              <ActionButton
                icon={RotateCw}
                label={busy("sync") ? "Retrying…" : "Retry sync"}
                disabled={sample || busy("sync")}
                onClick={() => void run("sync", () => syncClientApp(app.client_id))}
              />
            )}
          </div>

          {blockedReason && !notConnected && (
            <p
              id={`launch-blocked-${app.id}`}
              className="text-[11px] text-amber-700 dark:text-amber-300 mt-3"
            >
              {blockedReason}
            </p>
          )}

          {sample && (
            <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-3">
              Sample row — connecting, plan changes, pausing and syncing are disabled here. They run
              against real Inbox Pro workspaces.
            </p>
          )}

          {launchError && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2"
            >
              <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-destructive break-words">{launchError}</p>
            </div>
          )}

          <p className="text-[11px] text-muted-foreground mt-3">
            Launching hands this browser to Inbox Pro with a single-use signed link that expires in
            minutes. Status refreshes every minute while this tab is open. Pausing stops a
            workspace; Citywide never deletes one.
          </p>
        </div>
      </div>

      {planOpen && (
        <PlanDialog
          client={client}
          app={app}
          onClose={() => {
            setPlanOpen(false);
            // A failed attempt may already have marked the record needs attention.
            onChanged?.();
          }}
          onSubmit={async (plan, seats) => {
            await setClientAppPlan(app.client_id, plan, seats);
            setPlanOpen(false);
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

function PlanDialog({
  client,
  app,
  onClose,
  onSubmit,
}: {
  client: ClientSummary;
  app: ClientApp;
  onClose: () => void;
  onSubmit: (plan: string, seats: number) => Promise<void>;
}) {
  const [plan, setPlan] = useState(app.plan ?? client.plan ?? "");
  const [seats, setSeats] = useState(String(app.seats ?? client.seats ?? ""));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan.trim()) { setError("Enter the plan to send to Inbox Pro."); return; }
    const seatCount = Number(seats);
    if (!seats.trim() || !Number.isFinite(seatCount) || seatCount < 0) {
      setError("Seats must be a whole number of 0 or more.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSubmit(plan.trim(), Math.trunc(seatCount));
    } catch (e2) {
      setError((e2 as Error).message);
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 m-4 shadow-xl"
        aria-labelledby="plan-dialog-title"
      >
        <h2 id="plan-dialog-title" className="text-lg font-bold text-foreground">
          Manage Inbox Pro plan
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          This sends {client.name}'s plan and seat count to Inbox Pro and updates this client's record.
        </p>

        <div className="mt-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Plan</span>
            <input
              value={plan}
              onChange={(e) => setPlan(e.target.value)}
              placeholder="Growth"
              className="mt-1.5 w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-foreground">Seats</span>
            <input
              type="number"
              min="0"
              step="1"
              value={seats}
              onChange={(e) => setSeats(e.target.value)}
              placeholder="5"
              className="mt-1.5 w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
            />
          </label>
        </div>

        {error && (
          <p role="alert" className="mt-4 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-50 text-primary-foreground text-sm font-bold px-5 py-2 rounded-lg transition-colors"
          >
            {busy ? "Sending…" : "Save & sync"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 bg-transparent hover:bg-accent text-foreground text-xs font-bold px-3 py-2 rounded-lg border border-border dark:border-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Icon className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function Stat({
  label,
  value,
  emptyHint,
  hint,
}: {
  label: string;
  value: string | null;
  emptyHint: string;
  hint?: string;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "text-sm mt-0.5 truncate",
          value ? "font-semibold text-foreground" : "text-muted-foreground",
        )}
        title={value ? hint : emptyHint}
      >
        {value ?? "—"}
      </dd>
      {!value && <span className="sr-only">{emptyHint}</span>}
    </div>
  );
}
