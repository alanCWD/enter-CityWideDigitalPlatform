import { useState } from "react";
import { Package, Plus, X, Repeat, Tag, Pencil } from "lucide-react";
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
        subtitle="Items you sell — subscriptions and one-off services"
        action={{ label: "+ New Product", onClick: () => setEditing("new") }}
      />

      <div className="px-6 py-6">
        {loading && <p className="text-xs text-muted-foreground">Loading…</p>}

        {!loading && products.length === 0 && (
          <div className="bg-card border border-border rounded-2xl p-14 text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Package className="w-6 h-6 text-primary" />
            </div>
            <p className="text-sm font-semibold text-foreground mb-1">No products yet</p>
            <p className="text-xs text-muted-foreground mb-5 max-w-xs mx-auto">
              Add the things you sell — recurring subscriptions or one-off services.
            </p>
            <button
              onClick={() => setEditing("new")}
              className="inline-flex items-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Create your first product
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((p) => (
            <div
              key={p.id}
              className={cn(
                "group relative bg-card border border-border rounded-2xl p-5 hover:border-primary/40 hover:shadow-md transition-all",
                !p.active && "opacity-50",
              )}
            >
              {/* Edit button */}
              <button
                onClick={() => setEditing(p)}
                className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-muted hover:bg-accent transition-all"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
              </button>

              {/* Type badge */}
              <div className="flex items-center gap-2 mb-3">
                <span className={cn(
                  "w-8 h-8 rounded-xl flex items-center justify-center",
                  p.type === "subscription"
                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                    : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
                )}>
                  {p.type === "subscription"
                    ? <Repeat className="w-4 h-4" />
                    : <Tag className="w-4 h-4" />}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {p.type === "subscription" ? `Per ${p.interval ?? "month"}` : "One-off"}
                </span>
              </div>

              <h3 className="text-base font-bold text-foreground mb-1">{p.name}</h3>
              <p className="text-xs text-muted-foreground mb-4 line-clamp-2 min-h-[2.5em]">
                {p.description ?? <span className="italic">No description</span>}
              </p>

              <div className="flex items-end justify-between">
                <div>
                  <div className="text-2xl font-extrabold text-foreground">
                    {fmtMoney(p.unit_amount_cents, p.currency)}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {p.currency ?? "CAD"}
                    {p.type === "subscription" && ` / ${p.interval ?? "month"}`}
                  </div>
                </div>
                {!p.active && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                    Inactive
                  </span>
                )}
              </div>
            </div>
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

function ProductEditor({ product, onClose, onSaved }: {
  product: CrmProduct | null;
  onClose: () => void;
  onSaved: () => void;
}) {
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
        name,
        description: description || null,
        type,
        unit_amount_cents: cents,
        currency,
        interval: type === "subscription" ? interval : null,
        active: active ? 1 : 0,
      });
      onSaved();
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 m-4 shadow-xl"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {product ? "Edit Product" : "New Product"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {product ? "Update this product's details" : "Create a new product or plan"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <Field label="Product name" value={name} onChange={setName} required autoFocus placeholder="e.g. Local SEO Monthly" />

          <label className="block">
            <span className="text-xs font-semibold text-foreground">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Short description shown on invoices…"
              className="mt-1.5 w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Type</span>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as "one_off" | "subscription")}
                className="mt-1.5 w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
              >
                <option value="subscription">Subscription</option>
                <option value="one_off">One-off</option>
              </select>
            </label>
            {type === "subscription" && (
              <label className="block">
                <span className="text-xs font-semibold text-foreground">Billing interval</span>
                <select
                  value={interval}
                  onChange={(e) => setInterval(e.target.value as "month" | "year")}
                  className="mt-1.5 w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
                >
                  <option value="month">Monthly</option>
                  <option value="year">Yearly</option>
                </select>
              </label>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 items-end">
            <Field
              label={`Price (${currency})`}
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={setAmount}
              required
              placeholder="0.00"
            />
            <label className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="w-4 h-4 rounded accent-primary"
              />
              <span className="text-sm text-foreground font-medium">Active</span>
            </label>
          </div>
        </div>

        {err && (
          <p className="mt-4 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {err}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-bold px-5 py-2 rounded-lg transition-colors"
          >
            {busy ? "Saving…" : "Save Product"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  ...props
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <input
        {...props}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full bg-background border border-input rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50"
      />
    </label>
  );
}
