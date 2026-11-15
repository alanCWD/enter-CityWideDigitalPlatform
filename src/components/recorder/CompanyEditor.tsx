import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleSlash,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  QrCode,
  RefreshCw,
  Settings2,
  Sparkles,
  Upload,
  Video,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import {
  fmtWhen,
  recorder,
  syncTone,
  TRADE_LABELS,
  uploadRecorderAsset,
  type CompanyDetail,
  type ConnectionStatus,
  type PushLog,
  type RecorderCampaign,
  type RecorderCompany,
  type RecorderLocation,
  type Trade,
} from "@/lib/recorder";
import { CustomerLink, ErrorNote, InlineLoader, StatusPill } from "./RecorderBits";
import { LocationDialog } from "./LocationDialog";
import { CampaignDialog } from "./CampaignDialog";

type Tab = "brand" | "locations" | "activity";

interface BrandForm {
  name: string;
  trade: Trade;
  brand_color: string;
  logo_url: string;
  is_network: boolean;
  watermark_url: string;
  watermark_text: string;
  watermark_handle: string;
  credit_line: string;
  default_hashtags: string;
  enabled: boolean;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "brand", label: "Company & brand" },
  { id: "locations", label: "Locations & campaigns" },
  { id: "activity", label: "Activity" },
];

function brandForm(company: RecorderCompany): BrandForm {
  return {
    name: company.name ?? "",
    trade: company.trade ?? "general",
    brand_color: company.brand_color ?? "#0078D7",
    logo_url: company.logo_url ?? "",
    is_network: company.is_network,
    watermark_url: company.watermark_url ?? "",
    watermark_text: company.watermark_text ?? "",
    watermark_handle: company.watermark_handle ?? "",
    credit_line: company.credit_line ?? "",
    default_hashtags: company.default_hashtags ?? "",
    enabled: company.enabled,
  };
}

