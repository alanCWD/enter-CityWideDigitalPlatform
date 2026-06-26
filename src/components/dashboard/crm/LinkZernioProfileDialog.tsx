import { useState, useEffect } from "react";
import { X, RefreshCw, Link2, CheckCircle, AlertCircle, Store, Star, Phone, MapPin, Plus, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { crm } from "@/lib/crm";
import { useToast } from "@/hooks/use-toast";

interface GbpConnection {
  id: string;
  business_name: string | null;
  client_label: string;
  category: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  google_location_name: string | null;
}

interface Props {
  crmClientId: string;
  clientName: string;
  currentConnectionId?: string | null;
  onLinked: (connectionId: string) => void;
  onClose: () => void;
}

type View = "list" | "create";

export function LinkZernioProfileDialog({ crmClientId, clientName, currentConnectionId, onLinked, onClose }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("list");

  // ── List state ──────────────────────────────────────────
  const [connections, setConnections] = useState<GbpConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  // ── Create state ─────────────────────────────────────────
  const [newName, setNewName] = useState(clientName);
  const [newAddress, setNewAddress] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchConnections = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("gbp_connections")
        .select("id, business_name, client_label, category, address, phone, website, rating, review_count, google_location_name")
        .order("client_label");
      if (dbError) throw new Error(dbError.message);
      setConnections((data ?? []) as GbpConnection[]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConnections(); }, []);

  const linkConnection = async (conn: GbpConnection) => {
    setLinking(conn.id);
    try {
      await crm("clients.update", { id: crmClientId, gbp_connection_id: conn.id });
      toast({ title: `"${conn.business_name ?? conn.client_label}" linked to ${clientName}` });
      onLinked(conn.id);
    } catch (e) {
      toast({ title: "Link failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLinking(null);
    }
  };

  const createAndLink = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      // 1. Insert a new gbp_connections row
      const { data: inserted, error: insertErr } = await supabase
        .from("gbp_connections")
        .insert({
          business_name: newName.trim(),
          client_label: newName.trim(),
          address: newAddress.trim() || null,
          phone: newPhone.trim() || null,
          category: newCategory.trim() || null,
        })
        .select("id")
        .single();
      if (insertErr || !inserted) throw new Error(insertErr?.message ?? "Insert failed");

      // 2. Link to the CRM client
      await crm("clients.update", { id: crmClientId, gbp_connection_id: inserted.id });
      toast({ title: `"${newName.trim()}" created and linked to ${clientName}` });
      onLinked(inserted.id);
    } catch (e) {
      toast({ title: "Create failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-card dark:bg-[#111E33] rounded-2xl border border-border dark:border-white/10 shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
          <div className="flex items-center gap-2">
            {view === "create" && (
              <button
                onClick={() => setView("list")}
                className="text-muted-foreground hover:text-foreground transition-colors mr-1"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">
                {view === "list" ? "Link a Business Profile" : "Create New Profile"}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {view === "list"
                  ? <>Choose a GBP account to connect to <strong>{clientName}</strong></>
                  : <>Create a new profile and link it to <strong>{clientName}</strong></>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {view === "list" && (
              <button
                onClick={fetchConnections}
                disabled={loading}
                className="text-muted-foreground hover:text-foreground dark:text-[rgba(238,241,250,0.4)] dark:hover:text-[#EEF1FA] transition-colors disabled:opacity-40"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground dark:text-[rgba(238,241,250,0.4)] dark:hover:text-[#EEF1FA]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <AnimatePresence mode="wait">
          {view === "list" ? (
            <motion.div
              key="list"
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.15 }}
              className="p-4 max-h-[400px] overflow-y-auto"
            >
              {loading ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Loading business profiles…
                </div>
              ) : error ? (
                <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                  <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-sm font-bold text-red-400">Could not load profiles</div>
                    <div className="text-xs text-red-400/70 mt-0.5">{error}</div>
                    <button onClick={fetchConnections} className="text-xs text-red-400 underline mt-1">Try again</button>
                  </div>
                </div>
              ) : connections.length === 0 ? (
                <div className="text-center py-10">
                  <Store className="w-8 h-8 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-sm text-muted-foreground">No profiles yet.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Create one below.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {connections.map((conn) => {
                    const isLinked = conn.id === currentConnectionId;
                    const displayName = conn.business_name ?? conn.client_label;
                    return (
                      <div
                        key={conn.id}
                        className={`flex items-center justify-between rounded-xl px-4 py-3.5 border transition-colors ${
                          isLinked
                            ? "bg-[#0078D7]/8 border-[#0078D7]/30"
                            : "bg-muted/40 dark:bg-[#0D1526] border-border dark:border-white/8"
                        }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground dark:text-[#EEF1FA] truncate">{displayName}</span>
                            {isLinked && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0078D7]/15 text-[#0078D7] border border-[#0078D7]/20 shrink-0">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            {conn.category && (
                              <span className="text-[10px] text-muted-foreground">{conn.category}</span>
                            )}
                            {conn.address && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 shrink-0" />{conn.address}
                              </span>
                            )}
                            {conn.phone && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Phone className="w-2.5 h-2.5 shrink-0" />{conn.phone}
                              </span>
                            )}
                            {conn.rating != null && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                                {conn.rating} ({conn.review_count ?? 0})
                              </span>
                            )}
                            {!conn.address && !conn.phone && !conn.category && !conn.rating && (
                              <span className="text-[10px] text-muted-foreground/50 italic">No details yet</span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => linkConnection(conn)}
                          disabled={!!linking || isLinked}
                          className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ml-3 flex-shrink-0 ${
                            isLinked
                              ? "bg-[#0078D7]/15 text-[#0078D7] cursor-default"
                              : "bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-40 text-white"
                          }`}
                        >
                          {linking === conn.id ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : isLinked ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : (
                            <Link2 className="w-3 h-3" />
                          )}
                          {linking === conn.id ? "Linking…" : isLinked ? "Linked" : "Select"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="create"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 12 }}
              transition={{ duration: 0.15 }}
              className="p-5 space-y-4"
            >
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Business Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="e.g. HyperDrii"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-muted/50 dark:bg-[#0D1526] border border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#0078D7]/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={e => setNewCategory(e.target.value)}
                    placeholder="e.g. Software Company"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-muted/50 dark:bg-[#0D1526] border border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#0078D7]/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Address
                  </label>
                  <input
                    type="text"
                    value={newAddress}
                    onChange={e => setNewAddress(e.target.value)}
                    placeholder="e.g. 123 Main St, Calgary, AB"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-muted/50 dark:bg-[#0D1526] border border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#0078D7]/50"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={newPhone}
                    onChange={e => setNewPhone(e.target.value)}
                    placeholder="e.g. +1 403 555 0100"
                    className="w-full px-3 py-2.5 rounded-lg text-sm bg-muted/50 dark:bg-[#0D1526] border border-border dark:border-white/10 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-[#0078D7]/50"
                  />
                </div>
              </div>
              <button
                onClick={createAndLink}
                disabled={creating || !newName.trim()}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-40 text-white transition-colors"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Creating & Linking…" : "Create Profile & Link"}
              </button>
              <p className="text-[11px] text-muted-foreground/60 text-center">
                You can edit NAP details and sync reviews after linking.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-border dark:border-white/8 bg-muted/30 dark:bg-[#0D1526]">
          {view === "list" ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0" />
                <p className="text-[11px] text-muted-foreground dark:text-[rgba(238,241,250,0.45)]">
                  All GBP accounts connected to your agency.
                </p>
              </div>
              <button
                onClick={() => setView("create")}
                className="flex items-center gap-1 text-[11px] font-bold text-[#0078D7] hover:text-[#005FA3] transition-colors shrink-0 ml-4"
              >
                <Plus className="w-3 h-3" /> New Profile
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
              <p className="text-[11px] text-muted-foreground dark:text-[rgba(238,241,250,0.45)]">
                A new GBP connection row will be created and linked to {clientName}.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
