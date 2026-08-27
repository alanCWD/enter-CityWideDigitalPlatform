import { useState, useEffect } from "react";
import { useParams, Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, Mail, Phone, MapPin, Plus, Send, Trash2, Repeat, AlertCircle, Pencil, Star, X, Check, User, Save, Printer, FileText, LayoutDashboard, Link2, UserPlus, Eye, RefreshCw, Store, Globe, MessageCircle, Pause, Play, ChevronDown } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";
import { useCrmClient, useCrmProducts } from "@/hooks/useCrm";
import { crm, fmtMoney, CrmClient, CrmInvoice } from "@/lib/crm";
import { StatusPill } from "@/components/crm/StatusPill";
import { VaultPanel } from "@/components/crm/vault/VaultPanel";
import { HealthPanel } from "@/components/crm/health/HealthPanel";
import { QuickBooksPanel } from "@/components/crm/quickbooks/QuickBooksPanel";
import { LedgerBridgePanel } from "@/components/crm/quickbooks/LedgerBridgePanel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LinkZernioProfileDialog } from "@/components/dashboard/crm/LinkZernioProfileDialog";
import { InviteClientDialog } from "@/components/dashboard/InviteClientDialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const ADMIN_EMAIL = "alan@citywidedigital.ca";
function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user?.email === ADMIN_EMAIL);
    });
  }, []);
  return isAdmin;
}

