import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  CloudUpload,
  KeyRound,
  Loader2,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
  Trash2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { fmtWhen, recorder, type ConnectionStatus, type PullToken } from "@/lib/recorder";
import { CopyButton, ErrorNote, InlineLoader, StatusPill } from "@/components/recorder/RecorderBits";
import { cn } from "@/lib/utils";

export function ContentStudioSettings() {
  const { toast } = useToast();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [tokens, setTokens] = useState<PullToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("Recorder pull");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [connection, list] = await Promise.all([
        recorder<ConnectionStatus>("status"),
        recorder<{ tokens: PullToken[] }>("tokens.list"),
      ]);
      setStatus(connection);
      setTokens(list.tokens ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createToken = async () => {
    setBusy("create");
    setTokenError(null);
    try {
      const result = await recorder<{ token: string }>("tokens.create", { label: label.trim() || "Recorder pull" });
      setCreatedToken(result.token);
      setCreateOpen(false);
      await load();
    } catch (e) {
      setTokenError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const rotate = async () => {
    if (!confirm("Rotate the pull token? Every existing pull token stops working immediately. The intake key is not affected.")) return;
    setBusy("rotate");
    try {
      const result = await recorder<{ token: string }>("tokens.rotate", { label: label.trim() || "Recorder pull" });
      setCreatedToken(result.token);
      toast({ title: "Pull token rotated", description: "Paste the new token into the recorder's Pull settings." });
      await load();
    } catch (e) {
      toast({ title: "Rotation failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const revoke = async (token: PullToken) => {
    if (!confirm(`Revoke “${token.label}”? Any recorder using it will stop pulling immediately.`)) return;
    setBusy(token.id);
    try {
      await recorder("tokens.revoke", { id: token.id });
      toast({ title: "Token revoked" });
      await load();
    } catch (e) {
      toast({ title: "Revoke failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const backfill = async () => {
    if (!confirm("Create Content Studio profiles for every active CRM client and queue a push for each?")) return;
    setBusy("backfill");
    try {
      const result = await recorder<{ companies: number; queued: number; skipped: number }>("push.all");
      toast({ title: "Backfill queued", description: `${result.queued} queued${result.skipped ? `, ${result.skipped} skipped` : ""}.` });
      await load();
    } catch (e) {
      toast({ title: "Backfill failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const activeTokens = tokens.filter((t) => !t.revoked_at);

  return (
    <DashboardLayout>
      <TopBar title="Content Studio connection" subtitle="Recorder credentials, pull access and recent sync activity" />

      <div className="p-4 sm:p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="h-8">
            <Link to="/dashboard/crm/content"><ArrowLeft className="h-4 w-4" /> Content Studio</Link>
          </Button>
        </div>

        {error && <ErrorNote message={error} />}

        {loading ? (
          <InlineLoader label="Loading connection" />
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              <div className={cn("rounded-xl border p-5", status?.configured ? "border-[#22C55E]/30 bg-[#22C55E]/5" : "border-[#F59E0B]/30 bg-[#F59E0B]/5")}>
                <div className="flex items-center gap-2">
                  {status?.configured ? <CheckCircle2 className="h-4 w-4 text-[#22C55E]" /> : <TriangleAlert className="h-4 w-4 text-[#F59E0B]" />}
                  <h3 className="text-sm font-bold text-foreground">Push connection</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  The intake address and key are held in server secrets. They are never shown here, sent to the browser or written to logs.
                </p>
                <dl className="mt-4 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Intake address</dt>
                    <dd className="font-semibold text-foreground">
                      {status?.intake_url_configured ? (status.intake_url_valid ? "Configured" : "Not a valid HTTPS address") : "Missing"}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">Intake key</dt>
                    <dd className="font-semibold text-foreground">{status?.intake_key_configured ? "Configured" : "Missing"}</dd>
                  </div>
                </dl>
                {!status?.configured && (
                  <p className="mt-3 rounded-lg border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-3 py-2 text-[11px] text-[#B45309] dark:text-[#FBBF24]">
                    {status?.intake_url_configured && !status?.intake_url_valid
                      ? "The stored intake address is not a valid https:// URL. Re-enter the address shown in the recorder's Admin → CityWide page."
                      : "Ask the operator to add the recorder intake address and key as server secrets. Pushes stay queued until both exist."}
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-border bg-card p-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Pull endpoint</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Give this address and a pull token to the recorder. It is read-only, returns every active company and uses the same ids as push.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2">
                  <code className="min-w-0 flex-1 break-all text-[10px] text-foreground">{status?.pull_endpoint}</code>
                  <CopyButton value={status?.pull_endpoint ?? ""} />
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">
                  Send <code className="rounded bg-muted/50 px-1">Authorization: Bearer &lt;pull token&gt;</code>. Missing or wrong tokens return 401.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
                <div>
                  <h3 className="text-sm font-bold text-foreground">Pull tokens</h3>
                  <p className="text-xs text-muted-foreground">Separate from the intake key. Stored hashed; plaintext is shown once.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setTokenError(null); setCreateOpen(true); }}>
                    <KeyRound className="h-4 w-4" /> New token
                  </Button>
                  <Button variant="outline" size="sm" onClick={rotate} disabled={busy === "rotate"}>
                    {busy === "rotate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                    Rotate
                  </Button>
                </div>
              </div>

              {tokens.length === 0 ? (
                <p className="p-5 text-xs text-muted-foreground">No pull token yet. Create one and paste it into the recorder's Admin → CityWide → Pull settings.</p>
              ) : (
                <div className="divide-y divide-border">
                  {tokens.map((token) => (
                    <div key={token.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-bold text-foreground">{token.label}</span>
                          {token.revoked_at ? (
                            <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase text-muted-foreground">Revoked</span>
                          ) : (
                            <StatusPill status="ok" label="Active" />
                          )}
                        </div>
                        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{token.token_prefix}…</p>
                        <p className="mt-0.5 text-[10px] text-muted-foreground">Created {fmtWhen(token.created_at)} · Last used {fmtWhen(token.last_used_at)}</p>
                      </div>
                      {!token.revoked_at && (
                        <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => revoke(token)} disabled={busy === token.id}>
                          {busy === token.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                          Revoke
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="flex items-center justify-between border-b border-border p-5">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Recent pushes</h3>
                    <p className="text-xs text-muted-foreground">Newest first. Credentials never appear in this log.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={load}><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
                </div>
                {(status?.recent_pushes ?? []).length === 0 ? (
                  <p className="p-5 text-xs text-muted-foreground">No pushes yet.</p>
                ) : (
                  <div className="divide-y divide-border">
                    {(status?.recent_pushes ?? []).map((log) => (
                      <div key={log.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[11px]">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <span className={cn("h-2 w-2 rounded-full", log.ok ? "bg-[#22C55E]" : "bg-destructive")} />
                          <span className="font-semibold text-foreground">{log.ok ? "Accepted" : "Failed"}</span>
                          <span className="text-muted-foreground">{log.location_slug ? `/${log.location_slug}` : log.stable_id}</span>
                          {log.error && <span className="truncate text-destructive">{log.error}</span>}
                        </div>
                        <span className="text-muted-foreground">{fmtWhen(log.created_at)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="rounded-xl border border-border bg-card p-5">
                  <h3 className="text-sm font-bold text-foreground">Backfill</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Creates a profile and one location for every active CRM client, then queues a push. Safe to run more than once: ids never change and existing profiles are kept.
                  </p>
                  <Button className="mt-4 w-full" size="sm" onClick={backfill} disabled={busy === "backfill" || !status?.configured}>
                    {busy === "backfill" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                    Backfill active companies
                  </Button>
                </div>

                <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                  <h3 className="text-sm font-bold text-foreground">Operator steps</h3>
                  <ol className="space-y-2 text-[11px] text-muted-foreground">
                    <li><span className="font-semibold text-foreground">1.</span> In the recorder, open Admin → CityWide and copy the intake address and key. They are stored here as server secrets, never in the browser.</li>
                    <li><span className="font-semibold text-foreground">2.</span> Create a pull token above and paste it into Admin → CityWide → Pull settings.</li>
                    <li><span className="font-semibold text-foreground">3.</span> Use the recorder's Test connection, then run a backfill.</li>
                    <li><span className="font-semibold text-foreground">4.</span> Rotate the pull token here if it is ever exposed. The intake key is unaffected.</li>
                  </ol>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              {activeTokens.length} active pull token{activeTokens.length === 1 ? "" : "s"} · nightly reconciliation runs automatically for every active company.
            </p>
          </>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a pull token</DialogTitle>
            <DialogDescription>
              The plaintext token is shown once. Only its hash is stored. It can be revoked or rotated without changing the intake key.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="token-label">Label</Label>
            <Input id="token-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Recorder pull" />
          </div>
          <ErrorNote message={tokenError} />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createToken} disabled={busy === "create"}>
              {busy === "create" && <Loader2 className="h-4 w-4 animate-spin" />}
              Create token
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(createdToken)} onOpenChange={(open) => { if (!open) setCreatedToken(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copy the pull token now</DialogTitle>
            <DialogDescription>
              This is the only time the plaintext is shown. Paste it into the recorder's Admin → CityWide → Pull settings.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3">
              <code className="min-w-0 flex-1 break-all text-[11px] text-foreground">{createdToken}</code>
              <CopyButton value={createdToken ?? ""} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              If it is lost, rotate it: the old token stops working immediately and the recorder receives a new one.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
