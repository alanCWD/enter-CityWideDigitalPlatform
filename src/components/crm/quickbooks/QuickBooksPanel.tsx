import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQboConnection, useReviewRequests } from "@/hooks/useQuickbooks";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Link2, CheckCircle2, Unlink, Save, RefreshCw,
  Mail, AlertCircle, ExternalLink, Star,
} from "lucide-react";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

export function QuickBooksPanel({ clientId }: { clientId: string }) {
  const { connection, loading, reload } = useQboConnection(clientId);
  const { requests, loading: loadingRequests, reload: reloadRequests } = useReviewRequests(clientId);
  const { toast } = useToast();

  const [busy, setBusy] = useState(false);
  const [reviewLink, setReviewLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);

  // Sync reviewLink state when connection loads
  useEffect(() => {
    setReviewLink(connection?.review_link || "");
  }, [connection?.review_link]);

  const connect = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("qbo-auth-url", {
        body: { crmClientId: clientId, frontendOrigin: window.location.origin },
      });
      if (error || !data?.url) {
        toast({ title: "Failed to get QuickBooks auth URL", description: error?.message, variant: "destructive" });
        return;
      }
      window.location.href = data.url;
    } catch (e) {
      toast({ title: "Unexpected error", description: (e as Error).message, variant: "destructive" });
      setBusy(false);
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

  const saveReviewLink = async () => {
    setSavingLink(true);
    try {
      await db.from("quickbooks_connections")
        .update({ review_link: reviewLink.trim() || null, updated_at: new Date().toISOString() })
        .eq("crm_client_id", clientId);
      await reload();
      toast({ title: "Review link saved" });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setSavingLink(false);
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
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground border border-border">
              Not Connected
            </span>
          )}
        </div>

        {connection ? (
          <div className="space-y-4">
            {/* Company info */}
            <div className="rounded-xl bg-muted/40 dark:bg-white/3 border border-border dark:border-white/8 px-4 py-3 flex flex-wrap items-center gap-4">
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
            </div>

            {/* Review link editor */}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1.5">
                Google Review Link
              </label>
              <p className="text-xs text-muted-foreground mb-2">
                Paste the GBP short review URL (e.g. <code className="font-mono bg-muted px-1 rounded">https://g.page/r/XXXX/review</code>). This link is included in every review request email.
              </p>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={reviewLink}
                  onChange={(e) => setReviewLink(e.target.value)}
                  placeholder="https://g.page/r/XXXX/review"
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
                />
                {reviewLink && (
                  <a
                    href={reviewLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-muted-foreground hover:text-[#0078D7] transition-colors"
                    title="Open link"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                )}
                <button
                  disabled={savingLink}
                  onClick={saveReviewLink}
                  className="bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingLink ? "Saving…" : "Save"}
                </button>
              </div>
            </div>

            {/* Webhook URL info */}
            <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 px-4 py-3">
              <p className="text-xs font-bold text-amber-600 dark:text-amber-400 mb-1">Webhook URL</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mb-2">
                Register this URL in your Intuit Developer app under <strong>Webhooks</strong>. Select the <strong>Invoice</strong> entity.
              </p>
              <code className="text-[11px] font-mono bg-background border border-border rounded px-2 py-1 block break-all text-foreground">
                {`${window.location.origin.replace(window.location.origin, "https://<project>.supabase.co")}/functions/v1/qbo-webhook`}
              </code>
              <p className="text-[10px] text-muted-foreground mt-1">
                (Replace with your actual Supabase project URL from the dashboard)
              </p>
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
            <div className="rounded-xl bg-muted/30 border border-border dark:border-white/8 px-4 py-3 text-xs text-muted-foreground space-y-1 w-full">
              <p className="font-bold text-foreground dark:text-[#EEF1FA] text-sm mb-2">How it works</p>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2CA01C]/15 text-[#2CA01C] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                <span>Click <strong>Connect QuickBooks</strong> and sign in with the client's QuickBooks Online account.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2CA01C]/15 text-[#2CA01C] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                <span>Enter the client's Google review link so it appears in the email button.</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-5 h-5 rounded-full bg-[#2CA01C]/15 text-[#2CA01C] flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                <span>When an invoice is marked paid in QBO, the customer is automatically emailed a review request.</span>
              </div>
            </div>
            <button
              disabled={busy}
              onClick={connect}
              className="bg-[#2CA01C] hover:bg-[#238a15] disabled:opacity-50 text-white text-sm font-bold px-5 py-2.5 rounded-lg inline-flex items-center gap-2 transition-colors"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
              {busy ? "Redirecting…" : "Connect QuickBooks"}
            </button>
          </div>
        )}
      </div>

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
                    <tr key={r.id} className="group">
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