export function CompanyEditor({ companyId }: { companyId: string }) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<CompanyDetail | null>(null);
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("brand");

  const [form, setForm] = useState<BrandForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [locationOpen, setLocationOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<RecorderLocation | null>(null);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<RecorderCampaign | null>(null);
  const [campaignLocationId, setCampaignLocationId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [company, connection] = await Promise.all([
        recorder<CompanyDetail>("company.get", { company_id: companyId }),
        recorder<ConnectionStatus>("status").catch(() => null),
      ]);
      setDetail(company);
      setForm(brandForm(company.company));
      if (connection) setStatus(connection);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  useEffect(() => {
    if (tab !== "activity") return;
    recorder<{ logs: PushLog[] }>("activity.list", { company_id: companyId })
      .then((res) => setLogs(res.logs ?? []))
      .catch(() => setLogs([]));
  }, [tab, companyId]);

  const set = <K extends keyof BrandForm>(key: K, value: BrandForm[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const saveBrand = async () => {
    if (!detail || !form) return;
    if (form.is_network && !form.name.trim()) {
      toast({ title: "Network name required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await recorder("company.save", {
        company_id: detail.company.id,
        name: form.name.trim(),
        trade: form.trade,
        brand_color: form.brand_color,
        logo_url: form.logo_url.trim() || null,
        is_network: form.is_network,
        watermark_url: form.watermark_url.trim() || null,
        watermark_text: form.watermark_text.trim() || null,
        watermark_handle: form.watermark_handle.trim() || null,
        credit_line: form.credit_line.trim() || null,
        default_hashtags: form.default_hashtags.trim() || null,
        enabled: form.enabled,
      });
      toast({ title: "Brand saved", description: "The recorder push has been queued." });
      await load();
    } catch (e) {
      toast({ title: "Could not save", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const uploadAsset = async (file: File) => {
    if (!detail) return;
    setUploading(true);
    try {
      const url = await uploadRecorderAsset(
        { company_id: detail.company.id, kind: detail.company.is_network ? "watermark" : "logo", filename: file.name },
        file,
      );
      if (detail.company.is_network) set("watermark_url", url);
      else set("logo_url", url);
    } catch (e) {
      toast({ title: "Upload failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const pushNow = async () => {
    if (!detail) return;
    setPushing(true);
    try {
      const result = await recorder<{ ok: boolean; pushed: number; results: Array<{ ok: boolean; error: string | null }> }>(
        "push.now",
        { company_id: detail.company.id },
      );
      if (result.ok) {
        toast({ title: "Sent to the recorder", description: `${result.pushed} location${result.pushed === 1 ? "" : "s"} updated.` });
      } else {
        const firstError = result.results.find((r) => !r.ok)?.error ?? "The recorder did not accept the push.";
        toast({ title: "Push failed", description: firstError, variant: "destructive" });
      }
      await load();
    } catch (e) {
      toast({ title: "Push failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setPushing(false);
    }
  };

  const archiveLocation = async (location: RecorderLocation) => {
    if (!confirm(`Archive “${location.name}”? It will stop syncing; the recorder keeps its data.`)) return;
    try {
      await recorder("location.archive", { id: location.id });
      toast({ title: "Location archived", description: "The recorder keeps everything it already received." });
      await load();
    } catch (e) {
      toast({ title: "Could not archive", description: (e as Error).message, variant: "destructive" });
    }
  };

  const archiveCampaign = async (campaign: RecorderCampaign) => {
    if (!confirm(`Archive “${campaign.label}”? It will stop being sent as active.`)) return;
    try {
      await recorder("campaign.archive", { id: campaign.id });
      toast({ title: "Campaign archived" });
      await load();
    } catch (e) {
      toast({ title: "Could not archive", description: (e as Error).message, variant: "destructive" });
    }
  };

  if (loading) return <InlineLoader label="Loading Content Studio" />;
  if (error) return <div className="p-6"><ErrorNote message={error} /><Button className="mt-4" variant="outline" onClick={load}>Retry</Button></div>;
  if (!detail || !form) return null;

  const company = detail.company;
  const primaryLocation = detail.locations.find((l) => l.active && l.customer_url) ?? detail.locations.find((l) => l.active);
  const activeLocations = detail.locations.filter((l) => l.active);
  const failed = activeLocations.find((l) => l.last_sync_status === "failed");
  const statusOverall = activeLocations.length === 0
    ? "idle"
    : activeLocations.every((l) => l.last_sync_status === "ok")
      ? "ok"
      : failed ? "failed" : "idle";

  return (
    <div className="p-4 sm:p-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon" className="h-9 w-9">
            <Link to="/dashboard/crm/content" aria-label="Back to Content Studio"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">{company.name}</h2>
              {company.is_network ? (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Network</span>
              ) : (
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Single business</span>
              )}
              <StatusPill status={statusOverall === "ok" ? "ok" : statusOverall === "failed" ? "failed" : "idle"} />
            </div>
            <p className="text-xs text-muted-foreground">
              {company.crm_client_id ? `CRM client ${company.crm_client_id}` : "Standalone network"} · {TRADE_LABELS[company.trade]} · {activeLocations.length} active location{activeLocations.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {primaryLocation?.customer_url && (
            <Button asChild variant="outline" size="sm">
              <a href={primaryLocation.customer_url} target="_blank" rel="noreferrer">
                <ArrowUpRight className="h-4 w-4" /> Customer page
              </a>
            </Button>
          )}
          {primaryLocation?.qr_url && (
            <Button asChild variant="outline" size="sm">
              <a href={primaryLocation.qr_url} target="_blank" rel="noreferrer" download>
                <QrCode className="h-4 w-4" /> QR
              </a>
            </Button>
          )}
          <Button size="sm" onClick={pushNow} disabled={pushing || !status?.configured}>
            {pushing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Push now
          </Button>
        </div>
      </div>

      {!status?.configured && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#F59E0B]/30 bg-[#F59E0B]/10 px-4 py-3 text-xs text-[#B45309] dark:text-[#FBBF24]">
          <span className="flex items-center gap-2"><CircleSlash className="h-4 w-4" /> Recorder intake credentials are not configured yet. Pushes are held until they are.</span>
          <Button asChild variant="outline" size="sm" className="h-8 border-[#F59E0B]/40 text-[#B45309] dark:text-[#FBBF24]">
            <Link to="/dashboard/crm/content/settings">Connection settings</Link>
          </Button>
        </div>
      )}

      {failed?.last_sync_error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <p className="font-semibold">The recorder rejected the last push.</p>
          <p className="mt-1">{failed.last_sync_error}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-1 rounded-xl border border-border bg-card p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-bold transition-colors",
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "brand" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-xl border border-border bg-card p-5 space-y-5">
            <div>
              <h3 className="text-sm font-bold text-foreground">Company details</h3>
              <p className="text-xs text-muted-foreground">These values are sent with every location and campaign.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="company-name">Name</Label>
                <Input
                  id="company-name"
                  value={form.name}
                  disabled={!company.is_network}
                  onChange={(e) => set("name", e.target.value)}
                />
                {!company.is_network && <p className="text-[10px] text-muted-foreground">Managed by the CRM client record.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-trade">Trade</Label>
                <Select value={form.trade} onValueChange={(value: Trade) => set("trade", value)}>
                  <SelectTrigger id="company-trade"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRADE_LABELS) as Trade[]).map((trade) => (
                      <SelectItem key={trade} value={trade}>{TRADE_LABELS[trade]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="company-colour">Brand colour</Label>
                <div className="flex gap-2">
                  <input
                    aria-label="Brand colour picker"
                    type="color"
                    value={/^#[0-9A-Fa-f]{6}$/.test(form.brand_color) ? form.brand_color : "#0078D7"}
                    onChange={(e) => set("brand_color", e.target.value.toUpperCase())}
                    className="h-10 w-12 cursor-pointer rounded-lg border border-input bg-transparent p-1"
                  />
                  <Input id="company-colour" value={form.brand_color} onChange={(e) => set("brand_color", e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Included in Content Studio</Label>
                <div className="flex h-10 items-center gap-2 rounded-lg border border-border px-3">
                  <Switch checked={form.enabled} onCheckedChange={(value) => set("enabled", value)} />
                  <span className="text-xs text-muted-foreground">{form.enabled ? "Active" : "Paused — no pushes"}</span>
                </div>
              </div>

              {!company.is_network && (
                <>
                  <div className="space-y-1.5">
                    <Label>Website</Label>
                    <Input value={company.website ?? ""} disabled placeholder="From the CRM record" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>City</Label>
                    <Input value={company.city ?? ""} disabled placeholder="From the CRM record" />
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2 border-t border-border pt-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Network company</p>
                  <p className="text-xs text-muted-foreground">Use this for an influencer or multi-restaurant brand such as Victoria Food Scene.</p>
                </div>
                <Switch checked={form.is_network} onCheckedChange={(value) => set("is_network", value)} />
              </div>
            </div>

            {form.is_network && (
              <div className="space-y-4 rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Network brand kit</p>
                <div className="space-y-2">
                  <Label htmlFor="company-logo">Network logo</Label>
                  <div className="flex gap-2">
                    <Input id="company-logo" value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://… public image" />
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) uploadAsset(file);
                        e.target.value = "";
                      }}
                    />
                    <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" disabled={uploading} onClick={() => fileRef.current?.click()}>
                      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      Upload
                    </Button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="company-watermark">Watermark image</Label>
                    <div className="flex gap-2">
                      <Input id="company-watermark" value={form.watermark_url} onChange={(e) => set("watermark_url", e.target.value)} placeholder="https://… public image" />
                      <Button type="button" variant="outline" size="sm" className="h-10 shrink-0" disabled={uploading} onClick={() => fileRef.current?.click()}>
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        Upload
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company-watermark-text">Watermark text</Label>
                    <Input id="company-watermark-text" value={form.watermark_text} onChange={(e) => set("watermark_text", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company-handle">Handle</Label>
                    <Input id="company-handle" value={form.watermark_handle} onChange={(e) => set("watermark_handle", e.target.value)} placeholder="@victoriafoodscene" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company-credit">Credit line</Label>
                    <Input id="company-credit" value={form.credit_line} onChange={(e) => set("credit_line", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="company-hashtags">Default hashtags</Label>
                    <Input id="company-hashtags" value={form.default_hashtags} onChange={(e) => set("default_hashtags", e.target.value)} placeholder="#victoriafoodscene" />
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">Images must be publicly readable over HTTPS so the recorder can draw them into a video canvas.</p>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={saveBrand} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Save brand
              </Button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <h3 className="text-sm font-bold text-foreground">What the recorder receives</h3>
              <dl className="space-y-2 text-xs">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Company id</dt>
                  <dd className="text-right font-mono text-[10px] text-foreground break-all">{company.stable_id}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Logo</dt>
                  <dd className="text-right text-foreground">{company.is_network ? "Network logo" : detail.branding?.logo_square_url ? "CRM brand asset" : "Not set"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Brand kit</dt>
                  <dd className="text-right text-foreground">{company.is_network ? "Sent" : "Omitted"}</dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Last push</dt>
                  <dd className="text-right text-foreground">{fmtWhen(primaryLocation?.last_synced_at)}</dd>
                </div>
              </dl>
            </div>

            {!company.is_network && (
              <div className="rounded-xl border border-border bg-card p-5 space-y-2">
                <div className="flex items-center gap-2 text-sm font-bold text-foreground"><Building2 className="h-4 w-4 text-primary" /> Brand assets</div>
                {detail.branding?.logo_square_url ? (
                  <img src={detail.branding.logo_square_url} alt={`${company.name} logo`} className="max-h-20 w-auto rounded-lg border border-border bg-muted/20 p-2" />
                ) : (
                  <p className="text-xs text-muted-foreground">No square logo uploaded in the CRM client record yet.</p>
                )}
                <p className="text-[10px] text-muted-foreground">The recorder uses this logo for a single business. Update it in the client's brand assets.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "locations" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold text-foreground">Locations</h3>
              <p className="text-xs text-muted-foreground">One recorder request per location. Campaigns belong to a location.</p>
            </div>
            <Button size="sm" onClick={() => { setEditingLocation(null); setLocationOpen(true); }}>
              <Plus className="h-4 w-4" /> Add location
            </Button>
          </div>

          {detail.locations.length === 0 && (
            <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
              <MapPin className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold text-foreground">No locations yet</p>
              <p className="mt-1 text-xs text-muted-foreground">Add the first location to start sending content setup to the recorder.</p>
            </div>
          )}

          {detail.locations.map((location) => (
            <div key={location.id} className={cn("rounded-xl border border-border bg-card", !location.active && "opacity-60")}>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-foreground">{location.name}</h4>
                    <StatusPill status={syncTone(location.last_sync_status) === "ok" ? "ok" : syncTone(location.last_sync_status) === "failed" ? "failed" : "idle"} />
                    {!location.active && <span className="text-[10px] font-bold uppercase text-muted-foreground">Archived</span>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {[location.address, location.neighbourhood].filter(Boolean).join(" · ") || "No address"} · {fmtWhen(location.last_synced_at)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {[["Video", location.enable_video], ["Photos", location.enable_photos], ["Wall", location.enable_wall]].map(([label, on]) => (
                      <span key={String(label)} className={cn("rounded-full border px-2 py-0.5 text-[10px] font-semibold", on ? "border-primary/25 bg-primary/10 text-primary" : "border-border bg-muted/30 text-muted-foreground")}>
                        {label}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button variant="outline" size="sm" className="h-8" onClick={() => { setEditingLocation(location); setLocationOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {location.active && (
                    <Button variant="ghost" size="sm" className="h-8 text-muted-foreground" onClick={() => archiveLocation(location)}>
                      Archive
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 p-4 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Customer link</p>
                  <div className="mt-1.5"><CustomerLink url={location.customer_url} qr={location.qr_url} slug={location.location_slug} /></div>
                  {location.embed_path && <p className="mt-1 text-[10px] text-muted-foreground">Embed path: {location.embed_path}</p>}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Recorder result</p>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {location.last_sync_status === "ok"
                      ? `${location.campaigns_sent ?? 0} campaign${location.campaigns_sent === 1 ? "" : "s"} accepted${location.campaign_code ? ` · ${location.campaign_code}` : ""}`
                      : location.last_sync_error ?? "Has not been pushed yet."}
                  </p>
                </div>
              </div>

              <div className="border-t border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-bold text-foreground">Campaigns</p>
                  <Button variant="outline" size="sm" className="h-8" onClick={() => {
                    setCampaignLocationId(location.id);
                    setEditingCampaign(null);
                    setCampaignOpen(true);
                  }}>
                    <Plus className="h-3.5 w-3.5" /> Add campaign
                  </Button>
                </div>
                {location.campaigns.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No campaign yet. The location still pushes with no campaign.</p>
                ) : (
                  <div className="mt-3 space-y-2">
                    {location.campaigns.map((campaign) => (
                      <div key={campaign.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-foreground">{campaign.label}</span>
                            <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase", campaign.format === "promo" ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-muted/40 text-muted-foreground")}>
                              {campaign.format}
                            </span>
                            {!campaign.active && <span className="text-[10px] uppercase text-muted-foreground">Archived</span>}
                          </div>
                          <p className="mt-0.5 text-[10px] text-muted-foreground">
                            {campaign.due_at ? `Due ${new Date(campaign.due_at).toLocaleDateString("en-CA")}` : "No due date"} · {campaign.scenes.length} scenes
                            {campaign.format === "promo" && campaign.dish_name ? ` · ${campaign.dish_name}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => {
                            setCampaignLocationId(location.id);
                            setEditingCampaign(campaign);
                            setCampaignOpen(true);
                          }}>
                            <Pencil className="h-3 w-3" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] text-muted-foreground" onClick={() => archiveCampaign(campaign)}>
                            Archive
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "activity" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Recent pushes</h3>
              <p className="text-xs text-muted-foreground">No credentials or intake keys are ever logged.</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => recorder<{ logs: PushLog[] }>("activity.list", { company_id: companyId }).then((r) => setLogs(r.logs ?? []))}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
          {logs.length === 0 ? (
            <p className="p-6 text-xs text-muted-foreground">No pushes recorded for this company yet.</p>
          ) : (
            <div className="divide-y divide-border">
              {logs.map((log) => (
                <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {log.ok ? <CheckCircle2 className="h-4 w-4 text-[#22C55E]" /> : <CircleSlash className="h-4 w-4 text-destructive" />}
                      <span className="text-xs font-semibold text-foreground">{log.ok ? "Accepted" : "Failed"}</span>
                      <span className="text-[10px] text-muted-foreground">{fmtWhen(log.created_at)}</span>
                      {log.status_code && <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] text-muted-foreground">HTTP {log.status_code}</span>}
                    </div>
                    {log.error && <p className="mt-1 text-[11px] text-destructive break-words">{log.error}</p>}
                    {log.location_slug && <p className="mt-1 text-[10px] text-muted-foreground">/{log.location_slug}</p>}
                  </div>
                  <span className="text-[10px] text-muted-foreground">{log.duration_ms ? `${log.duration_ms} ms` : ""} · {log.attempts} attempt{log.attempts === 1 ? "" : "s"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <LocationDialog
        open={locationOpen}
        onOpenChange={setLocationOpen}
        companyId={company.id}
        location={editingLocation}
        onSaved={load}
      />

      {campaignLocationId && (
        <CampaignDialog
          open={campaignOpen}
          onOpenChange={(open) => { setCampaignOpen(open); if (!open) setEditingCampaign(null); }}
          locationId={campaignLocationId}
          campaign={editingCampaign}
          onSaved={load}
        />
      )}
    </div>
  );
}
