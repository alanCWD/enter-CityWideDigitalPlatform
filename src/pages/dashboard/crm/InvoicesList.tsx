import { useEffect, useState, useCallback, useRef } from "react";
import { ExternalLink, FileText, Search, RefreshCw, CheckCircle, CloudLightning } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const PAYMENT_METHODS = [
  { value: "e_transfer", label: "e-Transfer" },
  { value: "cash",       label: "Cash" },
  { value: "cheque",     label: "Cheque" },
  { value: "credit_card",label: "Credit Card" },
  { value: "bank_wire",  label: "Bank Wire" },
  { value: "other",      label: "Other" },
];

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

// ── Mark as Paid dialog ──────────────────────────────────────────────────────

interface MarkPaidDialogProps {
  invoice: CrmInvoice | null;
  onClose: () => void;
  onSuccess: () => void;
}

function MarkPaidDialog({ invoice, onClose, onSuccess }: MarkPaidDialogProps) {
  const [method, setMethod] = useState("e_transfer");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Track whether Select is open so we can prevent dialog close during selection
  const selectOpenRef = useRef(false);

  // Reset state when a new invoice is opened
  const invoiceId = invoice?.id;
  useEffect(() => {
    if (invoiceId) {
      setMethod("e_transfer");
      setNotes("");
      setError(null);
    }
  }, [invoiceId]);

  const handleSubmit = async () => {
    if (!invoice) return;
    setSaving(true);
    setError(null);
    try {
      await crm("invoices.markPaid", {
        id: invoice.id,
        payment_method: method,
        notes: notes.trim() || null,
      });
      onSuccess();
    } catch (e) {
      setError((e as Error).message ?? "Failed to mark as paid");
    } finally {
      setSaving(false);
    }
  };

  const methodLabel = PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method;

  return (
    <Dialog open={!!invoice} onOpenChange={(open) => { if (!open && !selectOpenRef.current) onClose(); }}>
      <DialogContent
        className="sm:max-w-md"
        // Prevent the dialog from closing when the Select portal (or any radix portal) fires pointer-down outside
        onPointerDownOutside={(e) => {
          const target = e.target as Element | null;
          if (target?.closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as Element | null;
          if (target?.closest("[data-radix-popper-content-wrapper]")) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            {/* Invoice summary */}
            <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Invoice</span>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {invoice.number ?? invoice.id.slice(0, 8)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Client</span>
                <span className="text-sm text-foreground">{invoice.client_name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Amount</span>
                <span className="text-sm font-bold text-foreground">
                  {fmtMoney(invoice.total_cents, invoice.currency)}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select
                value={method}
                onValueChange={(v) => { setMethod(v); }}
                onOpenChange={(open) => { selectOpenRef.current = open; }}
              >
                <SelectTrigger id="payment-method">
                  <SelectValue placeholder="Select method" />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Deposit notes — rendered as native textarea to avoid portal issues */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                ref={textareaRef}
                id="payment-notes"
                placeholder={`e.g. Deposited via ${methodLabel} on ${new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onClick={() => textareaRef.current?.focus()}
                rows={3}
                className="resize-none"
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving} className="gap-2">
            <CheckCircle className="w-4 h-4" />
            {saving ? "Saving…" : "Mark as Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Stripe actions cell (sync + close out-of-band) ──────────────────────────

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
                        <div className="flex items-center justify-center gap-1">
                          {/* Mark as Paid — only for open / past_due */}
                          {(inv.status === "open" || inv.status === "past_due") && (
                            <button
                              onClick={() => setMarkPaidTarget(inv)}
                              title="Mark as paid"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors whitespace-nowrap"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Paid
                            </button>
                          )}

                          {/* Stripe actions (sync + close out-of-band) — only if linked to Stripe */}
                          {inv.stripe_invoice_id && (
                            <StripeActionsCell invoice={inv} onRefresh={load} />
                          )}

                          {/* Invoice / PDF links */}
                          {inv.hosted_invoice_url && (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View invoice in Stripe"
                              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {inv.pdf_url && (
                            <a
                              href={inv.pdf_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Download PDF"
                              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {!inv.stripe_invoice_id && inv.status !== "open" && inv.status !== "past_due" && !inv.hosted_invoice_url && !inv.pdf_url && (
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
          For invoices sent via Stripe: click the lightning icon to check live status, then "Close in Stripe" if the client paid outside Stripe (e-Transfer, cash, etc.).
        </p>
      </div>

      {/* Mark as Paid dialog */}
      <MarkPaidDialog
        invoice={markPaidTarget}
        onClose={() => setMarkPaidTarget(null)}
        onSuccess={() => {
          setMarkPaidTarget(null);
          load();
        }}
      />
    </DashboardLayout>
  );
}
