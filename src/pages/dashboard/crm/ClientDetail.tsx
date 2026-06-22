import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ExternalLink, Mail, Phone, MapPin, Plus, Send, Trash2, Repeat, AlertCircle, Pencil, Star, X, Check, User, Save, Printer, FileText, LayoutDashboard } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmClient, useCrmProducts } from "@/hooks/useCrm";
import { crm, fmtMoney, CrmClient, CrmInvoice } from "@/lib/crm";
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
  const [editingHeader, setEditingHeader] = useState(false);

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
        {editingHeader ? (
          <ClientEditForm client={c} onSaved={() => { setEditingHeader(false); reload(); }} onCancel={() => setEditingHeader(false)} />
        ) : (
          <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-1">
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-extrabold text-foreground dark:text-[#EEF1FA]">{c.name}</h2>
                <StatusSelectPill clientId={c.id} status={c.status} onUpdated={reload} />
                <div className="ml-auto flex items-center gap-1">
                  {c.gbp_connection_id && (
                    <a
                      href={`/portal/${c.gbp_connection_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Open client portal"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0078D7]/10 text-[#0078D7] hover:bg-[#0078D7]/20 border border-[#0078D7]/20 transition-colors"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      View Portal
                    </a>
                  )}
                  <button
                    onClick={() => setEditingHeader(true)}
                    title="Edit company details"
                    className="p-1 text-muted-foreground hover:text-[#0078D7] transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={deleteClient}
                    disabled={deleting}
                    title="Delete client"
                    className="p-1 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
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
        )}

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

// ─── Inline client detail editor ─────────────────────────────────────────
type ClientRow = Record<string, string | null>;

function ClientEditForm({ client, onSaved, onCancel }: { client: ClientRow; onSaved: () => void; onCancel: () => void }) {
  const fields: { key: string; label: string; type?: string; placeholder?: string }[] = [
    { key: "name",          label: "Business Name",  placeholder: "Acme Corp" },
    { key: "billing_email", label: "Billing Email",  type: "email", placeholder: "billing@company.com" },
    { key: "phone",         label: "Phone",          type: "tel",   placeholder: "+1 (555) 000-0000" },
    { key: "address_line1", label: "Street Address", placeholder: "123 Main St" },
    { key: "city",          label: "City",           placeholder: "Vancouver" },
    { key: "region",        label: "Province / State", placeholder: "BC" },
    { key: "postal_code",   label: "Postal / ZIP",   placeholder: "V5K 0A1" },
    { key: "country",       label: "Country",        placeholder: "CA" },
    { key: "notes",         label: "Notes",          placeholder: "Internal notes…" },
  ];

  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map(({ key }) => [key, (client[key] as string) ?? ""]))
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setErr("Business name is required."); return; }
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, string | null> = { id: client.id as string };
      for (const { key } of fields) payload[key] = form[key] || null;
      await crm("clients.update", payload);
      onSaved();
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="bg-card dark:bg-[#111E33] border border-[#0078D7]/40 rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#0078D7] uppercase tracking-wider">Edit Company Details</h3>
        <button onClick={onCancel} className="p-1 text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {fields.map(({ key, label, type, placeholder }) => (
          <label key={key} className={cn("block space-y-1", key === "notes" && "sm:col-span-2 lg:col-span-3")}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            {key === "notes" ? (
              <textarea
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                rows={2}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7] resize-none"
              />
            ) : (
              <input
                type={type ?? "text"}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
              />
            )}
          </label>
        ))}
      </div>
      {err && <p className="text-xs text-red-400">{err}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground">Cancel</button>
        <button
          disabled={busy}
          onClick={save}
          className="bg-[#0078D7] hover:bg-[#0078D7]/90 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5"
        >
          <Save className="w-3.5 h-3.5" /> {busy ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>
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
type Contact = { id: string; full_name: string; email: string | null; phone: string | null; role: string | null; is_primary: number };

const emptyContact = (): Omit<Contact, "id"> => ({ full_name: "", email: "", phone: "", role: "", is_primary: 0 });

function ContactCard({
  contact,
  onSave,
  onDelete,
}: {
  contact: Contact;
  onSave: (patch: Omit<Contact, "id">) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Omit<Contact, "id">>({ ...contact });
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.full_name.trim()) return;
    setBusy(true);
    await onSave(form);
    setEditing(false);
    setBusy(false);
  };

  const cancel = () => { setForm({ ...contact }); setEditing(false); };

  if (editing) {
    return (
      <div className="rounded-xl border border-[#0078D7]/40 bg-[#0078D7]/5 p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name *</label>
            <input
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              placeholder="Jane Smith"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role / Title</label>
            <input
              value={form.role ?? ""}
              onChange={(e) => set("role", e.target.value)}
              placeholder="e.g. Owner, Marketing Manager"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</label>
            <input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value)}
              placeholder="jane@example.com"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone</label>
            <input
              type="tel"
              value={form.phone ?? ""}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 (555) 000-0000"
              className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
            />
          </div>
        </div>
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!form.is_primary}
              onChange={(e) => set("is_primary", e.target.checked ? 1 : 0)}
              className="rounded"
            />
            Primary contact
          </label>
          <div className="flex gap-2">
            <button onClick={cancel} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button
              disabled={busy || !form.full_name.trim()}
              onClick={save}
              className="bg-[#0078D7] hover:bg-[#0078D7]/90 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
            >
              <Check className="w-3.5 h-3.5" /> {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start justify-between py-3 gap-3 group">
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="w-4 h-4 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground dark:text-[#EEF1FA]">{contact.full_name}</span>
            {!!contact.is_primary && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-full px-2 py-0.5">
                <Star className="w-2.5 h-2.5 fill-current" /> Primary
              </span>
            )}
            {contact.role && (
              <span className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-2 py-0.5">{contact.role}</span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
            {contact.email && (
              <a href={`mailto:${contact.email}`} className="text-xs text-muted-foreground hover:text-[#0078D7] inline-flex items-center gap-1">
                <Mail className="w-3 h-3" /> {contact.email}
              </a>
            )}
            {contact.phone && (
              <a href={`tel:${contact.phone}`} className="text-xs text-muted-foreground hover:text-[#0078D7] inline-flex items-center gap-1">
                <Phone className="w-3 h-3" /> {contact.phone}
              </a>
            )}
            {!contact.email && !contact.phone && (
              <span className="text-xs text-muted-foreground italic">No contact info</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={() => setEditing(true)}
          title="Edit"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-[#0078D7] hover:bg-[#0078D7]/10 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          title="Delete"
          className="p-1.5 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

function ContactsPanel({ detail, reload }: { detail: NonNullable<ReturnType<typeof useCrmClient>["detail"]>; reload: () => void }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(emptyContact());
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const submitNew = async () => {
    if (!form.full_name.trim()) return;
    setBusy(true);
    await crm("contacts.upsert", {
      client_id: detail.client.id,
      full_name: form.full_name,
      email: form.email || null,
      phone: form.phone || null,
      role: form.role || null,
      is_primary: form.is_primary,
    });
    setForm(emptyContact());
    setAdding(false);
    setBusy(false);
    reload();
  };

  const saveExisting = async (id: string, patch: Omit<Contact, "id">) => {
    await crm("contacts.upsert", {
      id,
      client_id: detail.client.id,
      full_name: patch.full_name,
      email: patch.email || null,
      phone: patch.phone || null,
      role: patch.role || null,
      is_primary: patch.is_primary,
    });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Remove this contact?")) return;
    await crm("contacts.delete", { id });
    reload();
  };

  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider">Contacts</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{detail.contacts.length} {detail.contacts.length === 1 ? "person" : "people"}</p>
        </div>
        <button
          onClick={() => { setForm(emptyContact()); setAdding(true); }}
          className="bg-[#0078D7]/10 hover:bg-[#0078D7]/20 text-[#0078D7] text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Contact
        </button>
      </div>

      {/* New contact form */}
      {adding && (
        <div className="mb-4 rounded-xl border border-[#0078D7]/40 bg-[#0078D7]/5 p-4 space-y-3">
          <p className="text-xs font-bold text-[#0078D7] uppercase tracking-wider">New Contact</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Full Name *</label>
              <input
                value={form.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                placeholder="Jane Smith"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Role / Title</label>
              <input
                value={form.role ?? ""}
                onChange={(e) => set("role", e.target.value)}
                placeholder="e.g. Owner, Marketing Manager"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Email</label>
              <input
                type="email"
                value={form.email ?? ""}
                onChange={(e) => set("email", e.target.value)}
                placeholder="jane@example.com"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Phone</label>
              <input
                type="tel"
                value={form.phone ?? ""}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!!form.is_primary}
                onChange={(e) => set("is_primary", e.target.checked ? 1 : 0)}
                className="rounded"
              />
              Primary contact
            </label>
            <div className="flex gap-2">
              <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                disabled={busy || !form.full_name.trim()}
                onClick={submitNew}
                className="bg-[#0078D7] hover:bg-[#0078D7]/90 disabled:opacity-50 text-white text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" /> {busy ? "Saving…" : "Save Contact"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact list */}
      {detail.contacts.length === 0 && !adding ? (
        <div className="py-8 flex flex-col items-center gap-2 text-muted-foreground">
          <User className="w-8 h-8 opacity-30" />
          <p className="text-sm">No contacts yet. Add the first one above.</p>
        </div>
      ) : (
        <div className="divide-y divide-border dark:divide-white/5">
          {(detail.contacts as Contact[]).map((c) => (
            <ContactCard
              key={c.id}
              contact={c}
              onSave={(patch) => saveExisting(c.id, patch)}
              onDelete={() => remove(c.id)}
            />
          ))}
        </div>
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
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="flex-1 min-w-[200px] bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground">
          <option value="">Choose a plan…</option>
          {subs.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.unit_amount_cents, p.currency)} / {p.interval}</option>)}
        </select>
        <button disabled={!pid || busy} onClick={add} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-sm px-4 py-2 rounded-md inline-flex items-center gap-1.5">
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
  const [viewing, setViewing] = useState<(typeof detail.invoices)[0] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setComposing(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> New Invoice
        </button>
      </div>
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <Th>Number</Th><Th>Status</Th><Th>Issued</Th><Th>Due</Th>
              <Th className="text-right">Total</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {detail.invoices.length === 0 && <tr><td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">No invoices yet.</td></tr>}
            {detail.invoices.map((inv) => (
              <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3 text-sm font-semibold text-foreground">{inv.number ?? inv.id.slice(0, 8)}</td>
                <td className="px-4 py-3"><StatusPill status={inv.status} /></td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.issued_at ? new Date(inv.issued_at).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-xs text-muted-foreground">{inv.due_date ? new Date(inv.due_date).toLocaleDateString() : "—"}</td>
                <td className="px-4 py-3 text-right text-sm font-bold text-foreground">{fmtMoney(inv.total_cents, inv.currency)}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => setViewing(inv)}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <FileText className="w-3 h-3" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {composing && <InvoiceComposer clientId={detail.client.id} onClose={() => setComposing(false)} onSent={() => { setComposing(false); reload(); }} />}
      {viewing && <InvoicePreviewModal invoice={viewing} client={detail.client} onClose={() => setViewing(null)} onReload={reload} />}
    </div>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground ${className ?? ""}`}>{children}</th>;
}

const STATUS_OPTIONS = ["lead", "prospect", "active", "paused", "churned"] as const;
const STATUS_STYLES: Record<string, string> = {
  active:   "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30",
  lead:     "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
  prospect: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30",
  paused:   "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  churned:  "bg-muted text-muted-foreground border-border",
};

function StatusSelectPill({ clientId, status, onUpdated }: { clientId: string; status: string; onUpdated: () => void }) {
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
    } catch { setCurrent(prev); }
    finally { setSaving(false); }
  };

  const style = STATUS_STYLES[current] ?? "bg-muted text-muted-foreground border-border";
  return (
    <select
      value={current}
      onChange={onChange}
      disabled={saving}
      className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 cursor-pointer focus:outline-none disabled:opacity-60 transition-colors appearance-none ${style}`}
    >
      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
    </select>
  );
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

function InvoicePreviewModal({ invoice, client, onClose, onReload }: {
  invoice: CrmInvoice;
  client: CrmClient;
  onClose: () => void;
  onReload: () => void;
}) {
  const [marking, setMarking] = useState(false);
  const items: Array<{ description: string; quantity: number; unit_amount_cents: number }> =
    invoice.line_items ? JSON.parse(invoice.line_items as unknown as string) : [];

  const markPaid = async () => {
    setMarking(true);
    try {
      await crm("invoices.markPaid", { id: invoice.id });
      onReload();
      onClose();
    } finally { setMarking(false); }
  };

  const statusColors: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    open: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
    paid: "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800",
    past_due: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-card border border-border rounded-2xl shadow-2xl">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-muted/30 rounded-t-2xl print:hidden">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Invoice Preview</span>
          <div className="flex items-center gap-2">
            {invoice.status === "open" && (
              <button
                onClick={markPaid}
                disabled={marking}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
              >
                {marking ? "Saving…" : "Mark as Paid"}
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-foreground transition-colors inline-flex items-center gap-1.5"
            >
              <Printer className="w-3.5 h-3.5" /> Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Invoice Document */}
        <div className="p-8 space-y-8">

          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">INVOICE</h1>
              <p className="text-lg font-bold text-primary mt-0.5">{invoice.number ?? invoice.id.slice(0, 8)}</p>
            </div>
            <span className={cn(
              "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
              statusColors[invoice.status] ?? statusColors.draft,
            )}>
              {invoice.status}
            </span>
          </div>

          {/* Agency + Client */}
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">From</p>
              <p className="text-sm font-bold text-foreground">Citywide Digital</p>
              <p className="text-xs text-muted-foreground mt-0.5">alan@citywidedigital.ca</p>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Bill To</p>
              <p className="text-sm font-bold text-foreground">{client.name}</p>
              {client.billing_email && <p className="text-xs text-muted-foreground">{client.billing_email}</p>}
              {client.phone && <p className="text-xs text-muted-foreground">{client.phone}</p>}
              {client.address_line1 && <p className="text-xs text-muted-foreground">{client.address_line1}</p>}
              {(client.city || client.region) && (
                <p className="text-xs text-muted-foreground">
                  {[client.city, client.region, client.postal_code].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Issue Date", value: invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "—" },
              { label: "Due Date", value: invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "—" },
              { label: "Paid Date", value: invoice.paid_at ? new Date(invoice.paid_at).toLocaleDateString("en-CA", { year: "numeric", month: "long", day: "numeric" }) : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-muted/40 rounded-xl px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
              </div>
            ))}
          </div>

          {/* Line Items */}
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-border">
                  <th className="text-left py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Description</th>
                  <th className="text-center py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-16">Qty</th>
                  <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Unit Price</th>
                  <th className="text-right py-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-28">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr><td colSpan={4} className="py-6 text-center text-xs text-muted-foreground italic">No line items</td></tr>
                ) : items.map((item, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-3 text-foreground">{item.description}</td>
                    <td className="py-3 text-center text-muted-foreground">{item.quantity}</td>
                    <td className="py-3 text-right text-muted-foreground">{fmtMoney(item.unit_amount_cents, invoice.currency)}</td>
                    <td className="py-3 text-right font-semibold text-foreground">{fmtMoney(item.unit_amount_cents * item.quantity, invoice.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Subtotal</span>
                <span>{fmtMoney(invoice.subtotal_cents ?? invoice.total_cents, invoice.currency)}</span>
              </div>
              {(invoice.tax_cents ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Tax</span>
                  <span>{fmtMoney(invoice.tax_cents!, invoice.currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-foreground border-t border-border pt-2">
                <span>Total</span>
                <span>{fmtMoney(invoice.total_cents, invoice.currency)}</span>
              </div>
              {invoice.status === "paid" && (
                <div className="flex justify-between text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>Amount Paid</span>
                  <span>{fmtMoney(invoice.amount_paid_cents ?? invoice.total_cents, invoice.currency)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <p className="text-xs text-muted-foreground text-center border-t border-border pt-4">
            Thank you for your business.
          </p>
        </div>
      </div>
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
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-background border border-border rounded-2xl p-6 m-4 shadow-2xl">
        <h2 className="text-lg font-bold text-foreground dark:text-[#EEF1FA] mb-4">New Invoice</h2>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <select onChange={(e) => applyProduct(i, e.target.value)} value={it.product_id ?? ""} className="col-span-3 bg-background border border-border rounded-md px-2 py-2 text-xs text-foreground">
                <option value="">Custom…</option>
                {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input value={it.description} onChange={(e) => updateItem(i, { description: e.target.value })} placeholder="Description" className="col-span-5 bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
              <input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(i, { quantity: parseInt(e.target.value || "1") })} className="col-span-1 bg-background border border-border rounded-md px-2 py-2 text-sm text-foreground" />
              <input type="number" step="0.01" placeholder="0.00" value={it.unit_amount_cents ? String(it.unit_amount_cents / 100) : ""} onChange={(e) => updateItem(i, { unit_amount_cents: Math.round(parseFloat(e.target.value || "0") * 100) })} className="col-span-2 bg-background border border-border rounded-md px-2 py-2 text-sm text-foreground placeholder:text-muted-foreground" />
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
              <input type="number" min={1} max={90} value={dueDays} onChange={(e) => setDueDays(parseInt(e.target.value || "14"))} className="w-16 bg-background border border-border rounded-md px-2 py-1 text-sm text-foreground" />
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
          <button disabled={busy} onClick={submit} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground text-sm font-bold px-4 py-2 rounded-lg inline-flex items-center gap-1.5">
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
