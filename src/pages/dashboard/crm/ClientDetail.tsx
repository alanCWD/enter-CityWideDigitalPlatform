import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Mail, Phone, MapPin, Plus, Send, Trash2, Repeat, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmClient, useCrmProducts } from "@/hooks/useCrm";
import { crm, fmtMoney } from "@/lib/crm";
import { StatusPill } from "@/components/crm/StatusPill";
import { VaultPanel } from "@/components/crm/vault/VaultPanel";
import { HealthPanel } from "@/components/crm/health/HealthPanel";
import { cn } from "@/lib/utils";

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { detail, loading, error, reload } = useCrmClient(id);
  const [tab, setTab] = useState<"overview" | "health" | "vault" | "subscriptions" | "invoices" | "payments">("overview");
  const [deleting, setDeleting] = useState(false);

  if (loading) {
    return <DashboardLayout><TopBar title="Loading…" /></DashboardLayout>;
  }
  if (!detail?.client) {
    return (
      <DashboardLayout>
        <TopBar title="Client not found" />
        <div className="p-6 space-y-3">
          <Link to="/dashboard/crm/clients" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Back to clients
          </Link>
          <ErrorDebug id={id} error={error} />
        </div>
      </DashboardLayout>
    );
  }

  const c = detail.client;
  const deleteClient = async () => {
    if (!confirm(`Permanently delete "${c.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await crm("clients.delete", { id: c.id });
      navigate("/dashboard/crm/clients");
    } catch { setDeleting(false); }
  };

  return (
    <DashboardLayout>
      <TopBar title={c.name} subtitle={c.billing_email ?? "No billing email"} />

      <div className="px-6 py-6 space-y-4">
        <Link to="/dashboard/crm/clients" className="text-xs text-muted-foreground hover:text-foreground dark:text-[#EEF1FA] inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> All clients
        </Link>

        {/* Header summary */}
        <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2 space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-extrabold text-foreground dark:text-[#EEF1FA]">{c.name}</h2>
              <StatusPill status={c.status} />
              <button
                onClick={deleteClient}
                disabled={deleting}
                title="Delete client"
                className="ml-auto p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <InfoLine icon={Mail} value={c.billing_email} />
            <InfoLine icon={Phone} value={c.phone} />
            <InfoLine icon={MapPin} value={[c.city, c.region, c.country].filter(Boolean).join(", ") || null} />
            {c.gbp_connection_id && (
              <Link to={`/portal/${c.gbp_connection_id}`} className="text-xs text-[#0078D7] hover:underline inline-flex items-center gap-1 mt-2">
                <ExternalLink className="w-3 h-3" /> Open linked GBP portal
              </Link>
            )}
          </div>
          <SummaryStat label="Subscriptions" value={String(detail.subscriptions.length)} />
          <SummaryStat label="Open Invoices" value={String(detail.invoices.filter((i) => i.status === "open").length)} />
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-border dark:border-white/10">
          {([
            ["overview", "Overview"],
            ["health", "Health"],
            ["vault", "Vault"],
            ["subscriptions", "Subscriptions"],
            ["invoices", "Invoices"],
            ["payments", "Payments"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                "px-4 py-2 text-sm font-semibold transition-colors -mb-px border-b-2",
                tab === key
                  ? "text-[#0078D7] border-[#0078D7]"
                  : "text-muted-foreground border-transparent hover:text-foreground dark:text-[#EEF1FA]",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <ContactsPanel detail={detail} reload={reload} />
        )}
        {tab === "health" && (
          <HealthPanel clientId={detail.client.id} />
        )}
        {tab === "vault" && (
          <VaultPanel clientId={detail.client.id} />
        )}
        {tab === "subscriptions" && (
          <SubscriptionsPanel detail={detail} reload={reload} />
        )}
        {tab === "invoices" && (
          <InvoicesPanel detail={detail} reload={reload} />
        )}
        {tab === "payments" && (
          <PaymentsPanel detail={detail} />
        )}
      </div>
    </DashboardLayout>
  );
}

function InfoLine({ icon: Icon, value }: { icon: React.ElementType; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon className="w-3 h-3 text-muted-foreground" />
      {value}
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">{label}</div>
      <div className="text-xl font-extrabold text-foreground dark:text-[#EEF1FA]">{value}</div>
    </div>
  );
}

// ─── Tab: Contacts (overview) ────────────────────────────────────────────
function ContactsPanel({ detail, reload }: { detail: NonNullable<ReturnType<typeof useCrmClient>["detail"]>; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const submit = async () => {
    if (!name.trim()) return;
    await crm("contacts.upsert", { client_id: detail.client.id, name, email: email || null, phone: phone || null });
    setName(""); setEmail(""); setPhone(""); setAdding(false); reload();
  };
  const remove = async (id: string) => { await crm("contacts.delete", { id }); reload(); };

  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">Contacts</h3>
        <button onClick={() => setAdding(!adding)} className="text-xs text-[#0078D7] hover:underline inline-flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>
      {adding && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3 p-3 bg-muted/40 dark:bg-white/3 border border-border dark:border-white/10 rounded-lg">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="bg-[#0A1120] border border-border dark:border-white/10 rounded-md px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA]" />
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="bg-[#0A1120] border border-border dark:border-white/10 rounded-md px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="bg-[#0A1120] border border-border dark:border-white/10 rounded-md px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA]" />
          <button onClick={submit} className="bg-[#0078D7] hover:bg-[#00447A] text-white font-bold text-sm rounded-md">Save</button>
        </div>
      )}
      {detail.contacts.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No contacts yet.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {detail.contacts.map((p) => (
            <li key={p.id} className="flex items-center justify-between py-2.5">
              <div>
                <div className="text-sm font-semibold text-foreground dark:text-[#EEF1FA]">{(p as Record<string,unknown>).name as string ?? p.full_name} {p.role && <span className="text-muted-foreground font-normal">· {p.role}</span>}</div>
                <div className="text-xs text-muted-foreground">{p.email ?? "—"} {p.phone && `· ${p.phone}`}</div>
              </div>
              <button onClick={() => remove(p.id)} className="p-1 text-muted-foreground hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Tab: Subscriptions ──────────────────────────────────────────────────
function SubscriptionsPanel({ detail, reload }: { detail: NonNullable<ReturnType<typeof useCrmClient>["detail"]>; reload: () => void }) {
  const { products } = useCrmProducts();
  const [pid, setPid] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subs = products.filter((p) => p.type === "subscription" && p.active);

  const add = async () => {
    if (!pid) return;
    setBusy(true); setErr(null);
    try {
      await crm("subscriptions.create", { client_id: detail.client.id, product_id: pid, quantity: 1 });
      setPid(""); reload();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this subscription at period end?")) return;
    await crm("subscriptions.cancel", { id, at_period_end: true });
    reload();
  };

  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider mb-4">Subscriptions</h3>

      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/40 dark:bg-white/3 border border-border dark:border-white/10 rounded-lg">
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="flex-1 min-w-[200px] bg-[#0A1120] border border-border dark:border-white/10 rounded-md px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA]">
          <option value="">Choose a plan…</option>
          {subs.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.unit_amount_cents, p.currency)} / {p.interval}</option>)}
        </select>
        <button disabled={!pid || busy} onClick={add} className="bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white font-bold text-sm px-4 py-2 rounded-md inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {busy ? "Adding…" : "Add Subscription"}
        </button>
      </div>
      {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

      {detail.subscriptions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No active subscriptions.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {detail.subscriptions.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-lg bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center"><Repeat className="w-3.5 h-3.5" /></span>
                <div>
                  <div className="text-sm font-semibold text-foreground dark:text-[#EEF1FA]">{s.product_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {fmtMoney((s.unit_amount_cents ?? 0) * s.quantity, s.currency)} / {s.interval ?? "month"}
                    {s.current_period_end && ` · renews ${new Date(s.current_period_end).toLocaleDateString()}`}
                    {s.cancel_at_period_end ? " · cancels at period end" : ""}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill status={s.status} />
                {s.status !== "canceled" && <button onClick={() => cancel(s.id)} className="text-xs text-muted-foreground hover:text-red-400">Cancel</button>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Tab: Invoices ───────────────────────────────────────────────────────
function InvoicesPanel({ detail, reload }: { detail: NonNullable<ReturnType<typeof useCrmClient>["detail"]>; reload: () => void }) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setComposing(true)} className="bg-[#0078D7] hover:bg-[#00447A] text-white text-sm font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Invoice
        </button>
      </div>
      <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border dark:border-white/10 bg-muted/40 dark:bg-white/3">
              <Th>Number</Th><Th>Status</Th><Th>Issued</Th><Th>Due</Th>
              <Th className="text-right">Total</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {detail.invoices.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No invoices yet.</td></tr>}
            {detail.invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border dark:border-white/5">
                <td className="px-4 py-3 text-sm font-semibold text-foreground dark:text-[#EEF1FA]">{inv.number ?? inv.id.slice(0, 8)}</td>
                <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-foreground dark:text-[#EEF1FA]">{fmtMoney(inv.total_cents, inv.currency)}</td>
                <td className="px-4 py-3 text-right">
                  {inv.hosted_invoice_url && (
                    <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0078D7] hover:underline inline-flex items-center gap-1">
                      View <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {composing && <InvoiceComposer clientId={detail.client.id} onClose={() => setComposing(false)} onSent={() => { setComposing(false); reload(); }} />}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}>{children}</th>;
}

function ErrorDebug({ id, error }: { id?: string; error?: string | null }) {
  const [raw, setRaw] = useState<string | null>(null);
  useEffect(() => {
    if (!id) return;
    crm("clients.get", { id })
      .then((d) => setRaw(JSON.stringify(d, null, 2)))
      .catch((e) => setRaw(`Error: ${(e as Error).message}`));
  }, [id]);
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 space-y-2">
      <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertCircle className="w-4 h-4" />
        {error ?? "Could not load client"}
      </div>
      {raw && (
        <pre className="text-[10px] font-mono text-muted-foreground bg-muted/40 rounded p-3 overflow-x-auto max-h-48">{raw}</pre>
      )}
      <p className="text-xs text-muted-foreground">Client ID: <code className="font-mono">{id}</code></p>
    </div>
  );
}

function InvoiceComposer({ clientId, onClose, onSent }: { clientId: string; onClose: () => void; onSent: () => void }) {
  type Item = { description: string; quantity: number; unit_amount_cents: number; product_id?: string };
  const { products } = useCrmProducts();
  const [items, setItems] = useState<Item[]>([{ description: "", quantity: 1, unit_amount_cents: 0 }]);
  const [dueDays, setDueDays] = useState(14);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sendNow, setSendNow] = useState(true);

  const subtotal = items.reduce((s, i) => s + i.unit_amount_cents * (i.quantity || 1), 0);

  const updateItem = (i: number, patch: Partial<Item>) => {
    setItems((arr) => arr.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  };
  const addRow = () => setItems((a) => [...a, { description: "", quantity: 1, unit_amount_cents: 0 }]);
  const removeRow = (i: number) => setItems((a) => a.filter((_, idx) => idx !== i));
  const applyProduct = (i: number, pid: string) => {
    const p = products.find((x) => x.id === pid);
    if (!p) return;
    updateItem(i, { description: p.name, unit_amount_cents: p.unit_amount_cents, product_id: p.id });
  };

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      const cleaned = items.filter((i) => i.description && i.unit_amount_cents > 0);
      if (cleaned.length === 0) throw new Error("Add at least one line item with a price.");
      const result = await crm<{ id: string }>("invoices.create", {
        client_id: clientId,
        items: cleaned,
        due_days: dueDays,
      });
      if (sendNow) await crm("invoices.send", { id: result.id });
      onSent();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-[#0A1120] border border-border dark:border-white/10 rounded-2xl p-6 m-4 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
        <h2 className="text-lg font-bold text-foreground dark:text-[#EEF1FA] mb-4">New Invoice</h2>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select onChange={(e) => applyProduct(i, e.target.value)} value={it.product_id ?? ""} className="col-span-3 bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-md px-2 py-2 text-xs text-foreground dark:text-[#EEF1FA]">
                <option value="">Custom…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Description" className="col-span-5 bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-md px-3 py-2 text-sm text-foreground dark:text-[#EEF1FA]" />
              <input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value || "1") })} className="col-span-1 bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-md px-2 py-2 text-sm text-foreground dark:text-[#EEF1FA]" />
              <input type="number" step="0.01" placeholder="0.00" value={it.unit_amount_cents ? String(it.unit_amount_cents / 100) : ""} onChange={(e) => updateItem(i, { unit_amount_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} className="col-span-2 bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-md px-2 py-2 text-sm text-foreground dark:text-[#EEF1FA]" />
              <button onClick={() => removeRow(i)} className="col-span-1 text-muted-foreground hover:text-red-400 justify-self-center"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button onClick={addRow} className="text-xs text-[#0078D7] hover:underline inline-flex items-center gap-1 mt-2">
            <Plus className="w-3.5 h-3.5" /> Add line item
          </button>
        </div>

        <div className="mt-4 pt-4 border-t border-border dark:border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              Due in
              <input type="number" min={1} max={90} value={dueDays} onChange={(e) => setDueDays(parseInt(e.target.value || "14"))} className="w-16 bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-md px-2 py-1 text-sm text-foreground dark:text-[#EEF1FA]" />
              days
            </label>
            <label className="text-xs text-muted-foreground flex items-center gap-2">
              <input type="checkbox" checked={sendNow} onChange={(e) => setSendNow(e.target.checked)} /> Email now
            </label>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Total</div>
            <div className="text-xl font-extrabold text-foreground dark:text-[#EEF1FA]">{fmtMoney(subtotal)}</div>
          </div>
        </div>

        {err && <p className="mt-3 text-xs text-red-400">{err}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground dark:text-[#EEF1FA]">Cancel</button>
          <button disabled={busy} onClick={submit} className="bg-[#0078D7] hover:bg-[#00447A] disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
            <Send className="w-3.5 h-3.5" /> {busy ? "Sending…" : sendNow ? "Create & Send" : "Create Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Payments ───────────────────────────────────────────────────────
function PaymentsPanel({ detail }: { detail: NonNullable<ReturnType<typeof useCrmClient>["detail"]> }) {
  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border dark:border-white/10 bg-muted/40 dark:bg-white/3">
            <Th>Date</Th><Th>Method</Th><Th>Reference</Th><Th className="text-right">Amount</Th>
          </tr>
        </thead>
        <tbody>
          {detail.payments.length === 0 && <tr><td colSpan={4} className="py-8 text-center text-xs text-muted-foreground">No payments recorded.</td></tr>}
          {detail.payments.map((p) => (
            <tr key={p.id} className="border-b border-border dark:border-white/5">
              <td className="px-4 py-3 text-sm text-muted-foreground">{new Date(p.paid_at).toLocaleString()}</td>
              <td className="px-4 py-3 text-sm text-muted-foreground capitalize">{p.method ?? "—"}</td>
              <td className="px-4 py-3 text-xs text-muted-foreground">{p.stripe_payment_id ?? "—"}</td>
              <td className="px-4 py-3 text-right text-sm font-bold text-[#22C55E]">{fmtMoney(p.amount_cents, p.currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
