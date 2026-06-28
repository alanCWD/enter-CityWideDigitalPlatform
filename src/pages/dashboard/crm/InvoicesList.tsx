import { useEffect, useState, useCallback } from "react";
import { ExternalLink, FileText, Search, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { crm, fmtMoney, type CrmInvoice } from "@/lib/crm";
import { Link } from "react-router-dom";

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

function fmt(dateStr: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" });
}

export function InvoicesList() {
  const [invoices, setInvoices] = useState<CrmInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");

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
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Links</th>
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
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold border ${STATUS_STYLES[inv.status] ?? STATUS_STYLES.draft}`}>
                          {inv.status.replace("_", " ")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                        {fmtMoney(inv.total_cents, inv.currency)}
                        {inv.status === "paid" && inv.amount_paid_cents > 0 && inv.amount_paid_cents < inv.total_cents && (
                          <div className="text-[10px] text-muted-foreground">{fmtMoney(inv.amount_paid_cents)} paid</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(inv.issued_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(inv.sent_at)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{fmt(inv.paid_at)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
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
                          {!inv.hosted_invoice_url && !inv.pdf_url && (
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
    </DashboardLayout>
  );
}
