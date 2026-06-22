import { useState, useEffect, useCallback } from "react";
import { Plus, User, Phone, Mail, ChevronDown, ChevronUp, X } from "lucide-react";
import { PortalLayout } from "@/components/portal/PortalLayout";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type LeadStatus = "new" | "contacted" | "qualified" | "closed";

const STATUS_META: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  new:       { label: "New",       color: "text-primary",  bg: "bg-primary/15" },
  contacted: { label: "Contacted", color: "text-yellow-400", bg: "bg-yellow-400/10" },
  qualified: { label: "Qualified", color: "text-[#A855F7]",  bg: "bg-[#A855F7]/15" },
  closed:    { label: "Closed",    color: "text-[#22C55E]",  bg: "bg-[#22C55E]/10" },
};

const SOURCE_LABELS: Record<string, string> = {
  manual: "Manual Entry",
  gbp: "Google Business",
  website: "Website Form",
  phone: "Phone",
  referral: "Referral",
};

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  message: string | null;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
}

interface CrmContentProps {
  connectionId: string;
}

function CrmContent({ connectionId }: CrmContentProps) {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savingNotes, setSavingNotes] = useState<string | null>(null);
  const [localNotes, setLocalNotes] = useState<Record<string, string>>({});
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", source: "manual", message: "" });
  const [submitting, setSubmitting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("client_leads")
      .select("*")
      .eq("connection_id", connectionId)
      .order("created_at", { ascending: false });
    setLeads((data as Lead[]) ?? []);
    setLoading(false);
  }, [connectionId]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const updateStatus = async (id: string, status: LeadStatus) => {
    await supabase.from("client_leads").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, status } : l));
  };

  const saveNotes = async (id: string) => {
    setSavingNotes(id);
    const notes = localNotes[id] ?? leads.find((l) => l.id === id)?.notes ?? "";
    await supabase.from("client_leads").update({ notes, updated_at: new Date().toISOString() }).eq("id", id);
    setLeads((prev) => prev.map((l) => l.id === id ? { ...l, notes } : l));
    toast({ title: "Notes saved" });
    setSavingNotes(null);
  };

  const addLead = async () => {
    if (!form.name.trim()) return;
    setSubmitting(true);
    const { error } = await supabase.from("client_leads").insert({
      connection_id: connectionId,
      name: form.name,
      email: form.email || null,
      phone: form.phone || null,
      source: form.source,
      message: form.message || null,
      status: "new",
    });
    if (error) {
      toast({ title: "Failed to add lead", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Lead added" });
      setForm({ name: "", email: "", phone: "", source: "manual", message: "" });
      setShowForm(false);
      fetchLeads();
    }
    setSubmitting(false);
  };

  const fmt = (d: string) =>
    new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Customer CRM</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track leads, enquiries, and follow-ups.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 bg-primary hover:bg-[#005FA3] text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Lead
        </button>
      </div>

      {/* Add lead form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-[#0078D7]/30 p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm font-bold text-foreground">New Lead</span>
            <button onClick={() => setShowForm(false)} className="text-[rgba(238,241,250,0.3)] hover:text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <input placeholder="Full name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60" />
            <input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60" />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60" />
            <select value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
              className="bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/60">
              {Object.entries(SOURCE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <textarea placeholder="Message / notes (optional)" value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} rows={2}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60 resize-none" />
          <div className="flex justify-end">
            <button onClick={addLead} disabled={!form.name.trim() || submitting}
              className="bg-primary hover:bg-[#005FA3] disabled:opacity-40 text-white text-xs font-bold px-4 py-2 rounded-lg transition-colors">
              {submitting ? "Saving…" : "Add Lead"}
            </button>
          </div>
        </div>
      )}

      {/* Lead list */}
      {loading ? (
        <div className="text-center py-12 text-[rgba(238,241,250,0.3)] text-sm">Loading leads…</div>
      ) : leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-xl border border-border">
          <User className="w-8 h-8 text-[rgba(238,241,250,0.12)] mb-3" />
          <div className="text-sm font-bold text-muted-foreground">No leads yet</div>
          <div className="text-xs text-muted-foreground/50 mt-1">Add your first lead or connect a form</div>
        </div>
      ) : (
        <div className="space-y-2">
          {leads.map((lead) => {
            const meta = STATUS_META[lead.status] ?? STATUS_META.new;
            const expanded = expandedId === lead.id;
            const currentNotes = localNotes[lead.id] ?? lead.notes ?? "";

            return (
              <div key={lead.id} className="bg-card rounded-xl border border-border overflow-hidden">
                {/* Row */}
                <div className="flex items-center gap-3 px-4 py-3.5">
                  <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                    <User className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-foreground truncate">{lead.name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${meta.color} ${meta.bg}`}>
                        {meta.label}
                      </span>
                      {lead.source && (
                        <span className="text-[10px] text-[rgba(238,241,250,0.3)] hidden sm:inline">
                          {SOURCE_LABELS[lead.source] ?? lead.source}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      {lead.email && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                      {lead.phone && <span className="text-[11px] text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-[11px] text-[rgba(238,241,250,0.3)] hidden sm:block">{fmt(lead.created_at)}</span>
                    <button
                      onClick={() => setExpandedId(expanded ? null : lead.id)}
                      className="text-[rgba(238,241,250,0.3)] hover:text-muted-foreground transition-colors"
                    >
                      {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="border-t border-border px-4 py-4 space-y-4 bg-muted">
                    {lead.message && (
                      <div>
                        <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-1">Message</div>
                        <p className="text-sm text-muted-foreground leading-relaxed">{lead.message}</p>
                      </div>
                    )}

                    {/* Status change */}
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">Status</div>
                      <div className="flex flex-wrap gap-1.5">
                        {(Object.keys(STATUS_META) as LeadStatus[]).map((s) => {
                          const sm = STATUS_META[s];
                          return (
                            <button key={s} onClick={() => updateStatus(lead.id, s)}
                              className={`px-3 py-1 text-xs font-bold rounded-full border transition-colors ${lead.status === s ? `${sm.color} ${sm.bg} border-transparent` : "border-border text-muted-foreground hover:border-white/25"}`}>
                              {sm.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider mb-2">Follow-up Notes</div>
                      <textarea
                        rows={3}
                        value={currentNotes}
                        onChange={(e) => setLocalNotes((n) => ({ ...n, [lead.id]: e.target.value }))}
                        placeholder="Add notes about this lead…"
                        className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-[rgba(238,241,250,0.2)] focus:outline-none focus:border-primary/60 resize-none"
                      />
                      <div className="flex justify-end mt-2">
                        <button
                          onClick={() => saveNotes(lead.id)}
                          disabled={savingNotes === lead.id}
                          className="text-xs font-bold text-primary hover:text-[#4BA3E3] disabled:opacity-40 transition-colors"
                        >
                          {savingNotes === lead.id ? "Saving…" : "Save notes"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function PortalCrm() {
  return (
    <PortalLayout>
      {(connection) => <CrmContent connectionId={connection.id} />}
    </PortalLayout>
  );
}
