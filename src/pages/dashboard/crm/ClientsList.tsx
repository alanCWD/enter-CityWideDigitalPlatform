import { useEffect, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Plus, X, Upload, ChevronLeft, ChevronRight, Trash2, Building2, AlertTriangle, RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmClients } from "@/hooks/useCrm";
import { crm } from "@/lib/crm";
import { ImportClientsDialog } from "@/components/crm/ImportClientsDialog";
import { useAgency } from "@/contexts/AgencyContext";
import { AGENCIES, ACCENT_CLASSES, getAgency } from "@/lib/agencies";

const PAGE_SIZE = 100;

export function ClientsList() {
  const { agency } = useAgency();
  const isMaster = agency.slug === "citywide";

  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [status, setStatus] = useState<string>("");
  // CityWide master view: "all" = show everyone, or filter to a specific agency
  const [agencyFilter, setAgencyFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const showNew = params.get("new") === "1";
  const showImport = params.get("import") === "1";

  // Effective agency_id sent to the API
  const effectiveAgencyId = isMaster
    ? (agencyFilter === "all" ? "all" : agencyFilter)
    : agency.slug;

  const { clients, total, loading, error, reload } = useCrmClients({
    q: debouncedQ || undefined,
    status: status || undefined,
    agency_id: effectiveAgencyId,
    page,
    pageSize: PAGE_SIZE,
  });

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedQ(q); setPage(0); }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => { setPage(0); }, [status, agencyFilter]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const start = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const end = Math.min((page + 1) * PAGE_SIZE, total);

  const deleteClient = useCallback(async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}"? This cannot be undone.`)) return;
    try { await crm("clients.delete", { id }); reload(); }
    catch (e) { alert((e as Error).message); }
  }, [reload]);

  return (
    <DashboardLayout>
      <TopBar
        title="Clients"
        subtitle={
          loading
            ? "Loading…"
            : error
              ? "Couldn't load clients"
              : total > 0
                ? `${start}–${end} of ${total.toLocaleString()}`
                : "0 clients"
        }
        action={{ label: "+ New Client", onClick: () => setParams({ new: "1" }) }}
      />

      <div className="px-6 pt-4 flex justify-end">
        <button
          onClick={() => setParams({ import: "1" })}
          className="inline-flex items-center gap-1.5 bg-card hover:bg-muted border border-border text-foreground text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Import CSV
        </button>
      </div>

      <div className="px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name, email or city…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            {q && (
              <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="prospect">Prospect</option>
            <option value="lead">Lead</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>
          {/* Agency filter — CityWide master view only */}
          {isMaster && (
            <select
              value={agencyFilter}
              onChange={(e) => setAgencyFilter(e.target.value)}
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
            >
              <option value="all">All brands</option>
              {AGENCIES.map((a) => (
                <option key={a.slug} value={a.slug}>{a.name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
                {isMaster && <Th>Brand</Th>}
                <Th className="text-right">Created</Th>
                <Th></Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={isMaster ? 7 : 6} className="py-8 text-center text-xs text-muted-foreground">Loading…</td></tr>
              )}
              {!loading && error && (
                <tr>
                  <td colSpan={isMaster ? 7 : 6} className="py-12">
                    <div className="flex flex-col items-center gap-3 px-6 text-center">
                      <div className="w-9 h-9 rounded-full bg-destructive/10 border border-destructive/25 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Couldn't load clients</p>
                        <p className="mt-1 max-w-md text-xs text-muted-foreground">{error}</p>
                      </div>
                      <button
                        onClick={reload}
                        className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold px-3 py-1.5 rounded-lg transition-colors"
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Try again
                      </button>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && !error && clients.length === 0 && (
                <tr><td colSpan={isMaster ? 7 : 6} className="py-12 text-center text-sm text-muted-foreground">
                  {q || status ? "No clients match your search." : "No clients yet. Click + New Client to add one."}
                </td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/crm/clients/${c.id}`} className="text-sm font-semibold text-foreground hover:text-primary">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.billing_email ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3">
                    <StatusSelect clientId={c.id} status={c.status} onUpdated={reload} />
                  </td>
                  {isMaster && (
                    <td className="px-4 py-3">
                      <AgencySelect clientId={c.id} agencyId={c.agency_id ?? "citywide"} onUpdated={reload} />
                    </td>
                  )}
                  <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => deleteClient(c.id, c.name)}
                      title="Delete client"
                      className="p-1 rounded text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {totalPages} &middot; {total.toLocaleString()} total clients
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i)
                .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2)
                .reduce<(number | "…")[]>((acc, i, idx, arr) => {
                  if (idx > 0 && (i as number) - (arr[idx - 1] as number) > 1) acc.push("…");
                  acc.push(i);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "…" ? (
                    <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setPage(item as number)}
                      className={`min-w-[28px] h-7 px-1.5 text-xs rounded-lg border transition-colors ${
                        page === item
                          ? "bg-primary text-primary-foreground border-primary font-bold"
                          : "border-border text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {(item as number) + 1}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-border text-muted-foreground hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {showNew && (
        <NewClientDialog
          agencySlug={agency.slug}
          onClose={() => setParams({})}
          onCreated={() => { setParams({}); reload(); }}
        />
      )}

      {showImport && (
        <ImportClientsDialog
          onClose={() => setParams({})}
          onImported={() => reload()}
        />
      )}
    </DashboardLayout>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}>{children}</th>;
}

function NewClientDialog({ agencySlug, onClose, onCreated }: { agencySlug: string; onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await crm("clients.create", { name, billing_email: email || null, phone: phone || null, agency_id: agencySlug });
      onCreated();
    } catch (e2) { setErr((e2 as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-card border border-border rounded-2xl p-6 m-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Add Client</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Business name" value={name} onChange={setName} required autoFocus />
          <Field label="Billing email" type="email" value={email} onChange={setEmail} />
          <Field label="Phone" value={phone} onChange={setPhone} />
        </div>
        {err && <p className="mt-3 text-xs text-destructive">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-bold px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> {busy ? "Creating…" : "Create Client"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, ...props }: { label: string; value: string; onChange: (v: string) => void } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
      />
    </label>
  );
}

const STATUS_OPTIONS = ["lead", "prospect", "active", "paused", "churned"] as const;
const STATUS_STYLES: Record<string, string> = {
  active:   "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  lead:     "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  prospect: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  paused:   "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  churned:  "bg-muted text-muted-foreground border-border",
};

function StatusSelect({ clientId, status, onUpdated }: { clientId: string; status: string; onUpdated: () => void }) {
  const [current, setCurrent] = useState(status);
  const [saving, setSaving] = useState(false);

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    const prev = current;
    setCurrent(next);
    setSaving(true);
    try {
      await crm("clients.update", { id: clientId, status: next });
      onUpdated();
    } catch (err) {
      setCurrent(prev);
      if ((err as Error).message?.includes("not found")) onUpdated();
    }
    finally { setSaving(false); }
  };

  const style = STATUS_STYLES[current] ?? "bg-muted text-muted-foreground border-border";
  return (
    <select
      value={current}
      onChange={onChange}
      disabled={saving}
      onClick={(e) => e.stopPropagation()}
      className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 cursor-pointer focus:outline-none disabled:opacity-60 transition-colors appearance-none ${style}`}
    >
      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

/** Inline agency re-assignment for the CityWide master view */
function AgencySelect({ clientId, agencyId, onUpdated }: { clientId: string; agencyId: string; onUpdated: () => void }) {
  const [current, setCurrent] = useState(agencyId);
  const [saving, setSaving] = useState(false);
  const ag = getAgency(current);
  const accent = ACCENT_CLASSES[ag.accent];

  const onChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    const prev = current;
    setCurrent(next);
    setSaving(true);
    try {
      await crm("clients.update", { id: clientId, agency_id: next });
      onUpdated();
    } catch {
      setCurrent(prev);
    } finally { setSaving(false); }
  };

  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${accent.dot}`} />
      <select
        value={current}
        onChange={onChange}
        disabled={saving}
        onClick={(e) => e.stopPropagation()}
        className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 cursor-pointer focus:outline-none disabled:opacity-60 transition-colors appearance-none ${accent.bg} ${accent.text} ${accent.border}`}
      >
        {AGENCIES.map((a) => <option key={a.slug} value={a.slug}>{a.name}</option>)}
      </select>
    </div>
  );
}
