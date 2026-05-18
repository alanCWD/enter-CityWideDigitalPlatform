import { useState } from "react";
import { Package, Plus, X, Repeat, Tag } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmProducts } from "@/hooks/useCrm";
import { crm, fmtMoney, CrmProduct } from "@/lib/crm";
import { cn } from "@/lib/utils";

export function Catalog() {
  const { products, loading, reload } = useCrmProducts();
  const [editing, setEditing] = useState<CrmProduct | "new" | null>(null);

  return (
    <DashboardLayout>
      <TopBar
        title="Products & Plans"
        subtitle="Items you sell — synced to Stripe automatically"
        action={{ label: "+ New Product", onClick: () => setEditing("new") }}
      />

      <div className="px-6 py-6">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}
        {!loading && products.length === 0 && (
          <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No products yet. Add the things CityWide Digital sells — one-off services or subscriptions.</p>
            <button
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-1.5 bg-[#0078D7] hover:bg-[#00447A] text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create your first product
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <button
              key={p.id}
              onClick={() => setEditing(p)}
              className={cn(
                "text-left bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5 hover:border-[#0078D7]/40 transition-colors",
                p.active ? "" : "opacity-60",
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={cn(
                  "w-7 h-7 rounded-lg flex items-center justify-center",
                  p.type === "subscription" ? "bg-[#22C55E]/15 text-[#22C55E]" : "bg-[#5BB8FF]/15 text-[#5BB8FF]",
                )}>
                  {p.type === "subscription" ? <Repeat className="w-3.5 h-3.5" /> : <Tag className="w-3.5 h-3.5" />}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {p.type === "subscription" ? `Per ${p.interval ?? "month"}` : "One-off"}
                </span>
              </div>
              <h3 className="text-base font-bold text-foreground dark:text-[#EEF1FA] mb-1">{p.name}</h3>
              <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2em]">{p.description ?? ""}</p>
              <div className="text-xl font-extrabold text-foreground dark:text-[#EEF1FA]">{fmtMoney(p.unit_amount_cents, p.currency)}</div>
            </button>
          ))}
        </div>
      </div>

      {editing && (
        <ProductEditor
          product={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); reload(); }}
        />
      )}
    </DashboardLayout>
  );
}

function ProductEditor({ product, onClose, onSaved }: { product: CrmProduct | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [type, setType] = useState<"one_off" | "subscription">(product?.type ?? "subscription");
  const [interval, setInterval] = useState<"month" | "year">((product?.interval as "month" | "year") ?? "month");
  const [amount, setAmount] = useState(product ? String((product.unit_amount_cents ?? 0) / 100) : "");
  const [currency] = useState("CAD");
  const [active, setActive] = useState(product ? !!product.active : true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      const cents = Math.round(parseFloat(amount || "0") * 100);
      await crm("products.upsert", {
        id: product?.id,
        name, description: description || null,
        type,
        unit_amount_cents: cents,
        currency,
        interval: type === "subscription" ? interval : null,
        active,
      });
      onSaved();
    } catch (e2) { setErr((e2 as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg bg-[#0A1120] border border-border dark:border-white/10 rounded-2xl p-6 m-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground dark:text-[#EEF1FA]">{product ? "Edit Product" : "New Product"}</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-muted-foreground hover:bg-muted dark:bg-white/10 hover:text-foreground dark:text-[#EEF1FA]"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3">
          <Field label="Name" value={name} onChange={setName} required autoFocus />
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-lg px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA] placeholder:text-muted-foreground focus:outline-none focus:border-[#0078D7]/50"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "one_off" | "subscription")}
                className="mt-1 w-full bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-lg px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA] focus:outline-none focus:border-[#0078D7]/50"
              >
                <option value="subscription">Subscription</option>
                <option value="one_off">One-off</option>
              </select>
            </label>
            {type === "subscription" && (
              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Billing interval</span>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as "month" | "year")}
                  className="mt-1 w-full bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-lg px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA] focus:outline-none focus:border-[#0078D7]/50"
                >
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={`Price (${currency})`} type="number" step="0.01" value={amount} onChange={setAmount} required />
            <label className="flex items-center gap-2 mt-5">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
              <span className="text-sm text-muted-foreground">Active</span>
            </label>
          </div>
        </div>

        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}
        <p className="mt-3 text-[11px] text-muted-foreground">Saving will create a new Stripe price (Stripe prices are immutable).</p>

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground dark:text-[#EEF1FA]">Cancel</button>
          <button type="submit" disabled={busy} className="bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
            {busy ? "Saving…" : "Save Product"}
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
        className="mt-1 w-full bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-lg px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA] placeholder:text-muted-foreground focus:outline-none focus:border-[#0078D7]/50"
      />
    </label>
  );
}
