import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  CreditCard,
  RefreshCw,
  ServerCog,
  Users,
  WifiOff,
  Workflow,
  XCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

/**
 * The studio's Account screen: everything it knows about this workspace comes
 * from the mirror CED publishes. Nothing here is typed in by hand, and a failed
 * sync leaves the last good mirror untouched.
 */

const MIRROR_URL = `${SUPABASE_URL}/functions/v1/studio-mirror`;

interface MirrorMember {
  id: string;
  name: string;
  email: string;
  role: "owner" | "approver" | "viewer";
  status: "active" | "invited" | "disabled";
  updatedAt: string;
}

interface Mirror {
  workspace_id: string;
  schema_version: string;
  account_id: string;
  account_name: string;
  account_status: "active" | "suspended" | "closed";
  billing_email: string;
  timezone: string;
  currency: string;
  plan_id: "starter" | "growth" | "pro";
  plan_name: string;
  subscription_status: "trialing" | "active" | "past_due" | "paused" | "canceled";
  price_cad: number | string;
  gst_rate: number | string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  social_studio: boolean;
  max_channels: number;
  white_label: boolean;
  ai_monthly_cap_usd: number | string;
  members: MirrorMember[] | null;
  etag: string | null;
  source_synced_at: string | null;
  mirrored_at: string;
  updated_at: string;
}

interface LastRun {
  id: string;
  status: "ok" | "not_modified" | "error";
  http_status: number | null;
  duration_ms: number;
  message: string | null;
  created_at: string;
}

interface StatusPayload {
  ok: boolean;
  workspaces: Array<{ workspace_id: string; label: string; enabled: boolean }>;
  workspace_id: string | null;
  mirror: Mirror | null;
  last_run: LastRun | null;
  configuration: { ced_token_configured: boolean; ced_base_url: string; schema_major: string };
}

async function callMirror(body: Record<string, unknown>): Promise<StatusPayload> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(MIRROR_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token ?? ""}`,
      "apikey": SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Sync request failed");
  return payload as StatusPayload;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-CA", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function money(value: number | string, currency: string): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(2)} ${currency}`;
}

const ROLE_STYLE: Record<MirrorMember["role"], string> = {
  owner: "border-primary/40 bg-primary/10 text-primary",
  approver: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  viewer: "border-border bg-muted text-muted-foreground",
};

