import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  useQboConnection,
  useReviewRequests,
  useQboConnectionAttempts,
  useClientBrandAssets,
  type ReviewPlatform,
  type ReviewPlatformKey,
} from "@/hooks/useQuickbooks";
import { useToast } from "@/hooks/use-toast";
import { BrandAssetsUploader } from "./BrandAssetsUploader";
import {
  Loader2, Link2, CheckCircle2, Unlink, Save, RefreshCw,
  Mail, AlertCircle, Star, Send, X, Eye, EyeOff, Activity, Clock,
  Globe, Facebook, Building2, Copy,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const STAGE_LABELS: Record<string, { label: string; tone: "ok" | "error" | "info" }> = {
  landed: { label: "Client opened the link", tone: "info" },
  error_param: { label: "QuickBooks returned an error before redirecting", tone: "error" },
  no_code: { label: "Redirected back without an authorization code", tone: "error" },
  callback_invoking: { label: "Exchanging authorization code…", tone: "info" },
  callback_error: { label: "Token exchange failed", tone: "error" },
  callback_failed: { label: "Connection could not be saved", tone: "error" },
  success: { label: "Connected successfully", tone: "ok" },
  exception: { label: "Unexpected error in browser", tone: "error" },
};

const PLATFORM_ROWS: { key: ReviewPlatformKey; label: string; icon: typeof Globe; placeholder: string }[] = [
  { key: "google", label: "Google", icon: Globe, placeholder: "https://g.page/r/XXXX/review" },
  { key: "facebook", label: "Facebook", icon: Facebook, placeholder: "https://facebook.com/yourpage/reviews" },
  { key: "bbb", label: "BBB", icon: Building2, placeholder: "https://bbb.org/profile/your-business" },
  { key: "yelp", label: "Yelp", icon: Star, placeholder: "https://yelp.com/biz/your-business" },
];

const PLATFORM_EMAIL_UI: Record<ReviewPlatformKey, { bg: string; label: string }> = {
  google: { bg: "#4285F4", label: "Review us on Google" },
  facebook: { bg: "#1877F2", label: "Review us on Facebook" },
  bbb: { bg: "#0B5CAB", label: "Review us on BBB" },
  yelp: { bg: "#D32323", label: "Review us on Yelp" },
};

const DEFAULT_SUBJECT = "Thanks for your business — leave us a review?";
const DEFAULT_INTRO_PARAS =
  '<p style="color:#555;line-height:1.7;margin:0 0 16px;">We truly appreciate your business. Your experience matters to us, and we\'d love to hear your feedback.</p>' +
  '<p style="color:#555;line-height:1.7;margin:0 0 24px;">Would you mind taking a moment to leave us a review? It helps us improve and helps others discover our services.</p>';

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function platformButtonHtml(p: { platform: ReviewPlatformKey; url: string }): string {
  const ui = PLATFORM_EMAIL_UI[p.platform];
  return `<a href="${escapeHtml(p.url)}" style="display:block;text-align:center;background:${ui.bg};color:#ffffff;padding:14px 24px;text-decoration:none;border-radius:8px;font-size:15px;font-weight:bold;margin:0 0 10px;">${ui.label}</a>`;
}

// MUST be kept in sync with buildReviewEmailHtml in qbo-poll-invoices/index.ts.
function buildReviewEmailHtml(opts: {
  customerName: string;
  platforms: { platform: ReviewPlatformKey; url: string }[];
  logoUrl: string | null;
  subject: string | null;
  intro: string | null;
}): string {
  const heading = opts.subject && opts.subject.trim() ? opts.subject : `Thank you, ${opts.customerName}!`;
  const introHtml =
    opts.intro && opts.intro.trim()
      ? `<p style="color:#555;line-height:1.7;margin:0 0 24px;">${escapeHtml(opts.intro).replace(/\n/g, "<br>")}</p>`
      : DEFAULT_INTRO_PARAS;
  const logoHtml = opts.logoUrl
    ? `<div style="text-align:center;margin:0 0 16px;"><img src="${escapeHtml(opts.logoUrl)}" alt="" style="max-height:56px;max-width:240px;display:inline-block;" /></div>`
    : "";
  const buttonsHtml = opts.platforms.length
    ? `<div style="margin:0 0 24px;">${opts.platforms.map(platformButtonHtml).join("")}</div>`
    : `<p style="color:#aaa;font-style:italic;text-align:center;margin:0 0 24px;">(Review buttons will appear here once you add a review link)</p>`;
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#f9f9f9;margin:0;padding:20px;"><div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">${logoHtml}<h2 style="color:#111;font-size:22px;margin:0 0 16px;">${escapeHtml(heading)}</h2>${introHtml}${buttonsHtml}<p style="color:#999;font-size:12px;margin:0;">Thank you for choosing us. We look forward to serving you again!</p></div></body></html>`;
}

// Hydrate the 4 fixed platform rows from the stored jsonb, falling back to the
// legacy single review_link as an enabled Google entry when platforms is empty.
function hydratePlatforms(raw: ReviewPlatform[] | null | undefined, legacy: string | null | undefined): ReviewPlatform[] {
  const map = new Map<string, ReviewPlatform>();
  if (raw && raw.length) {
    raw.forEach((p) => map.set(p.platform, p));
  } else if (legacy && legacy.trim()) {
    map.set("google", { platform: "google", url: legacy, enabled: true });
  }
  return PLATFORM_ROWS.map((row) => map.get(row.key) ?? { platform: row.key, url: "", enabled: false });
}

function enabledPlatforms(platforms: ReviewPlatform[]): { platform: ReviewPlatformKey; url: string }[] {
  return PLATFORM_ROWS
    .map((row) => platforms.find((p) => p.platform === row.key))
    .filter((p): p is ReviewPlatform => !!p && p.enabled && p.url.trim().length > 0)
    .map((p) => ({ platform: p.platform, url: p.url.trim() }));
}

// Mirrors the template sent by the qbo-send-auth-email edge function
function buildAuthInviteEmailHtml(authUrl: string, clientName?: string) {
  const greeting = clientName ? `Hi ${clientName},` : "Hi,";
  return `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; background: #f4f6f9; margin: 0; padding: 20px;">
  <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
    <h2 style="color: #111827; font-size: 20px; margin: 0 0 16px;">Connect your QuickBooks account</h2>
    <p style="color: #4B5563; line-height: 1.7; margin: 0 0 12px;">${greeting}</p>
    <p style="color: #4B5563; line-height: 1.7; margin: 0 0 24px;">
      Please click the button below to securely connect your QuickBooks Online account. This allows us to automatically send review requests to your customers when an invoice is marked as paid.
    </p>
    <div style="text-align: center; margin: 0 0 24px;">
      <a href="${authUrl}" style="display: inline-block; background: #2CA01C; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: bold;">
        Connect QuickBooks
      </a>
    </div>
    <p style="color: #6B7280; font-size: 12px; line-height: 1.6; margin: 0;">
      This link is unique to your account. If you did not expect this email, you can safely ignore it.
    </p>
  </div>
</body>
</html>`;
}

export function QuickBooksPanel({ clientId, clientEmail }: { clientId: string; clientEmail?: string | null }) {
  const { connection, loading, reload } = useQboConnection(clientId);
  const { requests, loading: loadingRequests, reload: reloadRequests } = useReviewRequests(clientId);
  const { attempts, loading: loadingAttempts, reload: reloadAttempts } = useQboConnectionAttempts(clientId);
  const { assets, reload: reloadBrand } = useClientBrandAssets(clientId);
  const { toast } = useToast();

  const [busy, setBusy] = useState(false);
  const [fromName, setFromName] = useState("");
  const [reviewDelayDays, setReviewDelayDays] = useState("7");
  const [platforms, setPlatforms] = useState<ReviewPlatform[]>([]);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailIntro, setEmailIntro] = useState("");
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  // Share link state
  const [authUrl, setAuthUrl] = useState<string | null>(null);
  const [emailTo, setEmailTo] = useState(clientEmail || "");
  const [sending, setSending] = useState(false);
  const [showAuthPreview, setShowAuthPreview] = useState(false);

  useEffect(() => {
    setFromName(connection?.from_name || "");
    setReviewDelayDays(String(connection?.review_delay_days ?? 7));
    setEmailSubject(connection?.email_subject || "");
    setEmailIntro(connection?.email_intro || "");
    setPlatforms(hydratePlatforms(connection?.review_platforms, connection?.review_link));
  }, [connection?.from_name, connection?.review_delay_days, connection?.review_platforms, connection?.review_link, connection?.email_subject, connection?.email_intro, connection]);

  const generateLink = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qbo-auth-url", {
        body: { crmClientId: clientId, frontendOrigin: window.location.origin },
      });
      if (error || !data?.url) {
        toast({ title: "Failed to get QuickBooks auth URL", description: error?.message, variant: "destructive" });
        return;
      }
      setAuthUrl(data.url);
    } catch (e) {
      toast({ title: "Unexpected error", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = () => {
    if (!authUrl) return;
    navigator.clipboard.writeText(authUrl);
    toast({ title: "Link copied to clipboard" });
  };

  const sendEmail = async () => {
    if (!authUrl || !emailTo) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("qbo-send-auth-email", {
        body: { recipientEmail: emailTo.trim(), authUrl },
      });
      if (error) throw new Error(error.message);
      toast({ title: "Email sent!", description: `Authorization link sent to ${emailTo}` });
    } catch (e) {
      toast({ title: "Failed to send email", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect QuickBooks? Review request emails will stop being sent.")) return;
    setBusy(true);
    try {
      await db.from("quickbooks_connections").delete().eq("crm_client_id", clientId);
      await reload();
      toast({ title: "QuickBooks disconnected" });
    } catch (e) {
      toast({ title: "Disconnect failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const togglePlatform = (key: ReviewPlatformKey) =>
    setPlatforms((prev) => prev.map((p) => (p.platform === key ? { ...p, enabled: !p.enabled } : p)));

  const setPlatformUrl = (key: ReviewPlatformKey, url: string) =>
    setPlatforms((prev) => prev.map((p) => (p.platform === key ? { ...p, url } : p)));

  const saveSettings = async () => {
    setSaving(true);
    try {
      const delayNum = Math.min(60, Math.max(1, parseInt(reviewDelayDays, 10) || 7));
      await db.from("quickbooks_connections")
        .update({
          from_name: fromName.trim() || null,
          review_delay_days: delayNum,
          review_platforms: platforms,
          email_subject: emailSubject.trim() || null,
          email_intro: emailIntro.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("crm_client_id", clientId);
      await reload();
      toast({ title: "Settings saved" });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading QuickBooks status…</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connection card */}
      <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">
              QuickBooks Online
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Automatically send review requests when an invoice is marked paid.
            </p>
          </div>
          {connection ? (
            connection.status === "expired" ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/20">
                <AlertCircle className="w-3.5 h-3.5" /> Expired
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
                <CheckCircle2 className="w-3.5 h-3.5" /> Connected
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
              Not Connected
            </span>
          )}
        </div>

        {connection && connection.status !== "expired" && connection.last_error && (
          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3 mb-4">
            <p className="text-xs font-bold text-amber-500 mb-1 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Last sync failed
            </p>
            <p className="text-xs text-amber-500/80">
              {connection.last_error}
            </p>
            <p className="text-[11px] text-amber-500/60 mt-1">
              {connection.last_invoice_sync_at
                ? `Invoices were last synced successfully on ${fmtDateTime(connection.last_invoice_sync_at)}. Every attempt since then has failed — review requests are not being sent.`
                : "No sync has ever succeeded for this connection — review requests have never been sent."}
            </p>
          </div>
        )}

        {connection?.status === "expired" && (
          <div className="rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-3 mb-4 space-y-3">
            <div>
              <p className="text-xs font-bold text-red-400 mb-1">Connection expired</p>
              <p className="text-xs text-red-400/70">
                {connection.last_error || "The QuickBooks authorization has expired or was revoked."} Generate a new connection link and send it to the client to restore review requests.
              </p>
            </div>

            {!authUrl ? (
              <button
                disabled={busy}
                onClick={generateLink}
                className="bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
                {busy ? "Generating…" : "Generate New Connection Link"}
              </button>
            ) : (
              <div className="rounded-lg border border-red-500/30 bg-background p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Share New Connection Link</p>
                  <button
                    onClick={() => setAuthUrl(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-muted/40 border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                    {authUrl.slice(0, 60)}…
                  </div>
                  <button
                    onClick={copyLink}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-background border border-border text-foreground hover:border-red-400 hover:text-red-400 transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="client@example.com"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-red-400"
                  />
                  <button
                    disabled={sending || !emailTo.trim()}
                    onClick={sendEmail}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white transition-colors"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {connection ? (
          <div className="space-y-4">
            {/* Company info */}
            <div className="rounded-xl bg-muted/40 dark:bg-white/3 border border-border dark:border-white/8 px-4 py-3 flex flex-wrap items-center gap-6">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Company ID (Realm)</p>
                <p className="text-sm font-mono text-foreground dark:text-[#EEF1FA]">{connection.realm_id}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Connected</p>
                <p className="text-sm text-foreground dark:text-[#EEF1FA]">{fmtDate(connection.created_at)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Token Expires</p>
                <p className="text-sm text-foreground dark:text-[#EEF1FA]">{fmtDate(connection.token_expiry)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-0.5">Last Synced</p>
                <p className={`text-sm ${connection.last_invoice_sync_at ? "text-foreground dark:text-[#EEF1FA]" : "text-amber-500"}`}>
                  {connection.last_invoice_sync_at ? fmtDateTime(connection.last_invoice_sync_at) : "Never"}
                </p>
              </div>
            </div>

            {/* Settings fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Sender name */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Sender Name
                </label>
                <input
                  type="text"
                  value={fromName}
                  onChange={(e) => setFromName(e.target.value)}
                  placeholder="e.g. Acme Plumbing Reviews"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Appears as the "From" name in the email. Defaults to "CityWide Reviews".
                </p>
              </div>

              {/* Delay in days */}
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Delay (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={reviewDelayDays}
                  onChange={(e) => setReviewDelayDays(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Send a review request this many days after an invoice is paid (1–60).
                </p>
              </div>
            </div>

            {/* Review platforms */}
            <div className="rounded-xl bg-muted/30 dark:bg-white/3 border border-border dark:border-white/8 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Review Platforms</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {PLATFORM_ROWS.map((row) => {
                  const p = platforms.find((x) => x.platform === row.key) ?? { platform: row.key, url: "", enabled: false };
                  const Icon = row.icon;
                  return (
                    <div key={row.key} className="rounded-lg border border-border dark:border-white/10 bg-background p-2.5 space-y-2">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={p.enabled}
                          onClick={() => togglePlatform(row.key)}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${p.enabled ? "bg-[#0078D7]" : "bg-muted"}`}
                          title={p.enabled ? "Disable" : "Enable"}
                        >
                          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${p.enabled ? "translate-x-4" : ""}`} />
                        </button>
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground dark:text-[#EEF1FA]">{row.label}</span>
                      </div>
                      <input
                        type="url"
                        value={p.url}
                        onChange={(e) => setPlatformUrl(row.key, e.target.value)}
                        placeholder={row.placeholder}
                        disabled={!p.enabled}
                        className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7] disabled:opacity-50"
                      />
                    </div>
                  );
                })}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Each enabled platform with a URL becomes a button in the review email.
              </p>
            </div>

            {/* Email subject + intro */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Email Subject
                </label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder={DEFAULT_SUBJECT}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  Overrides the email subject line and the heading shown above the intro.
                </p>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                  Email Intro
                </label>
                <textarea
                  value={emailIntro}
                  onChange={(e) => setEmailIntro(e.target.value)}
                  rows={3}
                  placeholder="We truly appreciate your business. Your experience matters to us, and we'd love to hear your feedback."
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7] resize-none"
                />
                <p className="text-[11px] text-muted-foreground mt-1">
                  The paragraph above the review buttons. Leave blank to use the default copy.
                </p>
              </div>
            </div>

            {/* Brand assets */}
            <div className="rounded-xl bg-muted/30 dark:bg-white/3 border border-border dark:border-white/8 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Brand Assets & Logo</p>
              <BrandAssetsUploader clientId={clientId} assets={assets} onSaved={reloadBrand} />
              <p className="text-[11px] text-muted-foreground mt-2">
                The rectangle-light logo appears at the top of every review email when set.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setShowPreview((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border transition-colors"
              >
                {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {showPreview ? "Hide Email Preview" : "Preview Review Email"}
              </button>
              <button
                disabled={saving}
                onClick={saveSettings}
                className="bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                {saving ? "Saving…" : "Save Settings"}
              </button>
            </div>

            {/* Email preview */}
            {showPreview && (
              <div className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    <span className="font-bold">From:</span> {fromName || "CityWide Reviews"} &lt;reviews@citywidedigital.ca&gt; &nbsp;
                    <span className="font-bold">Subject:</span> {emailSubject.trim() || DEFAULT_SUBJECT}
                  </span>
                  <span className="ml-auto text-[10px] text-muted-foreground italic">Preview — uses sample customer name</span>
                </div>
                <iframe
                  srcDoc={buildReviewEmailHtml({
                    customerName: "John Smith",
                    platforms: enabledPlatforms(platforms),
                    logoUrl: assets?.logo_rect_url || null,
                    subject: emailSubject,
                    intro: emailIntro,
                  })}
                  className="w-full border-0"
                  style={{ height: "460px" }}
                  title="Review email preview"
                  sandbox="allow-same-origin"
                />
              </div>
            )}

            {/* Sync info */}
            <div className="rounded-xl bg-[#0078D7]/5 border border-[#0078D7]/20 px-4 py-3 flex items-start gap-2.5">
              <Clock className="w-4 h-4 text-[#0078D7] shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-[#0078D7] mb-1">Daily automatic sync</p>
                <p className="text-xs text-[#0078D7]/70">
                  Once a day, we check QuickBooks for invoices that were marked paid and automatically send a review request {reviewDelayDays || "7"} days later. No setup needed in QuickBooks — connecting the account above is all that's required.
                </p>
              </div>
            </div>

            {/* Disconnect */}
            <div className="flex justify-end">
              <button
                disabled={busy}
                onClick={disconnect}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20 transition-colors disabled:opacity-50"
              >
                <Unlink className="w-3.5 h-3.5" />
                Disconnect QuickBooks
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-start gap-3">
            <div className="rounded-xl bg-muted/30 border border-border dark:border-white/8 px-4 py-3 text-xs text-muted-foreground space-y-1.5 w-full">
              <p className="font-bold text-foreground dark:text-[#EEF1FA] text-sm mb-2">How it works</p>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2CA01C]/15 text-[#2CA01C] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Click <strong>Generate Connection Link</strong> — a secure authorization link is created. Copy it or email it directly to your client so <em>they</em> can log in and approve access on their own device. You never need their credentials.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2CA01C]/15 text-[#2CA01C] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Enter the client's review links (Google, Facebook, BBB, Yelp) and optionally a sender name.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2CA01C]/15 text-[#2CA01C] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>Once a day, paid invoices are checked automatically and the customer is emailed a review request after the configured delay.</span>
              </div>
            </div>

            {!authUrl ? (
              <button
                disabled={busy}
                onClick={generateLink}
                className="bg-[#2CA01C] hover:bg-[#238a15] disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg inline-flex items-center gap-2 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {busy ? "Generating…" : "Generate Connection Link"}
              </button>
            ) : (
              <div className="w-full rounded-xl border border-[#2CA01C]/30 bg-[#2CA01C]/5 p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-bold text-[#2CA01C] uppercase tracking-wider">Share Connection Link</p>
                  <button
                    onClick={() => setAuthUrl(null)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Copy row */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                    {authUrl.slice(0, 60)}…
                  </div>
                  <button
                    onClick={copyLink}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-background border border-border text-foreground hover:border-[#2CA01C] hover:text-[#2CA01C] transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copy
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">or send via email</span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Email row */}
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    placeholder="client@example.com"
                    className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#2CA01C]"
                  />
                  <button
                    disabled={sending || !emailTo.trim()}
                    onClick={sendEmail}
                    className="shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold bg-[#2CA01C] hover:bg-[#238a15] disabled:opacity-50 text-white transition-colors"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {sending ? "Sending…" : "Send"}
                  </button>
                </div>

                <button
                  onClick={() => setShowAuthPreview((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2CA01C] hover:text-[#238a15] transition-colors"
                >
                  {showAuthPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {showAuthPreview ? "Hide Email Preview" : "Preview This Email"}
                </button>

                {showAuthPreview && (
                  <div className="rounded-xl border border-border overflow-hidden">
                    <div className="bg-muted/40 border-b border-border px-4 py-2 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        <span className="font-bold">To:</span> {emailTo || "client@example.com"} &nbsp;
                        <span className="font-bold">Subject:</span> Action required: Connect your QuickBooks account
                      </span>
                    </div>
                    <iframe
                      srcDoc={buildAuthInviteEmailHtml(authUrl)}
                      className="w-full border-0"
                      style={{ height: "360px" }}
                      title="QuickBooks invite email preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connection attempt diagnostics — helps answer "client says they clicked authorize but nothing happened" */}
      {attempts.length > 0 && (
        <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
          <button
            onClick={() => setShowDiagnostics((v) => !v)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">
                Connection Attempts
              </h3>
              <span className="text-xs text-muted-foreground">({attempts.length})</span>
            </div>
            {showDiagnostics ? <EyeOff className="w-3.5 h-3.5 text-muted-foreground" /> : <Eye className="w-3.5 h-3.5 text-muted-foreground" />}
          </button>
          <p className="text-xs text-muted-foreground mt-0.5">
            A log of every step the client's browser went through while authorizing. Useful when a client says they clicked "Authorize" but the connection didn't complete.
          </p>

          {showDiagnostics && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-end">
                <button
                  onClick={() => reloadAttempts()}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-[#0078D7] hover:bg-[#0078D7]/10 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAttempts ? "animate-spin" : ""}`} />
                </button>
              </div>
              {attempts.map((a) => {
                const info = STAGE_LABELS[a.stage] || { label: a.stage, tone: "info" as const };
                return (
                  <div
                    key={a.id}
                    className={`rounded-lg border px-3 py-2 flex items-start gap-2 ${
                      info.tone === "error"
                        ? "border-red-500/20 bg-red-500/5"
                        : info.tone === "ok"
                        ? "border-[#22C55E]/20 bg-[#22C55E]/5"
                        : "border-border bg-muted/20"
                    }`}
                  >
                    {info.tone === "error" ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    ) : info.tone === "ok" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#22C55E] shrink-0 mt-0.5" />
                    ) : (
                      <Activity className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className={`text-xs font-bold ${
                          info.tone === "error" ? "text-red-400" : info.tone === "ok" ? "text-[#22C55E]" : "text-foreground dark:text-[#EEF1FA]"
                        }`}>
                          {info.label}
                        </p>
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">{fmtDateTime(a.created_at)}</span>
                      </div>
                      {a.message && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 break-all">{a.message}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Review requests log */}
      {connection && (
        <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">
                Review Requests Sent
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {requests.length} email{requests.length !== 1 ? "s" : ""} sent
              </p>
            </div>
            <button
              onClick={() => reloadRequests()}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-[#0078D7] hover:bg-[#0078D7]/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingRequests ? "animate-spin" : ""}`} />
            </button>
          </div>

          {loadingRequests ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : requests.length === 0 ? (
            <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
              <Star className="w-8 h-8 opacity-20" />
              <p className="text-sm">No review requests sent yet.</p>
              <p className="text-xs opacity-70">They'll appear here when a QBO invoice is marked paid.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border dark:border-white/8">
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 pr-4">Date</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 pr-4">Customer</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 pr-4">Email</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2 pr-4">Invoice #</th>
                    <th className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground pb-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-white/5">
                  {requests.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(r.sent_at)}</td>
                      <td className="py-2.5 pr-4 text-xs text-foreground dark:text-[#EEF1FA] font-medium">{r.customer_name || "—"}</td>
                      <td className="py-2.5 pr-4">
                        <a href={`mailto:${r.customer_email}`} className="text-xs text-[#0078D7] hover:underline inline-flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {r.customer_email}
                        </a>
                      </td>
                      <td className="py-2.5 pr-4 text-xs font-mono text-muted-foreground">{r.qbo_invoice_id}</td>
                      <td className="py-2.5">
                        {r.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Sent
                          </span>
                        ) : (
                          <span
                            title={r.error_message || undefined}
                            className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 cursor-help"
                          >
                            <AlertCircle className="w-2.5 h-2.5" /> Failed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
