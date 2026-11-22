import { useState } from "react";
import {
  AlertCircle,
  ExternalLink,
  Inbox,
  Pause,
  RotateCw,
  Settings2,
} from "lucide-react";
import { StatusPill } from "@/components/crm/StatusPill";
import { APP_STATUS_LABEL, formatWhen, type ClientApp } from "@/lib/apps";
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
}

/** What each action would do once the Inbox Pro connection exists. */
const ACTION_REASONS = {
  connect:
    "Connecting creates this client's workspace in Inbox Pro and needs the Inbox Pro contract and its server-side key. That arrives in the next step, so nothing was sent.",
  open:
    "Opening needs a live workspace and Inbox Pro's address and sign-in hand-off. That arrives with the connection step, so nothing was opened.",
  manage:
    "Plan and seat changes are sent to Inbox Pro. That arrives with the connection step, so nothing was changed.",
  pause:
    "Pausing sends the pause to Inbox Pro so the workspace stops without being deleted. That arrives with the connection step, so nothing was paused or deleted.",
  retry:
    "Retrying needs the status/sync request to Inbox Pro. That arrives with the connection step, so no request was made.",
} as const;

export function InboxProCard({ app, client, compact = false }: InboxProCardProps) {
  const [notice, setNotice] = useState<{ action: keyof typeof ACTION_REASONS; text: string } | null>(null);

  const blocked = (action: keyof typeof ACTION_REASONS, text: string) => setNotice({ action, text });

  if (!app) {
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
                onClick={() => blocked("connect", ACTION_REASONS.connect)}
                className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#005FA3] text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                <Inbox className="w-3.5 h-3.5" />
                Connect Inbox Pro
              </button>
              <span className="text-[11px] text-muted-foreground">
                Nothing is sent to Inbox Pro yet.
              </span>
            </div>
          </div>
        </div>
        <ActionNotice notice={notice} />
      </div>
    );
  }

  const sample = app.is_sample === true;
  const when = (iso: string | null | undefined) => formatWhen(iso);

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
                <StatusPill status={app.status} />
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
            <Stat label="Plan" value={app.plan ?? null} emptyHint="No Inbox Pro plan recorded." />
            <Stat
              label="Seats"
              value={
                app.seats == null
                  ? null
                  : app.seats_used == null
                    ? `— / ${app.seats}`
                    : `${app.seats_used} / ${app.seats}`
              }
              emptyHint="No seat limit recorded for this workspace."
              hint={
                app.seats != null && app.seats_used == null
                  ? "Seats in use need a status read from Inbox Pro."
                  : undefined
              }
            />
            <Stat
              label="Open conversations"
              value={app.open_conversations == null ? null : String(app.open_conversations)}
              emptyHint="Open conversations need a status read from Inbox Pro."
            />
            <Stat
              label="Last activity"
              value={when(app.last_activity_at)}
              emptyHint="No activity recorded — it arrives with a status read."
            />
            <Stat
              label="Last checked"
              value={when(app.last_checked_at)}
              emptyHint="Never checked against Inbox Pro."
            />
          </dl>

          {app.last_error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-destructive break-words">{app.last_error}</p>
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                blocked(
                  "open",
                  app.status !== "active" || !app.workspace_slug
                    ? `Open Inbox Pro is blocked because this workspace is ${APP_STATUS_LABEL[app.status].toLowerCase()}${app.workspace_slug ? "" : " and has no recorded address"}. Nothing was opened.`
                    : ACTION_REASONS.open,
                )
              }
              className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#005FA3] text-primary-foreground text-xs font-bold px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open Inbox Pro
            </button>
            <ActionButton icon={Settings2} label="Manage plan" onClick={() => blocked("manage", ACTION_REASONS.manage)} />
            <ActionButton icon={Pause} label="Pause" onClick={() => blocked("pause", ACTION_REASONS.pause)} />
            <ActionButton icon={RotateCw} label="Retry" onClick={() => blocked("retry", ACTION_REASONS.retry)} />
          </div>

          <p className="text-[11px] text-muted-foreground mt-3">
            Nothing on this card is sent to Inbox Pro yet. Pausing is the only way to stop a
            workspace — Citywide never deletes one.
          </p>

          <ActionNotice notice={notice} />
        </div>
      </div>
    </div>
  );
}

function ActionNotice({ notice }: { notice: { action: string; text: string } | null }) {
  return (
    <div aria-live="polite" className={cn(notice ? "mt-4" : "sr-only")}>
      {notice && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2"
        >
          <AlertCircle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-amber-700 dark:text-amber-300">{notice.text}</p>
        </div>
      )}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 bg-transparent hover:bg-accent text-foreground text-xs font-bold px-3 py-2 rounded-lg border border-border dark:border-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
