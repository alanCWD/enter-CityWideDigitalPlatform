import { useEffect, useState, useCallback } from "react";
import { ExternalLink, FileText, Search, RefreshCw, CheckCircle } from "lucide-react";
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

  // Reset state when dialog opens for a new invoice
  useEffect(() => {
    if (invoice) {
      setMethod("e_transfer");
      setNotes("");
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice?.id]);

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
    <Dialog open={!!invoice} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mark Invoice as Paid</DialogTitle>
        </DialogHeader>

        {invoice && (
          <div className="space-y-4 py-1">
            {/* Invoice summary */}
            <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Invoice</span>
                <span className="text-sm font-mono font-semibold text-foreground">{invoice.number ?? invoice.id.slice(0, 8)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Client</span>
                <span className="text-sm text-foreground">{invoice.client_name ?? "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Amount</span>
                <span className="text-sm font-bold text-foreground">{fmtMoney(invoice.total_cents, invoice.currency)}</span>
              </div>
            </div>

            {/* Payment method */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-method">Payment Method</Label>
              <Select value={method} onValueChange={setMethod}>
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

            {/* Deposit notes */}
            <div className="space-y-1.5">
              <Label htmlFor="payment-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="payment-notes"
                placeholder={`e.g. Deposited via ${methodLabel} on ${new Date().toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
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
          {/* Search */}
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

          {/* Status tabs */}
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

          {/* Refresh */}
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
              <p className="text-xs opacity-60">Invoices will appear here once subscriptions are created with "Send Invoice" billing</p>
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
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sent</th>
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
                              {PAYMENT_METHODS.find((m) => m.value === inv.payment_method)?.label ?? inv.payment_method}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                        {fmtMoney(inv.total_cents, inv.currency)}
                        {inv.status === "paid" && inv.amount_paid_cents > 0 && inv.amount_paid_cents < inv.total_cents && (
                          <div className="text-[10px] text-muted-foreground">{fmtMoney(inv.amount_paid_cents)} paid</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(inv.issued_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(inv.sent_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        <div>
                          {fmt(inv.paid_at)}
                          {inv.payment_notes && (
                            <div className="text-[10px] text-muted-foreground/70 max-w-[140px] truncate" title={inv.payment_notes}>
                              {inv.payment_notes}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Mark as Paid button for open/past_due */}
                          {(inv.status === "open" || inv.status === "past_due") && (
                            <button
                              onClick={() => setMarkPaidTarget(inv)}
                              title="Mark as paid"
                              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20 border border-green-500/20 transition-colors"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              Paid
                            </button>
                          )}
                          {inv.hosted_invoice_url && (
                            <a
                              href={inv.hosted_invoice_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="View invoice"
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
                          {inv.status !== "open" && inv.status !== "past_due" && !inv.hosted_invoice_url && !inv.pdf_url && (
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
