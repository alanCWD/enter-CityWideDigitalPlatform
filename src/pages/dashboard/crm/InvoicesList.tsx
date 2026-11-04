import { useEffect, useState, useCallback, useRef } from "react";
import { ExternalLink, FileText, Search, RefreshCw, CheckCircle, CloudLightning, Pencil, Send, Undo2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { crm, fmtMoney, type CrmInvoice } from "@/lib/crm";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { EditPaymentDialog, MarkPaidDialog } from "@/components/crm/InvoicePaymentDialog";
import { PAYMENT_METHODS } from "@/lib/paymentMethods";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Open", value: "open" },
  { label: "Paid", value: "paid" },
  { label: "Draft", value: "draft" },
  { label: "Past Due", value: "past_due" },
];

const STATUS_STYLES: Record<string, string> = {
  paid:     "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/20",
  open:     "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/20",
  draft:    "bg-muted text-muted-foreground border-border",
  past_due: "bg-destructive/15 text-destructive border-destructive/20",
  void:     "bg-muted text-muted-foreground border-border",
};

const STRIPE_STATUS_STYLES: Record<string, string> = {
  paid:     "text-green-600 dark:text-green-400",
  open:     "text-blue-500",
  void:     "text-muted-foreground",
  draft:    "text-muted-foreground",
  uncollectible: "text-destructive",
};

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

// ── Close Stripe Invoice dialog (for invoices not yet linked to Stripe) ──────

