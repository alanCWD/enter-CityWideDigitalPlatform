import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Plus, X } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmClients } from "@/hooks/useCrm";
import { crm } from "@/lib/crm";
import { StatusPill } from "@/components/crm/StatusPill";

export function ClientsList() {
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("");
  const { clients, loading, reload } = useCrmClients({ q: q || undefined, status: status || undefined });
  const showNew = params.get("new") === "1";

  return (
    <DashboardLayout>
      <TopBar
        title="Clients"
        subtitle={`${clients.length} client${clients.length === 1 ? "" : "s"}`}
        action={{ label: "+ New Client", onClick: () => setParams({ new: "1" }) }}
      />

      <div className="px-6 py-6 space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[260px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(238,241,250,0.4)] pointer-events-none" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full bg-[#111E33] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.35)] focus:outline-none focus:border-[#0078D7]/50"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-[#111E33] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#EEF1FA] focus:outline-none focus:border-[#0078D7]/50"
          >
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="lead">Lead</option>
            <option value="paused">Paused</option>
            <option value="churned">Churned</option>
          </select>
        </div>

        {/* Table */}
        <div className="bg-[#111E33] border border-white/10 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/3">
                <Th>Name</Th>
                <Th>Email</Th>
                <Th>Phone</Th>
                <Th>Status</Th>
                <Th className="text-right">Created</Th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="py-8 text-center text-xs text-[rgba(238,241,250,0.45)]">Loading…</td></tr>}
              {!loading && clients.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-sm text-[rgba(238,241,250,0.45)]">
                  No clients yet. Click <span className="text-[#0078D7]">+ New Client</span> to add one.
                </td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                  <td className="px-4 py-3">
                    <Link to={`/dashboard/crm/clients/${c.id}`} className="text-sm font-semibold text-[#EEF1FA] hover:text-[#0078D7]">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-[rgba(238,241,250,0.7)]">{c.billing_email ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-[rgba(238,241,250,0.7)]">{c.phone ?? "—"}</td>
                  <td className="px-4 py-3"><StatusPill status={c.status} /></td>
                  <td className="px-4 py-3 text-right text-xs text-[rgba(238,241,250,0.5)]">{new Date(c.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showNew && (
        <NewClientDialog
          onClose={() => setParams({})}
          onCreated={() => { setParams({}); reload(); }}
        />
      )}
    </DashboardLayout>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[rgba(238,241,250,0.5)] ${className ?? ""}`}>{children}</th>;
}

function NewClientDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
      await crm("clients.create", { name, billing_email: email || null, phone: phone || null });
      onCreated();
    } catch (e2) { setErr((e2 as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-[#0A1120] border border-white/10 rounded-2xl p-6 m-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#EEF1FA]">Add Client</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-[rgba(238,241,250,0.5)] hover:bg-white/10 hover:text-[#EEF1FA]"><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <Field label="Business name" value={name} onChange={setName} required autoFocus />
          <Field label="Billing email" type="email" value={email} onChange={setEmail} />
          <Field label="Phone" value={phone} onChange={setPhone} />
        </div>
        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-[rgba(238,241,250,0.7)] hover:text-[#EEF1FA]">Cancel</button>
          <button
            type="submit"
            disabled={busy || !name.trim()}
            className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
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
      <span className="text-[10px] font-bold uppercase tracking-wider text-[rgba(238,241,250,0.55)]">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full bg-[#111E33] border border-white/10 rounded-lg px-3 py-2 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.35)] focus:outline-none focus:border-[#0078D7]/50"
      />
    </label>
  );
}