const MEMBER_STATUS_STYLE: Record<MirrorMember["status"], string> = {
  active: "text-emerald-600 dark:text-emerald-400",
  invited: "text-amber-600 dark:text-amber-400",
  disabled: "text-muted-foreground",
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function StudioAccount() {
  const { toast } = useToast();
  const [state, setState] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await callMirror({ action: "status" });
      setState(payload);
      setError(null);
      return payload;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = useCallback(async (workspaceId?: string) => {
    setSyncing(true);
    try {
      const payload = await callMirror({ action: "sync", workspace_id: workspaceId });
      setState(payload);
      setError(null);
      const run = payload.last_run;
      if (run?.status === "ok") {
        toast({ title: "Mirror updated", description: "CED snapshot applied." });
      } else if (run?.status === "not_modified") {
        toast({ title: "Already up to date", description: "CED reports no change." });
      } else {
        toast({
          title: "Sync did not update the mirror",
          description: run?.message ?? "The last good snapshot was kept.",
          variant: "destructive",
        });
      }
    } catch (e) {
      setError((e as Error).message);
      toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  }, [toast]);

  useEffect(() => {
    void (async () => {
      const payload = await load();
      // First visit with a configured token and no mirror: pull one snapshot so
      // the screen is not empty. Only once per page load.
      if (payload && !payload.mirror && payload.configuration.ced_token_configured && !autoRan.current) {
        autoRan.current = true;
        await sync(payload.workspace_id ?? undefined);
      }
    })();
  }, [load, sync]);

  const mirror = state?.mirror ?? null;
  const lastRun = state?.last_run ?? null;
  const configured = state?.configuration.ced_token_configured ?? false;
  const members = mirror?.members ?? [];
  const approvers = members.filter((m) => m.role === "owner" || m.role === "approver").length;

  return (
    <DashboardLayout>
      <TopBar
        title="Studio account"
        subtitle="Live mirror of the CED plan, entitlements and staff snapshot"
        action={{ label: syncing ? "Syncing…" : "Sync now", onClick: () => void sync(state?.workspace_id ?? undefined) }}
      />

      <div className="px-6 py-6 space-y-5">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">
            {error}
          </div>
        )}

        {!configured && (
          <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
            <div className="text-xs text-muted-foreground">
              <p className="font-bold text-foreground">CED is not connected yet</p>
              <p className="mt-1 leading-relaxed">
                Issue a workspace token in CED (CRM → API Access → Social Studio access), then store it as the
                <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono text-[11px] text-foreground">CED_API_TOKEN</code>
                backend secret. Until then this screen shows the contract state, not data.
              </p>
            </div>
          </div>
        )}

        {mirror?.account_status && mirror.account_status !== "active" && (
          <div className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div className="text-xs text-muted-foreground">
              <p className="font-bold text-foreground">
                Posting is blocked: the account is {mirror.account_status}
              </p>
              <p className="mt-1">
                CED still answers so this screen can explain why. Nothing in the studio can override it.
              </p>
            </div>
          </div>
        )}

        {loading && !state ? (
          <div className="rounded-2xl border border-border bg-card px-5 py-10 text-center text-xs text-muted-foreground">
            Loading the mirror…
          </div>
        ) : !mirror ? (
          <div className="rounded-2xl border border-dashed border-border bg-card px-5 py-12 text-center">
            <Workflow className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <p className="text-sm font-bold text-foreground">No snapshot mirrored yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              {configured
                ? "Run a sync to pull the first snapshot from CED."
                : "Once CED is connected, the first sync fills this screen with the account, plan, entitlements and staff."}
            </p>
            {configured && (
              <button
                type="button"
                onClick={() => void sync(state?.workspace_id ?? undefined)}
                disabled={syncing}
                className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> Sync now
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
              <section className="rounded-2xl border border-border bg-card p-5">
                <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Account</h3>
                    <p className="mt-1 font-mono text-[11px] text-muted-foreground">{mirror.account_id}</p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                      mirror.account_status === "active"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : mirror.account_status === "suspended"
                          ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "border-destructive/30 bg-destructive/10 text-destructive",
                    )}
                  >
                    {mirror.account_status === "active" ? <BadgeCheck className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {mirror.account_status}
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <Stat label="Account name" value={mirror.account_name} />
                  <Stat label="Billing email" value={mirror.billing_email} hint="Personal data — staff only" />
                  <Stat label="Timezone" value={mirror.timezone} />
                  <Stat label="Currency" value={mirror.currency} />
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-5">
                <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                  <CreditCard className="h-4 w-4 text-primary" /> Plan
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-bold text-primary">
                    {mirror.plan_name}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {mirror.subscription_status}
                  </span>
                  {mirror.cancel_at_period_end && (
                    <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                      Cancels at period end
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-2 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between gap-3">
                    <span>Price before tax</span>
                    <span className="font-semibold text-foreground">{money(mirror.price_cad, mirror.currency)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>GST</span>
                    <span className="font-semibold text-foreground">
                      {Number.isFinite(Number(mirror.gst_rate)) ? `${(Number(mirror.gst_rate) * 100).toFixed(0)}%` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> Current period ends</span>
                    <span className="font-semibold text-foreground">{fmtDate(mirror.current_period_end)}</span>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <Workflow className="h-4 w-4 text-primary" /> Entitlements
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Social studio"
                  value={mirror.social_studio ? "Included" : "Not included"}
                  hint={mirror.social_studio ? undefined : "Drafting is unavailable on this plan"}
                />
                <Stat label="Channels allowed" value={String(mirror.max_channels)} hint="Connected social channels" />
                <Stat label="White label" value={mirror.white_label ? "Included" : "Not included"} />
                <Stat
                  label="AI drafting cap"
                  value={`$${Number(mirror.ai_monthly_cap_usd).toFixed(0)}/mo`}
                  hint="USD budget the studio enforces"
                />
              </div>
              {!mirror.social_studio && (
                <p className="mt-3 flex items-start gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  This plan does not include the studio. Drafting and scheduling must stay disabled until CED reports
                  an upgraded plan.
                </p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                  <Users className="h-4 w-4 text-primary" /> Staff who can act
                </h3>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {members.length} member{members.length === 1 ? "" : "s"} · {approvers} may approve
                </span>
              </div>
              {members.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-xs text-muted-foreground">
                  CED lists nobody for this workspace. A member missing from the snapshot is treated as removed.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {members.map((member) => (
                    <li key={member.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-foreground">
                        {member.name.slice(0, 2).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold text-foreground">{member.name}</span>
                          <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider", ROLE_STYLE[member.role])}>
                            {member.role}
                          </span>
                          <span className={cn("text-[10px] font-bold uppercase tracking-wider", MEMBER_STATUS_STYLE[member.status])}>
                            {member.status}
                          </span>
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {member.email} · updated {fmtDate(member.updatedAt)}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-muted-foreground">{member.id}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
                <ServerCog className="h-4 w-4 text-primary" /> Mirror health
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="Mirrored at" value={fmtDate(mirror.mirrored_at)} hint="When this copy was stored" />
                <Stat label="CED synced at" value={fmtDate(mirror.source_synced_at)} hint="CED's snapshot timestamp" />
                <Stat label="Contract" value={mirror.schema_version} hint="Studio rejects other majors" />
                <Stat
                  label="Last sync"
                  value={
                    lastRun
                      ? lastRun.status === "ok"
                        ? "Updated"
                        : lastRun.status === "not_modified"
                          ? "No change"
                          : "Failed"
                      : "Never"
                  }
                  hint={lastRun ? `${fmtDate(lastRun.created_at)} · ${lastRun.duration_ms} ms` : undefined}
                />
              </div>

              {lastRun && lastRun.status === "error" && (
                <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-[11px] text-muted-foreground">
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
                  <span>
                    <span className="font-bold text-foreground">CED refused or returned something unusable. </span>
                    The mirror above is the last good snapshot and was not replaced. {lastRun.message}
                  </span>
                </div>
              )}

              {lastRun && lastRun.status !== "error" && (
                <p className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                  CED answered {lastRun.http_status ?? 200}; the mirror matches it.
                </p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" /> ETag {mirror.etag ?? "—"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ServerCog className="h-3 w-3" /> {state?.configuration.ced_base_url}
                </span>
                <span className="ml-auto inline-flex items-center gap-1.5">
                  <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} />
                  <button
                    type="button"
                    onClick={() => void sync(state?.workspace_id ?? undefined)}
                    disabled={syncing}
                    className="font-bold text-primary transition-opacity hover:opacity-80 disabled:opacity-50"
                  >
                    {syncing ? "Syncing…" : "Sync now"}
                  </button>
                </span>
              </div>
            </section>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
