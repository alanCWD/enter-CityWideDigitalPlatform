import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, KeyRound, Plus, RefreshCw, ShieldCheck, Trash2, Workflow } from "lucide-react";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL, supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

/**
 * Social Studio access: the workspaces CED exposes and the tokens the studio
 * polls with. Tokens are shown once, stored hashed, and revocable at any time.
 */

const API_BASE = `${SUPABASE_URL}/functions/v1/studio-entitlements`;
const ADMIN_URL = `${SUPABASE_URL}/functions/v1/studio-access-admin`;

interface StudioWorkspace {
  workspace_id: string;
  crm_client_id: string;
  agency_id: string;
  timezone: string;
  gst_rate: number | string;
  updated_at: string | null;
}

interface StudioToken {
  id: string;
  workspace_id: string;
  label: string;
  token_prefix: string;
  created_at: string | null;
  last_used_at: string | null;
  revoked_at: string | null;
}

interface IssuedToken {
  token: string;
  label: string;
  workspaceId: string;
}

function fmt(value: string | null): string {
  if (!value) return "never";
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

function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        } catch { /* clipboard unavailable */ }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
    >
      {copied ? <Check className="h-3 w-3 text-primary" /> : <Copy className="h-3 w-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

async function callAdmin<T>(body: Record<string, unknown>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  const res = await fetch(ADMIN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session?.access_token ?? ""}`,
      "apikey": SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(body),
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((payload as { error?: string }).error ?? "Request failed");
  return payload as T;
}

export function StudioAccessPanel() {
  const { toast } = useToast();
  const [workspaces, setWorkspaces] = useState<StudioWorkspace[]>([]);
  const [tokens, setTokens] = useState<StudioToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaceId, setWorkspaceId] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedToken | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callAdmin<{ workspaces: StudioWorkspace[]; tokens: StudioToken[] }>({ action: "list" });
      setWorkspaces(data.workspaces ?? []);
      setTokens(data.tokens ?? []);
      setError(null);
      setWorkspaceId((current) => current || data.workspaces?.[0]?.workspace_id || "");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const activeTokens = useMemo(() => tokens.filter((t) => !t.revoked_at), [tokens]);
  const curlSample = `curl -H "Authorization: Bearer $STUDIO_TOKEN" \\
  -H "Accept: application/json" \\
  "${API_BASE}/v1/workspaces/ws_citywide/entitlements"`;

  const issue = async () => {
    if (!workspaceId) {
      toast({ title: "Pick a workspace", description: "A token is scoped to exactly one workspace." });
      return;
    }
    setBusy(true);
    try {
      const created = await callAdmin<{ token: string; label: string; workspace_id: string }>({
        action: "createToken",
        workspace_id: workspaceId,
        label: label.trim() || "Social Studio",
      });
      setIssued({ token: created.token, label: created.label, workspaceId: created.workspace_id });
      setLabel("");
      await load();
    } catch (e) {
      toast({ title: "Could not issue a token", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (token: StudioToken) => {
    if (!confirm(`Revoke “${token.label}”? The studio loses access to ${token.workspace_id} immediately.`)) return;
    try {
      await callAdmin({ action: "revokeToken", id: token.id });
      toast({ title: "Token revoked", description: `${token.label} can no longer read this workspace.` });
      await load();
    } catch (e) {
      toast({ title: "Revoke failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-foreground">
            <Workflow className="h-4 w-4 text-primary" /> Social Studio access
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Read-only plan, entitlements and staff snapshot for the separate Social Studio app. One token per
            workspace, stored hashed and revocable at any time.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Refresh studio access"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs font-semibold text-destructive">
          {error}
        </div>
      )}

      {issued && (
        <div className="mb-4 rounded-xl border border-primary/40 bg-primary/5 p-4">
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">Copy this token now</h4>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            “{issued.label}” for <span className="font-mono text-[11px] text-foreground">{issued.workspaceId}</span> is
            ready. This is the only time it is shown — it is stored hashed and cannot be displayed again. Deliver it to
            the studio out of band.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
              {issued.token}
            </code>
            <CopyButton value={issued.token} label="Copy token" />
          </div>
          <button
            type="button"
            onClick={() => setIssued(null)}
            className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            I've saved it — dismiss
          </button>
        </div>
      )}

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Workspace
          </span>
          <select
            value={workspaceId}
            onChange={(e) => setWorkspaceId(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          >
            {workspaces.length === 0 && <option value="">No workspaces registered</option>}
            {workspaces.map((w) => (
              <option key={w.workspace_id} value={w.workspace_id}>
                {w.workspace_id} · {w.crm_client_id}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Token name
          </span>
          <div className="flex gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Social Studio production"
              className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void issue()}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" /> {busy ? "Issuing…" : "Issue"}
            </button>
          </div>
        </label>
      </div>

      <ul className="divide-y divide-border">
        {loading && activeTokens.length === 0 ? (
          <li className="py-6 text-xs text-muted-foreground">Loading access…</li>
        ) : tokens.length === 0 ? (
          <li className="rounded-xl border border-dashed border-border px-4 py-8 text-center">
            <KeyRound className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">No studio tokens yet</p>
            <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
              Issue one token for the studio's workspace. Rotating later means issuing a new token first, then revoking
              the old one once the studio has switched.
            </p>
          </li>
        ) : (
          tokens.map((token) => {
            const revoked = !!token.revoked_at;
            return (
              <li key={token.id} className="flex flex-wrap items-center gap-3 py-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                    revoked ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
                  )}
                >
                  <KeyRound className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-foreground">{token.label}</span>
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                        revoked
                          ? "border-border bg-muted text-muted-foreground"
                          : "border-primary/30 bg-primary/10 text-primary",
                      )}
                    >
                      {revoked ? "Revoked" : "Active"}
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                    {token.token_prefix}…
                    <span className="ml-2 font-sans">
                      {token.workspace_id} · issued {fmt(token.created_at)} · last used {fmt(token.last_used_at)}
                    </span>
                  </div>
                </div>
                {!revoked && (
                  <button
                    type="button"
                    onClick={() => void revoke(token)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" /> Revoke
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>

      <div className="mt-5 rounded-xl border border-border bg-muted/30 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Endpoint</span>
          <span className="text-[10px] font-semibold text-muted-foreground">
            30 requests / hour per workspace · ETag + 304
          </span>
        </div>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground">
            {API_BASE}/v1/workspaces/&#123;workspaceId&#125;/entitlements
          </code>
          <CopyButton value={`${API_BASE}/v1/workspaces/{workspaceId}/entitlements`} />
        </div>
        <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground">
{curlSample}
        </pre>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
          One token is scoped to one workspace. Rotate by issuing a new token, switching the studio, then revoking the
          old one — the studio never needs a redeploy. Staff changes and plan changes in CED appear on the next poll.
        </p>
      </div>
    </div>
  );
}
