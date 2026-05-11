import { Link } from "react-router-dom";
import { Users, DollarSign, AlertCircle, Receipt, Plus, Package } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmMetrics, useCrmClients, useCrmInvoices } from "@/hooks/useCrm";
import { fmtMoney } from "@/lib/crm";
import { StatusPill } from "@/components/crm/StatusPill";

export function CrmIndex() {
  const { data: metrics } = useCrmMetrics();
  const { clients } = useCrmClients();
  const { invoices } = useCrmInvoices();

  const recentClients = clients.slice(0, 5);
  const recentInvoices = invoices.slice(0, 6);

  return (
    <DashboardLayout>
      <TopBar
        title="CRM & Billing"
        subtitle="Clients, plans, invoices and payments — backed by Bunny Database + Stripe"
        action={{ label: "+ New Client", href: "/dashboard/crm/clients?new=1" }}
      />

      <div className="px-6 py-6 space-y-6">
        {/* Metric tiles */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricTile
            icon={Users}
            label="Active Clients"
            value={String(metrics?.active_clients ?? "—")}
            accent="#0078D7"
          />
          <MetricTile
            icon={DollarSign}
            label="Monthly Recurring Revenue"
            value={fmtMoney(metrics?.mrr_cents ?? 0)}
            accent="#22C55E"
          />
          <MetricTile
            icon={Receipt}
            label="Outstanding"
            value={fmtMoney(metrics?.outstanding_cents ?? 0)}
            accent="#5BB8FF"
          />
          <MetricTile
            icon={AlertCircle}
            label="Overdue"
            value={String(metrics?.overdue_count ?? "—")}
            accent={(metrics?.overdue_count ?? 0) > 0 ? "#F97316" : "#22C55E"}
          />
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            to="/dashboard/crm/clients"
            className="inline-flex items-center gap-2 bg-[#0078D7] hover:bg-[#00447A] text-white text-sm font-bold px-4 py-2.5 rounded-lg transition-colors shadow-[0_2px_8px_rgba(0,120,215,0.3)]"
          >
            <Users className="w-4 h-4" /> All Clients
          </Link>
          <Link
            to="/dashboard/crm/catalog"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-[#EEF1FA] border border-white/10 text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Package className="w-4 h-4" /> Products & Plans
          </Link>
          <Link
            to="/dashboard/crm/clients?new=1"
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 text-[#EEF1FA] border border-white/10 text-sm font-bold px-4 py-2.5 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Client
          </Link>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent clients */}
          <div className="bg-[#111E33] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#EEF1FA] uppercase tracking-wider">Recent Clients</h2>
              <Link to="/dashboard/crm/clients" className="text-xs text-[#0078D7] hover:underline">View all</Link>
            </div>
            {recentClients.length === 0 ? (
              <EmptyHint label="No clients yet — start by adding your first." />
            ) : (
              <ul className="divide-y divide-white/5">
                {recentClients.map((c) => (
                  <li key={c.id}>
                    <Link
                      to={`/dashboard/crm/clients/${c.id}`}
                      className="flex items-center justify-between py-3 hover:bg-white/2 -mx-2 px-2 rounded-lg transition-colors"
                    >
                      <div>
                        <div className="text-sm font-semibold text-[#EEF1FA]">{c.name}</div>
                        <div className="text-xs text-[rgba(238,241,250,0.5)]">{c.billing_email ?? "—"}</div>
                      </div>
                      <StatusPill status={c.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Recent invoices */}
          <div className="bg-[#111E33] border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-[#EEF1FA] uppercase tracking-wider">Recent Invoices</h2>
            </div>
            {recentInvoices.length === 0 ? (
              <EmptyHint label="No invoices yet." />
            ) : (
              <ul className="divide-y divide-white/5">
                {recentInvoices.map((inv) => (
                  <li key={inv.id} className="flex items-center justify-between py-3">
                    <div>
                      <div className="text-sm font-semibold text-[#EEF1FA]">
                        {inv.number ?? inv.id.slice(0, 8)} · <span className="text-[rgba(238,241,250,0.6)] font-normal">{inv.client_name ?? "—"}</span>
                      </div>
                      <div className="text-xs text-[rgba(238,241,250,0.5)]">
                        {new Date(inv.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-[#EEF1FA]">{fmtMoney(inv.total_cents, inv.currency)}</span>
                      <StatusPill status={inv.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricTile({ icon: Icon, label, value, accent }: { icon: React.ElementType; label: string; value: string; accent: string }) {
  return (
    <div className="bg-[#111E33] border border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accent}26`, color: accent }}>
          <Icon className="w-4 h-4" />
        </span>
      </div>
      <div className="text-2xl font-extrabold text-[#EEF1FA]">{value}</div>
      <div className="text-xs text-[rgba(238,241,250,0.55)] mt-1">{label}</div>
    </div>
  );
}

function EmptyHint({ label }: { label: string }) {
  return (
    <div className="text-xs text-[rgba(238,241,250,0.45)] py-6 text-center">
      {label}
    </div>
  );
}