interface CloseStripeDialogProps {
  invoice: CrmInvoice | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CloseStripeDialog({ invoice, onClose, onSuccess }: CloseStripeDialogProps) {
  const [stripeNumber, setStripeNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const invoiceId = invoice?.id;
  useEffect(() => {
    if (invoiceId) { setStripeNumber(""); setError(null); }
  }, [invoiceId]);

  const handleSubmit = async () => {
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      await crm("invoices.closeStripeByInvoiceNumber", { id: invoice.id, stripe_number: stripeNumber.trim() });
      onSuccess();
    } catch (e) {
      setError((e as Error).message ?? "Failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onOpenAutoFocus={() => { setTimeout(() => inputRef.current?.focus(), 50); }}
      >
        <DialogHeader>
          <DialogTitle>Close Invoice in Stripe</DialogTitle>
        </DialogHeader>
        {invoice && (
          <div className="space-y-4 py-1">
            <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">CRM Invoice</span>
                <span className="text-sm font-mono font-semibold">{invoice.number ?? "—"}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Client</span>
                <span className="text-sm">{invoice.client_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-muted-foreground">Amount</span>
                <span className="text-sm font-bold">{fmtMoney(invoice.total_cents, invoice.currency)}</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Enter the Stripe invoice number exactly as shown in your Stripe dashboard (e.g. <span className="font-mono text-foreground">D2QNY51Q-0001</span>). This will mark it as paid without charging the client.
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="stripe-inv-number">Stripe Invoice Number</Label>
              <Input
                ref={inputRef}
                id="stripe-inv-number"
                value={stripeNumber}
                onChange={(e) => setStripeNumber(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && stripeNumber.trim()) handleSubmit(); }}
                placeholder="D2QNY51Q-0001"
                className="font-mono"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving || !stripeNumber.trim()} className="gap-2">
            <CloudLightning className="w-4 h-4" />
            {saving ? "Finding & Closing…" : "Find & Close in Stripe"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Send the real Stripe invoice ─────────────────────────────────────────────
// Emails the official Stripe invoice, never a dashboard copy. When the CRM row
// has no Stripe invoice yet (a draft, or a row that never synced), this creates
// it in Stripe from the stored line items, finalizes it, then emails it.

function SendInvoiceButton({ invoice, onRefresh }: { invoice: CrmInvoice; onRefresh: () => void }) {
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { toast } = useToast();
  const linked = !!invoice.stripe_invoice_id;

  const handleSend = async () => {
    setSending(true);
    setErr(null);
    try {
      if (linked) {
        await crm("invoices.resend", { id: invoice.id });
        toast({
          title: "Stripe invoice sent",
          description: `${invoice.number ?? "Invoice"} was emailed from Stripe to ${invoice.client_name ?? "the client"}.`,
        });
      } else {
        await crm("invoices.send", { id: invoice.id });
        toast({
          title: "Invoice created in Stripe and sent",
          description: `${invoice.number ?? "Invoice"} now exists as a real Stripe invoice and was emailed to ${invoice.client_name ?? "the client"}.`,
        });
      }
      onRefresh();
    } catch (e) {
      const msg = (e as Error).message ?? "Send failed";
      setErr(msg);
      toast({ title: "Could not send invoice", description: msg, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleSend}
        disabled={sending}
        title={linked
          ? "Email the actual Stripe invoice to the client again"
          : "Create this invoice in Stripe and email the actual Stripe invoice to the client"}
        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 whitespace-nowrap"
      >
        <Send className={`w-3.5 h-3.5 ${sending ? "animate-pulse" : ""}`} />
        {sending ? "Sending…" : linked ? "Resend" : "Send"}
      </button>
      {err && (
        <span className="text-[9px] text-destructive leading-none text-center max-w-[90px] mt-1" title={err}>
          {err.slice(0, 60)}
        </span>
      )}
    </div>
  );
}

// ── Stripe actions cell (for invoices already linked to a Stripe invoice ID) ─

interface StripeActionsCellProps {
  invoice: CrmInvoice;
  onRefresh: () => void;
}

function StripeActionsCell({ invoice, onRefresh }: StripeActionsCellProps) {
  const [syncing, setSyncing] = useState(false);
  const [stripeStatus, setStripeStatus] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeOk, setCloseOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!invoice.stripe_invoice_id) return null;

  const handleSync = async () => {
    setSyncing(true);
    setErr(null);
    try {
      const data = await crm<{ stripe_status: string }>("invoices.checkStripe", { id: invoice.id });
      setStripeStatus(data.stripe_status);
      onRefresh();
    } catch (e) {
      setErr((e as Error).message ?? "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleCloseInStripe = async () => {
    setClosing(true);
    setErr(null);
    try {
      await crm("invoices.markStripePaid", { id: invoice.id });
      setStripeStatus("paid");
      setCloseOk(true);
      onRefresh();
    } catch (e) {
      setErr((e as Error).message ?? "Failed");
    } finally {
      setClosing(false);
    }
  };

  const statusColor = stripeStatus
    ? stripeStatus === "paid" ? "text-green-500" : stripeStatus === "open" ? "text-blue-500" : "text-muted-foreground"
    : "text-muted-foreground";

  // Show "close in Stripe" when CRM is paid but Stripe still shows open
  const needsStripeClose = invoice.status === "paid" && stripeStatus === "open" && !closeOk;

  return (
    <div className="flex flex-col items-center gap-1 min-w-[60px]">
      {/* Sync row */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleSync}
          disabled={syncing || closing}
          title="Check live payment status in Stripe"
          className={`p-1 rounded hover:bg-muted transition-colors disabled:opacity-40 ${statusColor}`}
        >
          <CloudLightning className={`w-3.5 h-3.5 ${syncing ? "animate-pulse" : ""}`} />
        </button>
        {stripeStatus && (
          <span className={`text-[10px] font-semibold ${statusColor}`}>
            {stripeStatus === "paid" ? "Stripe paid" : stripeStatus === "open" ? "Stripe open" : `Stripe ${stripeStatus}`}
          </span>
        )}
      </div>

      {/* Close in Stripe — only shown when CRM paid but Stripe open */}
      {needsStripeClose && (
        <button
          onClick={handleCloseInStripe}
          disabled={closing}
          title="Mark this invoice as paid in Stripe (out-of-band — no charge to client)"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors disabled:opacity-50 whitespace-nowrap"
        >
          <CheckCircle className={`w-3 h-3 ${closing ? "animate-pulse" : ""}`} />
          {closing ? "Closing…" : "Close in Stripe"}
        </button>
      )}

      {/* Initial prompt to sync (before any sync has happened) for paid CRM invoices */}
      {!stripeStatus && invoice.status === "paid" && (
        <span className="text-[9px] text-muted-foreground/60 text-center leading-tight">
          Check Stripe status
        </span>
      )}

      {err && (
        <span className="text-[9px] text-destructive leading-none text-center max-w-[70px]" title={err}>
          {err.slice(0, 40)}
        </span>
      )}
    </div>
  );
}

// ── Main list ────────────────────────────────────────────────────────────────

export function InvoicesList() {
  const [invoices, setInvoices] = useState<CrmInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [markPaidTarget, setMarkPaidTarget] = useState<CrmInvoice | null>(null);
  const [closeStripeTarget, setCloseStripeTarget] = useState<CrmInvoice | null>(null);
  const [editPayTarget, setEditPayTarget] = useState<CrmInvoice | null>(null);
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const { toast } = useToast();

  const undoPaid = async (inv: CrmInvoice) => {
    const stripeNote = inv.stripe_invoice_id
      ? " This only changes CityWide — the Stripe invoice will still show as paid."
      : "";
    if (!confirm(`Undo the payment on ${inv.number ?? "this invoice"}? It will return to open and its manual payment record will be removed.${stripeNote}`)) return;
    setUndoingId(inv.id);
    try {
      await crm("invoices.markUnpaid", { id: inv.id });
      await load();
      toast({ title: "Payment undone", description: `${inv.number ?? "Invoice"} is open again.` });
    } catch (e) {
      toast({
        title: "Could not undo payment",
        description: (e as Error).message ?? "Try again.",
        variant: "destructive",
      });
    } finally {
      setUndoingId(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload: Record<string, unknown> = {};
      if (statusFilter) payload.status = statusFilter;
      const res = await crm<{ invoices: CrmInvoice[] }>("invoices.list", payload);
      setInvoices(res.invoices ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const filtered = q.trim()
    ? invoices.filter((inv) =>
        inv.number?.toLowerCase().includes(q.toLowerCase()) ||
        inv.client_name?.toLowerCase().includes(q.toLowerCase())
      )
    : invoices;

  const totalOutstanding = filtered
    .filter((i) => i.status === "open" || i.status === "past_due")
    .reduce((s, i) => s + (i.total_cents - i.amount_paid_cents), 0);

  const totalPaid = filtered
    .filter((i) => i.status === "paid")
    .reduce((s, i) => s + i.amount_paid_cents, 0);

  return (
    <DashboardLayout>
      <TopBar
        title="Invoices"
        subtitle={loading ? "Loading…" : `${filtered.length} invoice${filtered.length !== 1 ? "s" : ""}`}
      />

      <div className="px-6 py-6 space-y-5">
        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Total Invoices</p>
            <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Outstanding</p>
            <p className="text-2xl font-bold text-blue-500">{fmtMoney(totalOutstanding)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Collected</p>
            <p className="text-2xl font-bold text-green-500">{fmtMoney(totalPaid)}</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4">
            <p className="text-xs text-muted-foreground font-medium mb-1">Past Due</p>
            <p className="text-2xl font-bold text-destructive">
              {filtered.filter((i) => i.status === "past_due").length}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by invoice # or client…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
          </div>

          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setStatusFilter(f.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === f.value
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading invoices…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <FileText className="w-10 h-10 opacity-30" />
              <p className="text-sm">No invoices found</p>
              <p className="text-xs opacity-60">
                Invoices will appear here once subscriptions are created with "Send Invoice" billing
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Invoice #</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Amount</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Issued</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Due</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Paid</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-foreground font-semibold">
                        {inv.number ?? <span className="text-muted-foreground italic">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {inv.client_id ? (
                          <Link
                            to={`/dashboard/crm/clients/${inv.client_id}`}
                            className="text-primary hover:underline font-medium"
                          >
                            {inv.client_name ?? inv.client_id}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border w-fit ${STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft}`}>
                            {inv.status.replace("_", " ")}
                          </span>
                          {inv.status === "paid" && inv.payment_method && (
                            <span className="text-[10px] text-muted-foreground">
                              via {PAYMENT_METHODS.find((m) => m.value === inv.payment_method)?.label ?? inv.payment_method}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                        {fmtMoney(inv.total_cents, inv.currency)}
                        {inv.amount_paid_cents > 0 && inv.amount_paid_cents < inv.total_cents && (
                          <div className="text-[10px] text-muted-foreground">{fmtMoney(inv.amount_paid_cents)} paid</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(inv.issued_at)}</td>
                      <td className={`px-4 py-3 text-xs ${
                        inv.due_date && (inv.status === "open" || inv.status === "past_due") && new Date(inv.due_date) < new Date()
                          ? "text-destructive font-medium"
                          : "text-muted-foreground"
                      }`}>
                        {fmt(inv.due_date)}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-muted-foreground">{fmt(inv.paid_at)}</div>
                        {inv.payment_notes && (
                          <div
                            className="text-[10px] text-muted-foreground/60 max-w-[140px] truncate mt-0.5"
                            title={inv.payment_notes}
                          >
                            {inv.payment_notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {/* Send the actual Stripe invoice. Drafts and unsynced rows get
                              created in Stripe first, so "Send" always emails the real one. */}
                          {(inv.status === "draft" || inv.status === "open" || inv.status === "past_due") && (
                            <SendInvoiceButton invoice={inv} onRefresh={load} />
                          )}

                          {/* Mark as Paid — only for open / past_due */}
                          {(inv.status === "open" || inv.status === "past_due") && (
                            <button
                              onClick={() => setMarkPaidTarget(inv)}
                              title="Record a manual payment (e.g. e-transfer, cash) for this invoice"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border transition-colors whitespace-nowrap"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Mark Paid
                            </button>
                          )}

                          {/* Close in Stripe — for paid invoices NOT yet linked to Stripe */}
                          {inv.status === "paid" && !inv.stripe_invoice_id && (
                            <button
                              onClick={() => setCloseStripeTarget(inv)}
                              title="Find this invoice in Stripe and mark it paid (out-of-band)"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-violet-500/10 text-violet-600 dark:text-violet-400 hover:bg-violet-500/20 border border-violet-500/20 transition-colors whitespace-nowrap"
                            >
                              <CloudLightning className="w-3.5 h-3.5" />
                              Close in Stripe
                            </button>
                          )}

                          {/* Undo an accidental mark-as-paid (paid → open) */}
                          {inv.status === "paid" && (
                            <button
                              onClick={() => undoPaid(inv)}
                              disabled={undoingId === inv.id}
                              title="Undo paid — return this invoice to open and remove the manual payment record"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors whitespace-nowrap disabled:opacity-50"
                            >
                              <Undo2 className="w-3.5 h-3.5" />
                              {undoingId === inv.id ? "Undoing…" : "Undo Paid"}
                            </button>
                          )}

                          {/* Edit payment details — for all paid invoices */}
                          {inv.status === "paid" && (
                            <button
                              onClick={() => setEditPayTarget(inv)}
                              title="Add or edit the payment method and reference notes"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border transition-colors whitespace-nowrap"
                            >
                              <Pencil className="w-3 h-3" />
                              Details
                            </button>
                          )}

                          {/* Stripe sync cell — only if already linked to Stripe */}
                          {inv.stripe_invoice_id && (
                            <StripeActionsCell invoice={inv} onRefresh={load} />
                          )}

                          {/* Invoice / PDF links — labeled so the real Stripe invoice is findable */}
                          {inv.hosted_invoice_url && (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Open the actual Stripe invoice"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border transition-colors whitespace-nowrap"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              Stripe
                            </a>
                          )}
                          {inv.pdf_url && (
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download the Stripe invoice PDF"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/70 hover:text-foreground border border-border transition-colors whitespace-nowrap"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              PDF
                            </a>
                          )}
                          {inv.status !== "open" && inv.status !== "past_due" && inv.status !== "paid" && !inv.hosted_invoice_url && !inv.pdf_url && (
                            <span className="text-muted-foreground/40 text-xs">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Legend */}
        <p className="text-xs text-muted-foreground/60 flex items-center gap-1">
          <CloudLightning className="w-3 h-3" />
          <strong className="font-semibold">Send</strong> emails the client the actual Stripe invoice (creating it in Stripe first if this row has no Stripe invoice yet). <strong className="font-semibold">Stripe</strong> / <strong className="font-semibold">PDF</strong> open that same Stripe invoice. Paid invoices: <strong className="font-semibold">Undo Paid</strong> returns an invoice to open, <strong className="font-semibold">Details</strong> records the method and reference, and <strong className="font-semibold">Close in Stripe</strong> syncs the paid status.
        </p>
      </div>

      {/* Dialogs */}
      <MarkPaidDialog
        invoice={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onSuccess={() => { setMarkPaidTarget(null); load(); }}
      />
      <CloseStripeDialog
        invoice={closeStripeTarget}
        onClose={() => setCloseStripeTarget(null)}
        onSuccess={() => { setCloseStripeTarget(null); load(); }}
      />
      <EditPaymentDialog
        invoice={editPayTarget}
        onClose={() => setEditPayTarget(null)}
        onSuccess={() => { setEditPayTarget(null); load(); }}
      />
    </DashboardLayout>
  );
}
