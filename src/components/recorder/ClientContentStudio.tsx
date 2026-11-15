import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { fmtWhen, recorder, type CompanyDetail } from "@/lib/recorder";
import { CustomerLink, ErrorNote, StatusPill } from "./RecorderBits";

export function ClientContentStudio({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pushing, setPushing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await recorder<CompanyDetail>("company.get", { crm_client_id: clientId });
      setDetail(result);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  const push = async () => {
    if (!detail) return;
    setPushing(true);
    try {
      const result = await recorder<{ ok: boolean; pushed: number; results: Array<{ error: string | null }> }>("push.now", {
        company_id: detail.company.id,
      });
      if (result.ok) toast({ title: "Sent to the recorder", description: `${result.pushed} location${result.pushed === 1 ? "" : "s"} updated.` });
      else toast({ title: "Push failed", description: result.results.find((r) => r.error)?.error ?? "The recorder did not accept the push.", variant: "destructive" });
      await load();
    } catch (e) {
      toast({ title: "Push failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPushing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 p-6 text-xs text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading Content Studio</div>;
  }
  if (error) return <div className="p-6"><ErrorNote message={error} /><Button variant="outline" className="mt-3" size="sm" onClick={load}>Retry</Button></div>;
  if (!detail) return null;

  const locations = detail.locations.filter((l) => l.active);
  const primary = locations.find((l) => l.customer_url) ?? locations[0];
  const status = locations.length === 0
    ? "idle"
    : locations.every((l) => l.last_sync_status === "ok")
      ? "ok"
      : locations.some((l) => l.last_sync_status === "failed") ? "failed" : "idle";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Content Studio</h3>
              <StatusPill status={status === "ok" ? "ok" : status === "failed" ? "failed" : "idle"} />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {locations.length} active location{locations.length === 1 ? "" : "s"} · Last push {fmtWhen(primary?.last_synced_at)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={push} disabled={pushing}>
              {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Push now
            </Button>
            <Button asChild size="sm">
              <Link to={`/dashboard/crm/content/${detail.company.id}`}>
                Manage <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </div>

        {primary && (
          <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Customer link</p>
              <div className="mt-1"><CustomerLink url={primary.customer_url} qr={primary.qr_url} slug={primary.location_slug} /></div>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recorder</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {primary.last_sync_status === "ok"
                  ? `${primary.campaigns_sent ?? 0} campaign${primary.campaigns_sent === 1 ? "" : "s"} accepted`
                  : primary.last_sync_error ?? "Has not been pushed yet."}
              </p>
            </div>
          </div>
        )}
      </div>

      {locations.length > 1 && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h3 className="text-xs font-bold text-foreground">Locations</h3>
          </div>
          <div className="divide-y divide-border">
            {locations.map((location) => (
              <div key={location.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-foreground">{location.name}</p>
                  <p className="text-[10px] text-muted-foreground">{location.customer_url ? `/${location.location_slug}` : "Not pushed yet"}</p>
                </div>
                <CustomerLink url={location.customer_url} qr={location.qr_url} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
