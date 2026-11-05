import { useCallback, useEffect, useState } from "react";
import { Copy, Check, KeyRound, Plus, ShieldCheck, Trash2, RefreshCw, AlertTriangle, Terminal, Globe } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { crm, CrmApiKey } from "@/lib/crm";
import { SUPABASE_URL } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

const API_BASE = `${SUPABASE_URL}/functions/v1/seo-api`;

interface AgencyRow {
  id: string;
  name: string;
  status?: string | null;
}

interface CreatedKey {
  key: string;
  label: string;
  id: string;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-CA", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
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

export function ApiAccess() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<CrmApiKey[]>([]);
  const [agencies, setAgencies] = useState<AgencyRow[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [label, setLabel] = useState("");
  const [agencyId, setAgencyId] = useState("citywide");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<CreatedKey | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await crm<{ keys: CrmApiKey[] }>("apiKeys.list", { agency_id: "all" });
      setKeys(data.keys ?? []);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    crm<AgencyRow[]>("agencies.list")
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setAgencies(list);
        setIsSuperAdmin(true);
        if (list[0]?.id) setAgencyId(list[0].id);
      })
      .catch(() => setIsSuperAdmin(false));
  }, [load]);

  const createKey = async () => {
    if (!label.trim()) {
      toast({ title: "Name the key", description: "Use a label so you can tell keys apart later." });
      return;
    }
    setBusy(true);
    try {
      const result = await crm<CreatedKey & { agency_id: string }>("apiKeys.create", {
        label: label.trim(),
        agency_id: agencyId,
      });
      setCreated({ key: result.key, label: result.label, id: result.id });
      setLabel("");
      await load();
    } catch (e) {
      toast({ title: "Could not create key", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (key: CrmApiKey) => {
    if (!confirm(`Revoke “${key.label}”? The SEO app will lose access immediately.`)) return;
    try {
      await crm("apiKeys.revoke", { id: key.id });
      toast({ title: "Key revoked", description: `${key.label} can no longer read clients.` });
      await load();
    } catch (e) {
      toast({ title: "Revoke failed", description: (e as Error).message, variant: "destructive" });
    }
  };

  const backfill = async () => {
    setBackfilling(true);
    try {
      const res = await crm<{ examined: number; updated: number }>("apiKeys.backfillProfiles");
      toast({
        title: "Profile data filled in",
        description: res.updated === 0
          ? "No missing website or industry values could be filled from Google profiles."
          : `${res.updated} of ${res.examined} incomplete clients were completed from Google profiles.`,
      });
    } catch (e) {
      toast({ title: "Backfill failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  const curlSample = `curl -H "Authorization: Bearer $KEY" \\
  "${API_BASE}/clients?per_page=100"`;

  return (
    <DashboardLayout>
      <TopBar
        title="API Access"
        subtitle="Read-only client feed for the SEO monitoring app"
        action={isSuperAdmin ? { label: "+ New Key", onClick: () => document.getElementById("new-key-label")?.focus() } : undefined}
      />

      <div className="px-6 py-6 space-y-6">
        {err && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs font-semibold text-destructive">
            {err}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          {/* ── Keys ─────────────────────────────────────────── */}
          <section className="space-y-4">
            {created && (
              <div className="rounded-2xl border border-primary/40 bg-primary/5 p-5">
                <div className="mb-2 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Copy this key now</h3>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  “{created.label}” is ready. This is the only time the key is shown — it is stored hashed and cannot be
                  displayed again.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground">
                    {created.key}
                  </code>
                  <CopyButton value={created.key} label="Copy key" />
                </div>
                <button
                  type="button"
                  onClick={() => setCreated(null)}
                  className="mt-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  I've saved it — dismiss
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Workspace keys</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scope <code className="font-mono text-[11px]">clients:read</code> — these keys can never change your CRM.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={load}
                  className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Refresh keys"
                >
                  <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                </button>
              </div>

              {isSuperAdmin && (
                <div className="mb-5 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      id="new-key-label"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Key name — e.g. SEO monitoring"
                      className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                    />
                    {agencies.length > 1 && (
                      <select
                        value={agencyId}
                        onChange={(e) => setAgencyId(e.target.value)}
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                      >
                        {agencies.map((a) => (
                          <option key={a.id} value={a.id}>{a.name}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={createKey}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      <Plus className="h-3.5 w-3.5" /> {busy ? "Creating…" : "Create key"}
                    </button>
                  </div>
                </div>
              )}

              {!isSuperAdmin && !loading && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Only the workspace super-admin can create or revoke keys.
                </div>
              )}

              {loading ? (
                <p className="py-6 text-xs text-muted-foreground">Loading keys…</p>
              ) : keys.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
                  <KeyRound className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
                  <p className="text-sm font-semibold text-foreground">No API keys yet</p>
                  <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                    Create a key to let the SEO app import this client directory.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {keys.map((k) => {
                    const revoked = !!k.revoked_at;
                    return (
                      <li key={k.id} className="flex flex-wrap items-center gap-3 py-3">
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
                            <span className="truncate text-sm font-semibold text-foreground">{k.label}</span>
                            {revoked ? (
                              <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                                Revoked
                              </span>
                            ) : (
                              <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                                Active
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                            {k.key_prefix}…
                            <span className="ml-2 font-sans">
                              created {fmtDate(k.created_at)} · last used {fmtDate(k.last_used_at)}
                            </span>
                          </div>
                        </div>
                        {!revoked && isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => revoke(k)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                          >
                            <Trash2 className="h-3 w-3" /> Revoke
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {isSuperAdmin && (
              <div className="rounded-2xl border border-border bg-card p-5">
                <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">Client profile data</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Website and industry are sent to the SEO app for every client. Fill the blanks once from the Google
                  Business Profiles already linked to your clients — existing values are never overwritten.
                </p>
                <button
                  type="button"
                  disabled={backfilling}
                  onClick={backfill}
                  className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-bold text-foreground transition-colors hover:border-primary/40 disabled:opacity-50"
                >
                  <Globe className={cn("h-3.5 w-3.5", backfilling && "animate-spin")} />
                  {backfilling ? "Filling…" : "Fill missing data from Google profiles"}
                </button>
              </div>
            )}
          </section>

          {/* ── Documentation ────────────────────────────────── */}
          <section className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-foreground">Base URL</h3>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 overflow-x-auto rounded-lg border border-border bg-background px-3 py-2 font-mono text-[11px] text-foreground">
                  {API_BASE}
                </code>
                <CopyButton value={API_BASE} />
              </div>

              <h4 className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Endpoints</h4>
              <ul className="space-y-1.5 font-mono text-[11px] text-foreground">
                <li><span className="text-primary">GET</span> /health</li>
                <li><span className="text-primary">GET</span> /clients?page=1&amp;per_page=100</li>
                <li><span className="text-primary">GET</span> /clients/&#123;id&#125;</li>
              </ul>

              <h4 className="mt-5 mb-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Auth headers</h4>
              <p className="text-xs text-muted-foreground">
                Send either <code className="font-mono text-[11px] text-foreground">Authorization: Bearer &lt;key&gt;</code> or{" "}
                <code className="font-mono text-[11px] text-foreground">x-api-key: &lt;key&gt;</code>. Sessions and cookies
                are ignored.
              </p>

              <h4 className="mt-5 mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                <Terminal className="h-3 w-3" /> Sample request
              </h4>
              <div className="relative">
                <pre className="overflow-x-auto rounded-lg border border-border bg-background p-3 font-mono text-[11px] leading-relaxed text-foreground">
{curlSample}
                </pre>
                <div className="mt-2 flex justify-end">
                  <CopyButton value={curlSample} label="Copy curl" />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-5">
              <h3 className="mb-2 text-sm font-bold uppercase tracking-wider text-foreground">Good to know</h3>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>60 requests per minute per key; beyond that you get <code className="font-mono text-[11px]">429</code> with a <code className="font-mono text-[11px]">Retry-After</code> header.</li>
                <li>Clients are sorted by last update, so paging stays stable and <code className="font-mono text-[11px]">updated_since</code> is safe for incremental syncs.</li>
                <li>Archived clients are included with <code className="font-mono text-[11px]">archived: true</code> so monitoring can be stopped.</li>
                <li>Every error is JSON: <code className="font-mono text-[11px]">error.code</code> and <code className="font-mono text-[11px]">error.message</code>.</li>
                <li>Requests are logged with the key, route, status and duration — never client personal data.</li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </DashboardLayout>
  );
}
