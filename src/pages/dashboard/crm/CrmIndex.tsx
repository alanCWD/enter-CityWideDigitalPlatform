import { Link } from "react-router-dom";
import { useState } from "react";
import { Users, DollarSign, AlertCircle, Receipt, Plus, Package, Activity, AlertTriangle, Database } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmMetrics, useCrmClients, useCrmInvoices } from "@/hooks/useCrm";
import { crm, fmtMoney } from "@/lib/crm";
import { StatusPill } from "@/components/crm/StatusPill";

interface DebugTable { table: string; count: number; columns: string[]; sample: Record<string, unknown> | null; error?: string }

export function CrmIndex() {
  const { data: metrics, error: metricsErr, reload: reloadMetrics } = useCrmMetrics();
  const { clients, error: clientsErr, reload: reloadClients } = useCrmClients();
  const { invoices } = useCrmInvoices();
  const firstError = metricsErr ?? clientsErr ?? null;
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [tables, setTables] = useState<DebugTable[] | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [adopting, setAdopting] = useState<string | null>(null);

  async function runPing() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await crm<{ ok: boolean }>("ping");
      setTestResult(`Connection OK — Bunny responded: ${JSON.stringify(res)}`);
      reloadMetrics();
    } catch (e) {
      setTestResult(`FAILED: ${(e as Error).message}`);
    } finally {
      setTesting(false);
    }
  }

  async function runDiagnose() {
    setDiagnosing(true);
    setTables(null);
    try {
      const res = await crm<{ tables: DebugTable[] }>("debug.tables");
      setTables(res.tables);
    } catch (e) {
      setTestResult(`Diagnose FAILED: ${(e as Error).message}`);
    } finally {
      setDiagnosing(false);
    }
  }

  async function adopt(source: string) {
    setAdopting(source);
    try {
      const res = await crm<{ ok: boolean; total_clients: number; mapping_used: Record<string, string | null> }>(
        "debug.adoptClients",
        { source },
      );
      setTestResult(`Adopted from "${source}" → clients now has ${res.total_clients} rows. Mapping used: ${JSON.stringify(res.mapping_used)}`);
      reloadClients();
      reloadMetrics();
      runDiagnose();
    } catch (e) {
      setTestResult(`Adopt FAILED: ${(e as Error).message}`);
    } finally {
      setAdopting(null);
    }
  }

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
        {/* Diagnostic banner */}
        <div className="bg-[#111E33] border border-white/10 rounded-2xl p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[260px]">
            <div className="text-xs uppercase tracking-wider text-[rgba(238,241,250,0.5)] mb-1">Backend status</div>
            {firstError ? (
              <div className="flex items-start gap-2 text-sm text-[#F97316]">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span className="break-all">{firstError}</span>
              </div>
            ) : testResult ? (
              <div className={`text-sm ${testResult.startsWith("FAILED") ? "text-[#F97316]" : "text-[#22C55E]"}`}>{testResult}</div>
            ) : (
              <div className="text-sm text-[rgba(238,241,250,0.7)]">Idle. Press <strong>Test connection</strong> to verify Bunny + Stripe wiring.</div>
            )}
          </div>
          <button
            onClick={runPing}
            disabled={testing}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-[#EEF1FA] border border-white/10 text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Activity className="w-4 h-4" />
            {testing ? "Pinging…" : "Test connection"}
          </button>
          <button
            onClick={runDiagnose}
            disabled={diagnosing}
            className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 disabled:opacity-50 text-[#EEF1FA] border border-white/10 text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Database className="w-4 h-4" />
            {diagnosing ? "Scanning…" : "Diagnose data"}
          </button>
        </div>

        {tables && (
          <div className="bg-[#111E33] border border-white/10 rounded-2xl p-5">
            <div className="text-xs uppercase tracking-wider text-[rgba(238,241,250,0.5)] mb-3">Bunny tables</div>
            <div className="space-y-2">
              {tables.length === 0 ? (
                <div className="text-sm text-[rgba(238,241,250,0.55)]">No tables in Bunny DB.</div>
              ) : tables.map((t) => {
                const isClients = t.table === "clients";
                const candidate = !isClients && t.count > 0 && (
                  t.columns.includes("name") ||
                  t.columns.includes("business_name") ||
                  t.columns.includes("company_name") ||
                  t.columns.includes("title")
                );
                return (
                  <div key={t.table} className="border border-white/5 rounded-lg p-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="font-mono text-sm text-[#EEF1FA]">
                        {t.table}
                        <span className="ml-2 text-xs text-[rgba(238,241,250,0.5)]">({t.count.toLocaleString()} rows)</span>
                      </div>
                      {candidate && (
                        <button
                          onClick={() => adopt(t.table)}
                          disabled={adopting === t.table}
                          className="text-xs font-bold bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors"
                        >
                          {adopting === t.table ? "Adopting…" : `Adopt → clients`}
                        </button>
                      )}
                    </div>
                    {t.columns.length > 0 && (
                      <div className="mt-2 text-[11px] font-mono text-[rgba(238,241,250,0.45)] break-all">
                        cols: {t.columns.join(", ")}
                      </div>
                    )}
                    {t.error && <div className="mt-2 text-xs text-[#F97316]">{t.error}</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

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
