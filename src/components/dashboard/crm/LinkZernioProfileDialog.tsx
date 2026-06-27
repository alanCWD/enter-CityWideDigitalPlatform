import { useState, useEffect } from "react";
import { X, RefreshCw, Link2, CheckCircle, AlertCircle, Store, Star, Phone, MapPin, ArrowLeft, Chrome } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { crm } from "@/lib/crm";
import { useToast } from "@/hooks/use-toast";

interface GbpConnection {
  id: string;
  business_name: string | null;
  client_label: string;
  category: string | null;
  address: string | null;
  phone: string | null;
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

type View = "main" | "list";

export function LinkZernioProfileDialog({ crmClientId, clientName, currentConnectionId, onLinked, onClose }: Props) {
  const { toast } = useToast();
  const [view, setView] = useState<View>("main");

  // ── List state ──────────────────────────────────────────
  const [connections, setConnections] = useState<GbpConnection[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  // ── Google OAuth state ────────────────────────────────────
  const [oauthLoading, setOauthLoading] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    setListError(null);
    try {
      const { data, error: dbError } = await supabase
        .from("gbp_connections")
        .select("id, business_name, client_label, category, address, phone, rating, review_count, google_location_name")
        .not("google_location_name", "is", null) // only real Google-connected profiles
        .order("client_label");
      if (dbError) throw new Error(dbError.message);
      setConnections((data ?? []) as GbpConnection[]);
    } catch (e) {
      setListError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (view === "list") fetchConnections();
  }, [view]);

  const handleConnectGoogle = async () => {
    setOauthLoading(true);
    setOauthError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gbp-auth-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          clientLabel: clientName,
          frontendOrigin: window.location.origin,
          crmClientId,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setOauthError(data.error || "Failed to generate authorization URL.");
        setOauthLoading(false);
      }
    } catch {
      setOauthError("Connection failed. Please try again.");
      setOauthLoading(false);
    }
  };

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

  const Header = ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-white/10">
      <div className="flex items-center gap-2">
        {view !== "main" && (
          <button onClick={() => setView("main")} className="text-muted-foreground hover:text-foreground transition-colors mr-1">
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <div>
          <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">{title}</h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
        </div>
      </div>
      <button onClick={onClose} className="text-muted-foreground hover:text-foreground dark:text-[rgba(238,241,250,0.4)] dark:hover:text-[#EEF1FA]">
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-lg bg-card dark:bg-[#111E33] rounded-2xl border border-border dark:border-white/10 shadow-2xl overflow-hidden"
      >
        <AnimatePresence mode="wait">

          {/* ── Main view ─────────────────────────────────── */}
          {view === "main" && (
            <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Header title="Connect Google Business Profile" subtitle={`Link real GBP data for ${clientName}`} />
              <div className="p-5 space-y-3">

                {/* Primary: Connect with Google */}
                <div className="rounded-xl border border-[#0078D7]/30 bg-[#0078D7]/5 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="w-9 h-9 rounded-lg bg-[#0078D7]/15 flex items-center justify-center flex-shrink-0">
                      <Chrome className="w-5 h-5 text-[#0078D7]" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">Connect with Google</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Sign in with the Google account that manages {clientName}'s GBP listing.
                        All data syncs automatically — name, address, phone, reviews, and posts.
                      </p>
                    </div>
                  </div>
                  {oauthError && (
                    <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 mb-3">
                      <AlertCircle className="w-3.5 h-3.5 text-red-400 mt-0.5 flex-shrink-0" />
                      <p className="text-[11px] text-red-400">{oauthError}</p>
                    </div>
                  )}
                  <button
                    onClick={handleConnectGoogle}
                    disabled={oauthLoading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-50 text-white transition-colors"
                  >
                    {oauthLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Chrome className="w-4 h-4" />}
                    {oauthLoading ? "Redirecting to Google…" : "Connect with Google"}
                  </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 border-t border-border dark:border-white/10" />
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">or</span>
                  <div className="flex-1 border-t border-border dark:border-white/10" />
                </div>

                {/* Secondary: link an already-connected profile */}
                <button
                  onClick={() => setView("list")}
                  className="w-full flex items-center gap-3 p-3.5 rounded-xl border border-border dark:border-white/8 bg-muted/40 dark:bg-[#0D1526] hover:border-[#0078D7]/40 hover:bg-[#0078D7]/5 transition-colors"
                >
                  <Link2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div className="text-left">
                    <p className="text-xs font-bold text-foreground dark:text-[#EEF1FA]">Link Already-Connected Profile</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Pick from profiles already authorized via Google in your agency</p>
                  </div>
                </button>

              </div>
            </motion.div>
          )}

          {/* ── List view ─────────────────────────────────── */}
          {view === "list" && (
            <motion.div key="list" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}>
              <Header
                title="Link Existing Profile"
                subtitle={`Pick a Google-connected profile for ${clientName}`}
              />
              <div className="p-4 max-h-[420px] overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
                    <RefreshCw className="w-4 h-4 animate-spin" /> Loading…
                  </div>
                ) : listError ? (
                  <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
                    <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <div className="text-sm font-bold text-red-400">Could not load profiles</div>
                      <div className="text-xs text-red-400/70 mt-0.5">{listError}</div>
                      <button onClick={fetchConnections} className="text-xs text-red-400 underline mt-1">Try again</button>
                    </div>
                  </div>
                ) : connections.length === 0 ? (
                  <div className="text-center py-10 space-y-3">
                    <Store className="w-8 h-8 text-muted-foreground mx-auto opacity-40" />
                    <p className="text-sm text-muted-foreground">No Google-connected profiles yet.</p>
                    <p className="text-xs text-muted-foreground/60">Use "Connect with Google" to authorize a GBP account first.</p>
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
                            isLinked ? "bg-[#0078D7]/8 border-[#0078D7]/30" : "bg-muted/40 dark:bg-[#0D1526] border-border dark:border-white/8"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground dark:text-[#EEF1FA] truncate">{displayName}</span>
                              {isLinked && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#0078D7]/15 text-[#0078D7] border border-[#0078D7]/20 shrink-0">Current</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {conn.category && <span className="text-[10px] text-muted-foreground">{conn.category}</span>}
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
                            </div>
                          </div>
                          <button
                            onClick={() => linkConnection(conn)}
                            disabled={!!linking || isLinked}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors ml-3 flex-shrink-0 ${
                              isLinked ? "bg-[#0078D7]/15 text-[#0078D7] cursor-default" : "bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-40 text-white"
                            }`}
                          >
                            {linking === conn.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : isLinked ? <CheckCircle className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}
                            {linking === conn.id ? "Linking…" : isLinked ? "Linked" : "Select"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  );
}
