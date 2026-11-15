import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clapperboard,
  CloudUpload,
  Loader2,
  Plus,
  RefreshCw,
  Settings2,
  Store,
  TriangleAlert,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { fmtWhen, recorder, TRADE_LABELS, type ConnectionStatus, type RecorderCompany, type Trade } from "@/lib/recorder";
import { ErrorNote, InlineLoader, StatusPill } from "@/components/recorder/RecorderBits";
import { cn } from "@/lib/utils";

export function ContentStudio() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [companies, setCompanies] = useState<RecorderCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const [newOpen, setNewOpen] = useState(false);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState<Trade>("restaurant");
  const [color, setColor] = useState("#0078D7");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [connection, list] = await Promise.all([
        recorder<ConnectionStatus>("status"),
        recorder<{ companies: RecorderCompany[] }>("company.list"),
      ]);
      setStatus(connection);
      setCompanies(list.companies ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createNetwork = async () => {
    if (!name.trim()) {
      setCreateError("Name the network first.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const result = await recorder<{ company: RecorderCompany }>("company.save", {
        name: name.trim(),
        trade,
        brand_color: color,
        is_network: true,
      });
      setNewOpen(false);
      setName("");
      toast({ title: "Network created", description: "Add its restaurants as locations, then push." });
      navigate(`/dashboard/crm/content/${result.company.id}`);
    } catch (e) {
      setCreateError((e as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const backfill = async () => {
    if (!confirm("Create Content Studio profiles for every active CRM client and queue a push for each? Existing profiles keep their settings.")) return;
    setBackfilling(true);
    try {
      const result = await recorder<{ companies: number; queued: number; skipped: number }>("push.all");
      toast({
        title: "Backfill queued",
        description: `${result.queued} compan${result.queued === 1 ? "y" : "ies"} queued${result.skipped ? `, ${result.skipped} skipped` : ""}. Pushes run in the background.`,
      });
      await load();
    } catch (e) {
      toast({ title: "Backfill failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  const networkCount = companies.filter((c) => c.is_network).length;

  return (
    <DashboardLayout>
      <TopBar
        title="Content Studio"
        subtitle="Company assets, locations and campaigns for the Customer Content Studio recorder"
        action={{ label: "New network", onClick: () => { setCreateError(null); setNewOpen(true); } }}
      />

      <div className="p-4 sm:p-6 space-y-5">
        {error && <ErrorNote message={error} />}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className={cn("rounded-xl border p-4", status?.configured ? "border-[#22C55E]/30 bg-[#22C55E]/5" : "border-[#F59E0B]/30 bg-[#F59E0B]/5")}>
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Connection</p>
              {status?.configured ? <CheckCircle2 className="h-4 w-4 text-[#22C55E]" /> : <TriangleAlert className="h-4 w-4 text-[#F59E0B]" />}
            </div>
            <p className="mt-1 text-lg font-bold text-foreground">{status?.configured ? "Ready" : "Needs setup"}</p>
            <p className="text-[11px] text-muted-foreground">
              {status?.configured
                ? "Intake address and key are stored in server secrets."
                : status?.intake_url_configured && !status?.intake_url_valid
                  ? "The stored intake address is not a valid HTTPS URL."
                  : "Add the recorder intake address and key."}
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Companies</p>
            <p className="mt-1 text-lg font-bold text-foreground">{companies.length}</p>
            <p className="text-[11px] text-muted-foreground">{networkCount} network{networkCount === 1 ? "" : "s"} · {companies.filter((c) => c.enabled).length} active</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Locations</p>
            <p className="mt-1 text-lg font-bold text-foreground">{status?.locations_active ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Each location gets its own customer page and QR.</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Pending pushes</p>
            <p className="mt-1 text-lg font-bold text-foreground">{status?.pending_pushes ?? 0}</p>
            <p className="text-[11px] text-muted-foreground">Queued and retried automatically.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/dashboard/crm/content/settings"><Settings2 className="h-4 w-4" /> Connection & pull token</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={backfill} disabled={backfilling || !status?.configured}>
              {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              Backfill active companies
            </Button>
          </div>
          <Button variant="ghost" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
        </div>

        {loading ? (
          <InlineLoader label="Loading Content Studio" />
        ) : companies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
            <Clapperboard className="mx-auto h-8 w-8 text-muted-foreground" />
            <h3 className="mt-3 text-sm font-bold text-foreground">No companies in Content Studio yet</h3>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Backfill creates a profile and one location for every active CRM client. You can also create a standalone network such as Victoria Food Scene and add its restaurants as locations.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" onClick={backfill} disabled={backfilling || !status?.configured}>
                {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
                Backfill active companies
              </Button>
              <Button size="sm" variant="outline" onClick={() => setNewOpen(true)}>
                <Plus className="h-4 w-4" /> Create a network
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {companies.map((company) => {
              const tone = company.last_sync_status === "ok" ? "ok" : company.last_sync_status === "failed" ? "failed" : "idle";
              return (
                <Link
                  key={company.id}
                  to={`/dashboard/crm/content/${company.id}`}
                  className="group rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_8px_24px_-12px_rgba(0,120,215,0.35)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      {company.logo_url ? (
                        <img src={company.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-border bg-muted/30 object-contain p-1" />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30">
                          {company.is_network ? <Clapperboard className="h-5 w-5 text-primary" /> : <Store className="h-5 w-5 text-muted-foreground" />}
                        </span>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{company.name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {company.is_network ? "Network" : "Single business"} · {TRADE_LABELS[company.trade]}
                        </p>
                      </div>
                    </div>
                    <StatusPill status={tone} label={tone === "ok" ? "Synced" : tone === "failed" ? "Issue" : "New"} />
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-1.5"><Building2 className="h-3.5 w-3.5" /> {company.location_count ?? 0} location{(company.location_count ?? 0) === 1 ? "" : "s"}</span>
                    <span>{company.last_synced_at ? `Synced ${fmtWhen(company.last_synced_at)}` : "Not pushed yet"}</span>
                  </div>

                  {company.last_sync_error && (
                    <p className="mt-2 line-clamp-2 text-[10px] text-destructive">{company.last_sync_error}</p>
                  )}

                  <div className="mt-3 flex items-center justify-end text-[11px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    Open <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a network company</DialogTitle>
            <DialogDescription>
              Use this for an influencer brand that groups several restaurants. Each restaurant becomes a location under this one company id.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="network-name">Network name</Label>
              <Input id="network-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Victoria Food Scene" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="network-trade">Trade</Label>
                <Select value={trade} onValueChange={(value: Trade) => setTrade(value)}>
                  <SelectTrigger id="network-trade"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRADE_LABELS) as Trade[]).map((t) => <SelectItem key={t} value={t}>{TRADE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="network-colour">Brand colour</Label>
                <div className="flex gap-2">
                  <input
                    aria-label="Network brand colour"
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value.toUpperCase())}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                  />
                  <Input id="network-colour" value={color} onChange={(e) => setColor(e.target.value)} />
                </div>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              After creating it, add the network logo, watermark, handle and hashtags on the brand tab.
            </p>
            <ErrorNote message={createError} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button onClick={createNetwork} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create network
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
