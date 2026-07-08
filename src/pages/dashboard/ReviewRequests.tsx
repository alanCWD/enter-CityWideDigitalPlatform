import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle2, AlertCircle, RefreshCw, Mail, Star,
  TrendingUp, Send, XCircle, Loader2, Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useAllReviewRequests, useAllQboConnections } from "@/hooks/useQuickbooks";
import { useCrmClients } from "@/hooks/useCrm";
import { cn } from "@/lib/utils";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
}

type StatusFilter = "all" | "sent" | "failed";

function StatCard({
  label, value, sub, icon: Icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5 flex items-start gap-4">
      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0", color)}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="text-2xl font-extrabold text-foreground dark:text-[#EEF1FA] mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export function ReviewRequestsDashboard() {
  const { requests, loading, reload } = useAllReviewRequests();
  const { connections } = useAllQboConnections();
  const { clients } = useCrmClients({ pageSize: 500 });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");

  // Build id → name map from CRM clients
  const clientMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clients) map[c.id] = c.name;
    return map;
  }, [clients]);

  // Stats
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const sent = requests.filter((r) => r.status === "sent");
  const failed = requests.filter((r) => r.status === "failed");
  const thisMonth = requests.filter((r) => new Date(r.sent_at) >= firstOfMonth);
  const successRate = requests.length > 0
    ? Math.round((sent.length / requests.length) * 100)
    : 0;

  // Unique clients with connections
  const connectedClientIds = connections.map((c) => c.crm_client_id);

  // Client options for filter
  const clientOptions = useMemo(() => {
    const ids = [...new Set(requests.map((r) => r.crm_client_id))];
    return ids.map((id) => ({ id, name: clientMap[id] || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [requests, clientMap]);

  // Filtered list
  const filtered = useMemo(() => {
    return requests.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (clientFilter !== "all" && r.crm_client_id !== clientFilter) return false;
      return true;
    });
  }, [requests, statusFilter, clientFilter]);

  return (
    <DashboardLayout>
      <TopBar
        title="Review Requests"
        subtitle="Automated emails sent after QBO invoice payment"
      />

      <div className="px-6 py-6 space-y-5">

        {/* Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Total Sent"
            value={requests.length}
            sub="all time"
            icon={Send}
            color="bg-[#0078D7]/10 text-[#0078D7]"
          />
          <StatCard
            label="This Month"
            value={thisMonth.length}
            sub={now.toLocaleString("default", { month: "long" })}
            icon={TrendingUp}
            color="bg-[#22C55E]/10 text-[#22C55E]"
          />
          <StatCard
            label="Success Rate"
            value={`${successRate}%`}
            sub={`${sent.length} delivered`}
            icon={CheckCircle2}
            color="bg-[#22C55E]/10 text-[#22C55E]"
          />
          <StatCard
            label="Failed"
            value={failed.length}
            sub="hover row for reason"
            icon={XCircle}
            color="bg-red-500/10 text-red-400"
          />
        </div>

        {/* Connected clients banner */}
        {connectedClientIds.length > 0 && (
          <div className="flex items-center gap-3 bg-[#2CA01C]/8 border border-[#2CA01C]/20 rounded-xl px-4 py-3">
            <Users className="w-4 h-4 text-[#2CA01C] shrink-0" />
            <p className="text-sm text-[#2CA01C] font-medium">
              <strong>{connectedClientIds.length}</strong> client{connectedClientIds.length !== 1 ? "s" : ""} connected to QuickBooks Online
            </p>
            <Link
              to="/dashboard/crm/clients"
              className="ml-auto text-xs font-bold text-[#2CA01C] hover:underline shrink-0"
            >
              Manage clients
            </Link>
          </div>
        )}

        {/* Filters + table */}
        <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl overflow-hidden">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-border dark:border-white/8">
            {/* Status tabs */}
            <div className="flex rounded-lg border border-border overflow-hidden text-xs font-semibold">
              {(["all", "sent", "failed"] as StatusFilter[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={cn(
                    "px-3 py-1.5 capitalize transition-colors",
                    statusFilter === s
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-muted-foreground hover:bg-muted",
                    s !== "all" && "border-l border-border",
                  )}
                >
                  {s === "all" ? `All (${requests.length})` : s === "sent" ? `Sent (${sent.length})` : `Failed (${failed.length})`}
                </button>
              ))}
            </div>

            {/* Client filter */}
            {clientOptions.length > 1 && (
              <select
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
                className="bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
              >
                <option value="all">All clients</option>
                {clientOptions.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            <button
              onClick={() => reload()}
              className="ml-auto p-1.5 rounded-lg text-muted-foreground hover:text-[#0078D7] hover:bg-[#0078D7]/10 transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center gap-2 px-5 py-10 text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Loading review requests…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 flex flex-col items-center gap-2 text-muted-foreground">
              <Star className="w-10 h-10 opacity-15" />
              <p className="text-sm font-medium">No review requests yet</p>
              <p className="text-xs opacity-70">
                Connect a client's QuickBooks from the <strong>QuickBooks</strong> tab in their CRM profile.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border dark:border-white/8">
                    {["Date", "Client", "Customer", "Email", "Invoice #", "Status"].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-5 py-3 first:pl-5"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border dark:divide-white/5">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-5 py-3 text-xs text-muted-foreground whitespace-nowrap">
                        {fmtDate(r.sent_at)}
                      </td>
                      <td className="px-5 py-3">
                        {clientMap[r.crm_client_id] ? (
                          <Link
                            to={`/dashboard/crm/clients/${r.crm_client_id}?tab=quickbooks`}
                            className="text-xs font-medium text-[#0078D7] hover:underline"
                          >
                            {clientMap[r.crm_client_id]}
                          </Link>
                        ) : (
                          <span className="text-xs font-mono text-muted-foreground">{r.crm_client_id.slice(0, 8)}…</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-xs font-medium text-foreground dark:text-[#EEF1FA]">
                        {r.customer_name || "—"}
                      </td>
                      <td className="px-5 py-3">
                        <a
                          href={`mailto:${r.customer_email}`}
                          className="text-xs text-[#0078D7] hover:underline inline-flex items-center gap-1"
                        >
                          <Mail className="w-3 h-3" /> {r.customer_email}
                        </a>
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-muted-foreground">
                        {r.qbo_invoice_id}
                      </td>
                      <td className="px-5 py-3">
                        {r.status === "sent" ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/20">
                            <CheckCircle2 className="w-2.5 h-2.5" /> Sent
                          </span>
                        ) : (
                          <span
                            title={r.error_message || "Unknown error"}
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
      </div>
    </DashboardLayout>
  );
}