export function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { detail, loading, error, reload } = useCrmClient(id);
  const isAdmin = useIsAdmin();
  const { toast } = useToast();
  const [tab, setTab] = useState<"overview" | "health" | "vault" | "subscriptions" | "invoices" | "payments" | "gbp" | "integrations">("overview");
  const [integration, setIntegration] = useState<"qb-review" | "ledgerbridge">("qb-review");
  const [deleting, setDeleting] = useState(false);
  const [editingHeader, setEditingHeader] = useState(false);
  const [showLinkZernio, setShowLinkZernio] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  // Handle GBP OAuth redirect-back
  useEffect(() => {
    const gbp = searchParams.get("gbp");
    const gbpError = searchParams.get("gbp_error");
    const business = searchParams.get("business");
    if (gbp === "connected") {
      reload();
      toast({ title: `${business ? `"${business}"` : "Business profile"} connected`, description: "All GBP data has been synced automatically." });
      setSearchParams({}, { replace: true });
      setTab("gbp");
    } else if (gbpError) {
      toast({ title: "GBP connect failed", description: gbpError, variant: "destructive" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  // Handle QBO OAuth redirect-back
  useEffect(() => {
    const qbo = searchParams.get("qbo");
    const qboError = searchParams.get("qbo_error");
    if (qbo === "connected") {
      toast({ title: "QuickBooks Online connected", description: "Invoice-paid review requests are now active." });
      setSearchParams({}, { replace: true });
      setIntegration("qb-review");
      setTab("integrations");
    } else if (qboError) {
      toast({ title: "QuickBooks connect failed", description: qboError, variant: "destructive" });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const previewPortal = async (connectionId: string) => {
    // Open the tab immediately (synchronous, within the click event) so browsers
    // don't block it as a popup. Then navigate once the RPC responds.
    const tab = window.open("about:blank", "_blank");
    setPreviewing(true);
    try {
      // Use a DB security-definer RPC to link this admin user to the portal
      // connection without needing an edge function call.
      const { error } = await supabase.rpc("link_admin_to_portal", {
        p_connection_id: connectionId,
      } as never);
      if (error) {
        tab?.close();
        toast({ title: "Could not open portal", description: error.message, variant: "destructive" });
        return;
      }
      const portalUrl = `/portal/${connectionId}`;
      if (tab) {
        tab.location.href = portalUrl;
      } else {
        // Popup was blocked — fall back to same-tab navigation
        window.location.href = portalUrl;
      }
    } catch (e) {
      tab?.close();
      toast({ title: "Could not open portal", description: String(e), variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  if (loading) {
    return <DashboardLayout><TopBar title="Loading…" /></DashboardLayout>;
  }

  // A valid portal connection must be a proper UUID (gbp_connections.id).
  // Some clients may have a legacy/Zernio profile ID stored instead.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const portalConnectionId = detail?.client?.gbp_connection_id && UUID_RE.test(detail.client.gbp_connection_id)
    ? detail.client.gbp_connection_id
    : null;

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
                  {portalConnectionId ? (
                    <button
                      onClick={() => previewPortal(portalConnectionId)}
                      disabled={previewing}
                      title="Open client portal"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[#0078D7]/10 text-[#0078D7] hover:bg-[#0078D7]/20 border border-[#0078D7]/20 transition-colors disabled:opacity-50"
                    >
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      View Portal
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowLinkZernio(true)}
                      title="Link a business profile to activate portal"
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      Link Profile
                    </button>
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
              {portalConnectionId && (
                <button onClick={() => previewPortal(portalConnectionId)} disabled={previewing} className="text-xs text-[#0078D7] hover:underline inline-flex items-center gap-1 mt-2 disabled:opacity-50">
                  <ExternalLink className="w-3 h-3" /> Open linked GBP portal
                </button>
              )}
            </div>
            <SummaryStat label="Subscriptions" value={String(detail.subscriptions.length)} />
            <SummaryStat label="Open Invoices" value={String(detail.invoices.filter((i) => i.status === "open").length)} />
          </div>
        )}

        {/* Portal setup / link banner */}
        {!portalConnectionId ? (
          <div className="flex items-center justify-between bg-amber-500/8 border border-amber-500/25 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-bold text-amber-600 dark:text-amber-400">Client portal not connected</p>
              <p className="text-xs text-amber-600/70 dark:text-amber-400/60 mt-0.5">
                Link a business profile to activate this client's portal.
              </p>
            </div>
            <button
              onClick={() => setShowLinkZernio(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold bg-amber-500 hover:bg-amber-600 text-white transition-colors flex-shrink-0 ml-4"
            >
              <Link2 className="w-4 h-4" />
              Link Business Profile
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-[#0078D7]/8 border border-[#0078D7]/20 rounded-xl px-5 py-3.5">
            <div>
              <p className="text-sm font-bold text-[#0078D7]">Client portal active</p>
              <p className="text-xs text-[#0078D7]/60 mt-0.5">
                Business profile is connected. Invite the client to give them access.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0 ml-4 flex-wrap justify-end">
              <button
                onClick={() => setShowLinkZernio(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white/5 text-muted-foreground hover:text-foreground border border-border transition-colors"
              >
                <Link2 className="w-3.5 h-3.5" />
                Change Profile
              </button>
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#22C55E]/10 text-[#22C55E] hover:bg-[#22C55E]/20 border border-[#22C55E]/25 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Invite Client
              </button>
              <button
                onClick={() => previewPortal(portalConnectionId)}
                disabled={previewing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border border-purple-500/25 transition-colors disabled:opacity-50"
              >
                <Eye className="w-3.5 h-3.5" />
                {previewing ? "Opening…" : "Preview as Admin"}
              </button>
              <button
                onClick={() => previewPortal(portalConnectionId)}
                disabled={previewing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[#0078D7] hover:bg-[#005FA3] text-white transition-colors disabled:opacity-50"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                View Portal
              </button>
            </div>
          </div>
        )}

        {/* Tabs */}
        {(() => {
          const tabs: { key: typeof tab; label: string }[] = [
            { key: "overview", label: "Overview" },
            { key: "health", label: "Health" },
            { key: "vault", label: "Vault" },
            ...(c.gbp_connection_id ? [{ key: "gbp" as const, label: "GBP / NAP" }] : []),
            { key: "subscriptions", label: "Subscriptions" },
            { key: "invoices", label: "Invoices" },
            { key: "payments", label: "Payments" },
            { key: "integrations" as const, label: "Integrations" },
          ];
          return (
            <div className="flex flex-wrap gap-1 border-b border-border dark:border-white/10">
              {tabs.map(({ key, label }) => (
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
          );
        })()}

        {tab === "overview" && (
          <ContactsPanel detail={detail} reload={reload} />
        )}
        {tab === "health" && (
          <HealthPanel clientId={detail.client.id} />
        )}
        {tab === "vault" && (
          <VaultPanel clientId={detail.client.id} />
        )}
        {tab === "gbp" && c.gbp_connection_id && (
          <GbpPanel connectionId={c.gbp_connection_id} />
        )}
        {tab === "integrations" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-card dark:bg-[#111E33] border border-border dark:border-white/10 text-foreground dark:text-[#EEF1FA] transition-colors hover:border-[#0078D7]/40">
                    {integration === "qb-review" ? "QB Review Requests" : "Clover+QB LedgerBridge"}
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                  <DropdownMenuItem
                    onClick={() => setIntegration("qb-review")}
                    className={cn("cursor-pointer", integration === "qb-review" && "bg-accent text-accent-foreground")}
                  >
                    <span className="flex-1">QB Review Requests</span>
                    {integration === "qb-review" && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setIntegration("ledgerbridge")}
                    className={cn("cursor-pointer", integration === "ledgerbridge" && "bg-accent text-accent-foreground")}
                  >
                    <span className="flex-1">Clover+QB LedgerBridge</span>
                    {integration === "ledgerbridge" && <Check className="w-4 h-4" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <span className="text-xs text-muted-foreground">
                {integration === "qb-review"
                  ? "Automatically send review requests when an invoice is marked paid."
                  : "Clover → QuickBooks daily sync status."}
              </span>
            </div>

            {integration === "qb-review" ? (
              <QuickBooksPanel clientId={c.id} clientEmail={c.billing_email} />
            ) : (
              <LedgerBridgePanel />
            )}
          </div>
        )}
        {tab === "subscriptions" && (
          <SubscriptionsPanel detail={detail} reload={reload} isAdmin={isAdmin} />
        )}
        {tab === "invoices" && (
          <InvoicesPanel detail={detail} reload={reload} isAdmin={isAdmin} />
        )}
        {tab === "payments" && (
          <PaymentsPanel detail={detail} />
        )}
      </div>

      {showLinkZernio && (
        <LinkZernioProfileDialog
          crmClientId={c.id}
          clientName={c.name}
          currentConnectionId={c.gbp_connection_id}
          onLinked={(connectionId) => {
            setShowLinkZernio(false);
            reload();
          }}
          onClose={() => setShowLinkZernio(false)}
        />
      )}

      {showInvite && portalConnectionId && (
        <InviteClientDialog
          connectionId={portalConnectionId}
          businessName={c.name}
          onClose={() => setShowInvite(false)}
        />
      )}
    </DashboardLayout>
  );
}

// ─── Inline client detail editor ─────────────────────────────────────────
type ClientRow = Record<string, string | null>;

const CLIENT_STATUS_OPTIONS = ["lead", "prospect", "active", "paused", "churned"] as const;

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

  const [form, setForm] = useState<Record<string, string>>(() => ({
    status: (client.status as string) ?? "lead",
    ...Object.fromEntries(fields.map(({ key }) => [key, (client[key] as string) ?? ""])),
  }));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.name.trim()) { setErr("Business name is required."); return; }
    setBusy(true); setErr(null);
    try {
      const payload: Record<string, string | null> = { id: client.id as string, status: form.status };
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
        {/* Status select */}
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</span>
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-[#0078D7]"
          >
            {CLIENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
        </label>
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
function SubscriptionsPanel({ detail, reload, isAdmin }: { detail: NonNullable<ReturnType<typeof useCrmClient>["detail"]>; reload: () => void; isAdmin: boolean }) {
  const { products } = useCrmProducts();
  const { toast } = useToast();
  const [pid, setPid] = useState("");
  const [collectionMethod, setCollectionMethod] = useState<"charge_automatically" | "send_invoice">("charge_automatically");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const subs = products.filter((p) => p.type === "subscription" && p.active);

  const add = async () => {
    if (!pid) return;
    setBusy(true); setErr(null);
    try {
      const result = await crm<{ id: string; stripe_warning?: string | null }>("subscriptions.create", { client_id: detail.client.id, product_id: pid, quantity: 1, collection_method: collectionMethod });
      setPid(""); reload();
      if (result.stripe_warning) {
        setErr(`Subscription created locally, but Stripe sync failed: ${result.stripe_warning}`);
      }
    } catch (e) { setErr((e as Error).message); }
    finally { setBusy(false); }
  };

  const cancel = async (id: string) => {
    if (!confirm("Cancel this subscription at period end? This will also cancel it in Stripe.")) return;
    await crm("subscriptions.cancel", { id, at_period_end: true });
    reload();
  };

  const deleteNow = async (id: string) => {
    if (!confirm("Delete this subscription immediately? This will cancel it in Stripe right now.")) return;
    await crm("subscriptions.delete", { id });
    reload();
  };

  const pauseBilling = async (id: string) => {
    if (!confirm("Pause billing for this subscription? No invoices will be generated in Stripe until you resume it.")) return;
    setBusy(true); setErr(null);
    try {
      await crm("subscriptions.pause", { id });
      reload();
    } catch (e) { setErr(`Pause failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const resumeBilling = async (id: string) => {
    setBusy(true); setErr(null);
    try {
      await crm("subscriptions.resume", { id });
      reload();
    } catch (e) { setErr(`Resume failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const syncStripe = async (id: string, method: "charge_automatically" | "send_invoice") => {
    setBusy(true); setErr(null);
    try {
      await crm("subscriptions.syncStripe", { id, collection_method: method });
      reload();
    } catch (e) { setErr(`Stripe sync failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const resendInvoice = async (id: string) => {
    setBusy(true); setErr(null);
    try {
      const result = await crm<{ ok: boolean; sent_to?: string }>("subscriptions.resendInvoice", { id });
      reload();
      toast({ title: "Invoice sent", description: result.sent_to ? `Sent to ${result.sent_to}` : "Invoice email sent successfully." });
    } catch (e) { setErr(`Resend failed: ${(e as Error).message}`); }
    finally { setBusy(false); }
  };

  const fmtDateRange = (start: string | null, end: string | null) => {
    const fmt = (d: string) => new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });
    if (start && end) return `${fmt(start)} – ${fmt(end)}`;
    if (start) return `Since ${fmt(start)}`;
    if (end) return `Until ${fmt(end)}`;
    return null;
  };

  return (
    <div className="bg-card dark:bg-[#111E33] border border-border dark:border-white/10 rounded-2xl p-5">
      <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA] uppercase tracking-wider mb-4">Subscriptions</h3>

      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-muted/40 dark:bg-white/3 border border-border dark:border-white/10 rounded-lg">
        <select value={pid} onChange={(e) => setPid(e.target.value)} className="flex-1 min-w-[200px] bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground">
          <option value="">Choose a plan…</option>
          {subs.map((p) => <option key={p.id} value={p.id}>{p.name} — {fmtMoney(p.unit_amount_cents, p.currency)} / {p.interval}</option>)}
        </select>
        <div className="flex rounded-md border border-border overflow-hidden text-xs font-semibold">
          <button
            onClick={() => setCollectionMethod("charge_automatically")}
            className={`px-3 py-2 transition-colors ${collectionMethod === "charge_automatically" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            Auto-charge
          </button>
          <button
            onClick={() => setCollectionMethod("send_invoice")}
            className={`px-3 py-2 transition-colors border-l border-border ${collectionMethod === "send_invoice" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover:bg-muted"}`}
          >
            Send Invoice
          </button>
        </div>
        <button disabled={!pid || busy} onClick={add} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-primary-foreground font-bold text-sm px-4 py-2 rounded-md inline-flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> {busy ? "Adding…" : "Add Subscription"}
        </button>
      </div>
      {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

      {detail.subscriptions.length === 0 ? (
        <p className="text-xs text-muted-foreground py-3">No active subscriptions.</p>
      ) : (
        <ul className="divide-y divide-border/50 dark:divide-white/5">
          {detail.subscriptions.map((s) => {
            const dateRange = fmtDateRange(s.start_date as string | null, s.current_period_end as string | null);
            return (
              <li key={s.id} className="flex items-center justify-between py-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="w-7 h-7 shrink-0 rounded-lg bg-[#22C55E]/15 text-[#22C55E] flex items-center justify-center"><Repeat className="w-3.5 h-3.5" /></span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground dark:text-[#EEF1FA]">{s.product_name as string}</span>
                      {!s.stripe_subscription_id && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <AlertCircle className="w-2.5 h-2.5" /> Not synced to Stripe
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {fmtMoney((s.unit_amount_cents as number ?? 0) * (s.quantity as number), s.product_currency as string)} / {s.product_interval as string ?? "month"}
                      {s.cancel_at_period_end ? " · cancels at period end" : ""}
                    </div>
                    {dateRange && (
                      <div className="text-[11px] text-muted-foreground/70 mt-0.5 font-mono">{dateRange}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusPill status={s.status as string} />
                  {s.status !== "canceled" && (
                    <>
                      {!s.stripe_subscription_id && (
                        <div className="flex items-center gap-1">
                          <button onClick={() => syncStripe(s.id as string, "charge_automatically")} disabled={busy} title="Auto-charge (card on file)" className="text-[10px] font-semibold text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50 border border-amber-500/30 rounded px-1.5 py-0.5">
                            Auto-charge
                          </button>
                          <button onClick={() => syncStripe(s.id as string, "send_invoice")} disabled={busy} title="Send invoice (no card required)" className="text-[10px] font-semibold text-amber-500 hover:text-amber-400 transition-colors disabled:opacity-50 border border-amber-500/30 rounded px-1.5 py-0.5">
                            Invoice
                          </button>
                        </div>
                      )}
                      {s.stripe_subscription_id && (
                        <button
                          onClick={() => resendInvoice(s.id as string)}
                          disabled={busy}
                          title="Resend latest invoice email (also updates customer email to current billing email)"
                          className="text-[10px] font-semibold text-sky-500 hover:text-sky-400 transition-colors disabled:opacity-50 border border-sky-500/30 rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                        >
                          <Send className="w-2.5 h-2.5" /> Resend Invoice
                        </button>
                      )}
                      {s.stripe_subscription_id && s.status !== "paused" && (
                        <button
                          onClick={() => pauseBilling(s.id as string)}
                          disabled={busy}
                          title="Pause billing — no invoices will be generated until resumed"
                          className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400 hover:text-yellow-500 transition-colors disabled:opacity-50 border border-yellow-500/30 rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                        >
                          <Pause className="w-2.5 h-2.5" /> Pause Billing
                        </button>
                      )}
                      {s.status === "paused" && (
                        <button
                          onClick={() => resumeBilling(s.id as string)}
                          disabled={busy}
                          title="Resume billing"
                          className="text-[10px] font-semibold text-[#22C55E] hover:text-[#22C55E]/80 transition-colors disabled:opacity-50 border border-[#22C55E]/30 rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                        >
                          <Play className="w-2.5 h-2.5" /> Resume Billing
                        </button>
                      )}
                      <button onClick={() => cancel(s.id as string)} className="text-xs text-muted-foreground hover:text-amber-400 transition-colors">Cancel</button>
                      {isAdmin && (
                        <button onClick={() => deleteNow(s.id as string)} className="text-xs text-red-400 hover:text-red-300 transition-colors inline-flex items-center gap-1 font-semibold">
                          <Trash2 className="w-3 h-3" /> Delete Now
                        </button>
                      )}
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ─── Tab: Invoices ───────────────────────────────────────────────────────
function InvoicesPanel({ detail, reload, isAdmin }: { detail: NonNullable<ReturnType<typeof useCrmClient>["detail"]>; reload: () => void; isAdmin: boolean }) {
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
                  <div className="flex items-center justify-end gap-2">
                    {inv.hosted_invoice_url && (
                      <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                        title="Open Stripe payment link"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    <button
                      onClick={() => setViewing(inv)}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                    >
                      <FileText className="w-3 h-3" /> View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {composing && <InvoiceComposer clientId={detail.client.id} onClose={() => setComposing(false)} onSent={() => { setComposing(false); reload(); }} />}
      {viewing && <InvoicePreviewModal invoice={viewing} client={detail.client} isAdmin={isAdmin} onClose={() => setViewing(null)} onReload={reload} />}
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

// ─── GBP / NAP Editor ────────────────────────────────────────────────────
interface GbpRecord {
  id: string;
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
  last_synced_at: string | null;
  zernio_profile_id: string | null;
  synup_location_id: string | null;
}

function GbpPanel({ connectionId }: { connectionId: string }) {
  const { toast } = useToast();
  const [record, setRecord] = useState<GbpRecord | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [synupDraft, setSynupDraft] = useState("");
  const [editingSynup, setEditingSynup] = useState(false);
  const [savingSynup, setSavingSynup] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("gbp_connections")
      .select("id,business_name,address,phone,website,category,rating,review_count,last_synced_at,zernio_profile_id,synup_location_id")
      .eq("id", connectionId)
      .maybeSingle();
    if (data) {
      setRecord(data as GbpRecord);
      setSynupDraft((data as GbpRecord).synup_location_id ?? "");
    }
    setLoading(false);
  };

  const saveSynupId = async () => {
    setSavingSynup(true);
    try {
      const val = synupDraft.trim() || null;
      const { error } = await supabase
        .from("gbp_connections")
        .update({ synup_location_id: val })
        .eq("id", connectionId);
      if (error) throw error;
      setRecord((r) => r ? { ...r, synup_location_id: val } : r);
      setEditingSynup(false);
      toast({ title: "Synup Location ID saved", description: val ? `ID: ${val}` : "Cleared." });
    } catch (e) {
      toast({ title: "Save failed", description: (e as Error).message, variant: "destructive" });
    }
    setSavingSynup(false);
  };

  useEffect(() => { load(); }, [connectionId]);

  const sync = async () => {
    if (!record?.zernio_profile_id) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("social-rpc", {
        body: { action: "zernio.syncProfile", payload: { connection_id: connectionId, zernio_profile_id: record.zernio_profile_id } },
      });
      if (error || !data?.ok) throw new Error(data?.error ?? error?.message ?? "Sync failed");
      toast({ title: "Synced from Zernio", description: (data.log as string[]).join(" · ") });
      await load();
    } catch (e) {
      toast({ title: "Sync failed", description: (e as Error).message, variant: "destructive" });
    }
    setSyncing(false);
  };

  if (loading) return <div className="py-10 text-center text-sm text-muted-foreground">Loading…</div>;
  if (!record) return <div className="py-10 text-center text-sm text-muted-foreground">No GBP data found.</div>;

  const napFields: { key: keyof GbpRecord; label: string; icon: React.ElementType }[] = [
    { key: "business_name", label: "Business Name", icon: Store },
    { key: "address", label: "Address", icon: MapPin },
    { key: "phone", label: "Phone", icon: Phone },
    { key: "website", label: "Website", icon: Globe },
    { key: "category", label: "Category", icon: MessageCircle },
    { key: "rating", label: "Rating", icon: Star },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">NAP Details</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Name, Address & Phone — synced from Google Business Profile.
              {record.last_synced_at && ` Last synced ${new Date(record.last_synced_at).toLocaleDateString()}.`}
            </p>
          </div>
          {record.zernio_profile_id && (
            <button
              onClick={sync}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Syncing…" : "Sync from Zernio"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {napFields.map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
              <Icon className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
                <div className="text-sm text-foreground mt-0.5">
                  {record[key] != null && record[key] !== ""
                    ? String(record[key])
                    : <span className="text-muted-foreground/50 italic text-xs">Not synced yet</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-extrabold text-foreground">{record.rating ?? "—"}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mt-1">Avg Rating</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 text-center">
          <div className="text-2xl font-extrabold text-foreground">{record.review_count ?? 0}</div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider font-bold mt-1">Reviews</div>
        </div>
      </div>

      {/* Synup Location ID */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h3 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
              <Globe className="w-3.5 h-3.5 text-primary" />
              Synup Integration
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Link this location to Synup to enable live Listings, Reviews &amp; SEO in the client portal.
            </p>
          </div>
          {!editingSynup && (
            <button
              onClick={() => { setSynupDraft(record.synup_location_id ?? ""); setEditingSynup(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              {record.synup_location_id ? "Edit" : "Set ID"}
            </button>
          )}
        </div>

        {editingSynup ? (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              value={synupDraft}
              onChange={(e) => setSynupDraft(e.target.value)}
              placeholder="Paste Synup Location ID…"
              className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono"
              autoFocus
            />
            <button
              onClick={saveSynupId}
              disabled={savingSynup}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {savingSynup ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => setEditingSynup(false)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="mt-3 flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border/50">
            <Globe className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            {record.synup_location_id ? (
              <span className="text-sm font-mono text-foreground">{record.synup_location_id}</span>
            ) : (
              <span className="text-sm text-muted-foreground/60 italic">Not set — portal pages will show sample data</span>
            )}
            {record.synup_location_id && (
              <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                <Check className="w-3 h-3" /> Connected
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InvoicePreviewModal({ invoice, client, isAdmin, onClose, onReload }: {
  invoice: CrmInvoice;
  client: CrmClient;
  isAdmin: boolean;
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

  const markUnpaid = async () => {
    if (!confirm("Mark this invoice as unpaid / open?")) return;
    setMarking(true);
    try {
      await crm("invoices.markUnpaid", { id: invoice.id });
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
            {invoice.hosted_invoice_url && (
              <a
                href={invoice.hosted_invoice_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Stripe Payment Link
              </a>
            )}
            {invoice.pdf_url && (
              <a
                href={invoice.pdf_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-muted hover:bg-accent text-foreground transition-colors inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" /> PDF
              </a>
            )}
            {invoice.status === "open" && (
              <button
                onClick={markPaid}
                disabled={marking}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors disabled:opacity-50"
              >
                {marking ? "Saving…" : "Mark as Paid"}
              </button>
            )}
            {invoice.status === "paid" && isAdmin && (
              <button
                onClick={markUnpaid}
                disabled={marking}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition-colors disabled:opacity-50"
              >
                {marking ? "Saving…" : "Mark as Unpaid"}
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
            <div className="flex flex-col items-end gap-2">
              <img
                src="https://grazia-prod.oss-ap-southeast-1.aliyuncs.com/resources/uid_100027458/citywide_logo_3f1986ed.png"
                crossOrigin="anonymous"
                alt="Citywide Digital"
                className="h-12 w-auto object-contain"
              />
              <span className={cn(
                "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                statusColors[invoice.status] ?? statusColors.draft,
              )}>
                {invoice.status}
              </span>
            </div>
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
          <div className="bg-muted/30 rounded-xl px-5 py-4 border border-border/50">
            <div className="flex items-center gap-1 mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Invoice Period</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Issued</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {invoice.issued_at ? new Date(invoice.issued_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                </p>
              </div>
              <div className="flex-1 border-t-2 border-dashed border-border/60 min-w-[20px]" />
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due</p>
                <p className="text-sm font-semibold text-foreground mt-0.5">
                  {invoice.due_date ? new Date(invoice.due_date).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" }) : "—"}
                </p>
              </div>
              {invoice.paid_at && (
                <>
                  <div className="flex-1 border-t-2 border-dashed border-emerald-400/40 min-w-[20px]" />
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Paid</p>
                    <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5">
                      {new Date(invoice.paid_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                    </p>
                  </div>
                </>
              )}
            </div>
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
