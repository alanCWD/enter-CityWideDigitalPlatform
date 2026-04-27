import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Store,
  CheckCircle2,
  RefreshCw,
  Star,
  MessageCircle,
  MapPin,
  Phone,
  Globe,
  Plus,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Loader2,
  Tag,
  FileText,
  Calendar,
  Unlink,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { TopBar } from "@/components/dashboard/TopBar";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GbpConnection {
  id: string;
  client_label: string;
  business_name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  rating: number | null;
  review_count: number | null;
  last_synced_at: string | null;
  created_at: string;
}

interface GbpReview {
  id: string;
  reviewer_name: string | null;
  rating: number | null;
  comment: string | null;
  reply: string | null;
  review_time: string | null;
}

interface GbpPost {
  id: string;
  summary: string | null;
  topic_type: string | null;
  post_time: string | null;
}

// ─── Connect Dialog ───────────────────────────────────────────────────────────

function ConnectDialog({ onClose }: { onClose: () => void }) {
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!label.trim()) { setError("Please enter a client name."); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gbp-auth-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ clientLabel: label.trim(), returnTo: "/gbp" }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to generate auth URL.");
        setLoading(false);
      }
    } catch {
      setError("Connection failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative w-full max-w-sm bg-[#111E33] rounded-2xl border border-white/10 p-6 shadow-2xl"
      >
        <button onClick={onClose} className="absolute top-4 right-4 text-[rgba(238,241,250,0.4)] hover:text-[#EEF1FA] transition-colors">
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#0078D7]/15 flex items-center justify-center">
            <Store className="w-5 h-5 text-[#0078D7]" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#EEF1FA]">Connect Business Profile</h3>
            <p className="text-[10px] text-[rgba(238,241,250,0.5)]">Authorize via Google account</p>
          </div>
        </div>

        <label className="block text-xs font-bold text-[rgba(238,241,250,0.7)] mb-2">Client Label</label>
        <input
          type="text"
          placeholder="e.g. Luigi's NY Pizza"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.3)] focus:outline-none focus:border-[#0078D7] transition-colors mb-1"
        />
        {error && <p className="text-[10px] text-red-400 mb-3">{error}</p>}
        <p className="text-[10px] text-[rgba(238,241,250,0.4)] mb-4">
          You'll be redirected to Google to authorize CityWide Digital to access this business's GBP data.
        </p>
        <button
          onClick={handleConnect}
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
            loading
              ? "bg-white/10 text-[rgba(238,241,250,0.4)] cursor-not-allowed"
              : "bg-[#0078D7] hover:bg-[#00447A] text-white shadow-[0_4px_12px_rgba(0,120,215,0.3)]"
          )}
        >
          {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</> : <><Store className="w-4 h-4" /> Connect with Google</>}
        </button>
      </motion.div>
    </div>
  );
}

// ─── Connection Card ──────────────────────────────────────────────────────────

function ConnectionCard({ conn, onSync, onDisconnect }: {
  conn: GbpConnection;
  onSync: (id: string) => void;
  onDisconnect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"reviews" | "posts" | "nap">("reviews");
  const [reviews, setReviews] = useState<GbpReview[]>([]);
  const [posts, setPosts] = useState<GbpPost[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const loadDetail = useCallback(async () => {
    if (!expanded) return;
    setLoadingDetail(true);
    const [rvRes, ptRes] = await Promise.all([
      supabase.from("gbp_reviews").select("*").eq("connection_id", conn.id).order("review_time", { ascending: false }).limit(5),
      supabase.from("gbp_posts").select("*").eq("connection_id", conn.id).order("post_time", { ascending: false }).limit(5),
    ]);
    if (rvRes.data) setReviews(rvRes.data as GbpReview[]);
    if (ptRes.data) setPosts(ptRes.data as GbpPost[]);
    setLoadingDetail(false);
  }, [conn.id, expanded]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const handleSync = async () => {
    setSyncing(true);
    await onSync(conn.id);
    await loadDetail();
    setSyncing(false);
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—";

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-[#111E33] rounded-xl border border-white/8 overflow-hidden">
      {/* Card Header */}
      <div className="p-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#0078D7]/15 flex items-center justify-center flex-shrink-0">
            <Store className="w-5 h-5 text-[#0078D7]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm font-bold text-[#EEF1FA] truncate">{conn.business_name || conn.client_label}</h3>
              <span className="text-[9px] font-bold bg-[#22C55E]/15 text-[#22C55E] px-1.5 py-0.5 rounded-full flex-shrink-0">Connected</span>
              {conn.category && (
                <span className="text-[9px] font-bold bg-[#0078D7]/15 text-[#0078D7] px-1.5 py-0.5 rounded-full flex-shrink-0">{conn.category}</span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {conn.address && <span className="text-[10px] text-[rgba(238,241,250,0.5)] flex items-center gap-1"><MapPin className="w-3 h-3" />{conn.address}</span>}
              {conn.rating && (
                <span className="text-[10px] text-yellow-400 flex items-center gap-1 font-semibold">
                  <Star className="w-3 h-3 fill-yellow-400" />{conn.rating}
                </span>
              )}
            </div>
            {conn.last_synced_at && (
              <p className="text-[10px] text-[rgba(238,241,250,0.35)] mt-1">Last synced: {formatDate(conn.last_synced_at)}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 bg-[#0078D7]/15 border border-[#0078D7]/30 text-[#0078D7] text-[10px] font-bold px-2.5 py-1.5 rounded-lg hover:bg-[#0078D7]/25 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
            {syncing ? "Syncing..." : "Sync"}
          </button>
          <button
            onClick={() => onDisconnect(conn.id)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[rgba(238,241,250,0.4)] hover:text-red-400 hover:border-red-400/30 transition-colors"
          >
            <Unlink className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-[rgba(238,241,250,0.4)] hover:text-[#EEF1FA] transition-colors"
          >
            {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-white/8"
          >
            {/* Tab Bar */}
            <div className="flex items-center gap-1 p-3 border-b border-white/8 bg-white/2">
              {(["reviews", "posts", "nap"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all",
                    activeTab === tab
                      ? "bg-[#0078D7] text-white"
                      : "text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA] hover:bg-white/5"
                  )}
                >
                  {tab === "nap" ? "NAP Details" : tab}
                </button>
              ))}
            </div>

            <div className="p-4">
              {loadingDetail ? (
                <div className="flex items-center gap-2 text-xs text-[rgba(238,241,250,0.4)] py-4">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading data...
                </div>
              ) : (
                <>
                  {/* Reviews Tab */}
                  {activeTab === "reviews" && (
                    <div className="space-y-3">
                      {reviews.length === 0 ? (
                        <p className="text-xs text-[rgba(238,241,250,0.4)] text-center py-4">No reviews synced yet. Click Sync to fetch.</p>
                      ) : reviews.map((r) => (
                        <div key={r.id} className="bg-white/3 rounded-lg p-3 border border-white/5">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-[#EEF1FA]">{r.reviewer_name}</span>
                            <div className="flex gap-0.5">
                              {[1,2,3,4,5].map(i => (
                                <Star key={i} className={cn("w-3 h-3", i <= (r.rating || 0) ? "text-yellow-400 fill-yellow-400" : "text-white/20")} />
                              ))}
                            </div>
                          </div>
                          {r.comment && <p className="text-[10px] text-[rgba(238,241,250,0.6)] leading-relaxed">{r.comment}</p>}
                          {r.reply && (
                            <div className="mt-2 pl-2 border-l-2 border-[#0078D7]/40">
                              <p className="text-[10px] text-[#0078D7] font-semibold mb-0.5">Owner reply:</p>
                              <p className="text-[10px] text-[rgba(238,241,250,0.5)]">{r.reply}</p>
                            </div>
                          )}
                          <p className="text-[10px] text-[rgba(238,241,250,0.3)] mt-1.5">{formatDate(r.review_time)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Posts Tab */}
                  {activeTab === "posts" && (
                    <div className="space-y-3">
                      {posts.length === 0 ? (
                        <p className="text-xs text-[rgba(238,241,250,0.4)] text-center py-4">No posts synced yet. Click Sync to fetch.</p>
                      ) : posts.map((p) => (
                        <div key={p.id} className="bg-white/3 rounded-lg p-3 border border-white/5">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            {p.topic_type === "OFFER" ? <Tag className="w-3 h-3 text-[#22C55E]" /> :
                             p.topic_type === "EVENT" ? <Calendar className="w-3 h-3 text-yellow-400" /> :
                             <FileText className="w-3 h-3 text-[#0078D7]" />}
                            <span className={cn("text-[10px] font-bold",
                              p.topic_type === "OFFER" ? "text-[#22C55E]" :
                              p.topic_type === "EVENT" ? "text-yellow-400" : "text-[#0078D7]"
                            )}>{p.topic_type || "POST"}</span>
                          </div>
                          {p.summary && <p className="text-[10px] text-[rgba(238,241,250,0.65)] leading-relaxed">{p.summary}</p>}
                          <p className="text-[10px] text-[rgba(238,241,250,0.3)] mt-1.5">{formatDate(p.post_time)}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* NAP Tab */}
                  {activeTab === "nap" && (
                    <div className="space-y-2.5">
                      {[
                        { icon: Store, label: "Business Name", value: conn.business_name },
                        { icon: MapPin, label: "Address", value: conn.address },
                        { icon: Phone, label: "Phone", value: conn.phone },
                        { icon: Globe, label: "Website", value: conn.website },
                        { icon: MessageCircle, label: "Category", value: conn.category },
                        { icon: Star, label: "Rating", value: conn.rating ? `${conn.rating} stars` : null },
                      ].map(({ icon: Icon, label, value }) => (
                        <div key={label} className="flex items-start gap-3 py-2 border-b border-white/5 last:border-b-0">
                          <Icon className="w-3.5 h-3.5 text-[#0078D7] mt-0.5 flex-shrink-0" />
                          <div>
                            <div className="text-[10px] font-bold text-[rgba(238,241,250,0.4)] uppercase tracking-wide">{label}</div>
                            <div className="text-xs text-[#EEF1FA] mt-0.5">{value || <span className="text-[rgba(238,241,250,0.3)]">Not available</span>}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function GBPIntegration() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [connections, setConnections] = useState<GbpConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadConnections = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gbp_connections")
      .select("id,client_label,business_name,address,phone,website,category,rating,review_count,last_synced_at,created_at")
      .order("created_at", { ascending: false });
    if (!error && data) setConnections(data as GbpConnection[]);
    setLoading(false);
  }, []);

  useEffect(() => { loadConnections(); }, [loadConnections]);

  // Handle OAuth redirect
  useEffect(() => {
    const status = searchParams.get("status");
    const business = searchParams.get("business");
    const error = searchParams.get("error");
    if (status === "connected") {
      showToast(`${business || "Business"} connected successfully!`, "success");
      loadConnections();
      setSearchParams({});
    } else if (error) {
      showToast(`Connection failed: ${error.replace(/_/g, " ")}`, "error");
      setSearchParams({});
    }
  }, [searchParams, setSearchParams, loadConnections]);

  const handleSync = async (connectionId: string) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/gbp-sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ connectionId }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Synced ${data.reviewCount} reviews, ${data.postCount} posts`);
      loadConnections();
    } else {
      showToast(data.error || "Sync failed", "error");
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    if (!window.confirm("Disconnect this business profile? All synced data will be removed.")) return;
    await supabase.from("gbp_connections").delete().eq("id", connectionId);
    showToast("Business profile disconnected");
    loadConnections();
  };

  return (
    <DashboardLayout>
      <TopBar
        title="Google Business Profile"
        subtitle={connections.length > 0 ? `${connections.length} profile${connections.length !== 1 ? "s" : ""} connected` : "Connect your clients' GBP accounts"}
        action={{ label: "+ Connect Profile", onClick: () => setShowDialog(true) }}
      />

      <div className="p-6 space-y-5">
        {/* How It Works Banner */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#0078D7]/8 border border-[#0078D7]/20 rounded-xl p-4 flex items-start gap-3"
        >
          <CheckCircle2 className="w-4 h-4 text-[#0078D7] mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold text-[#EEF1FA] mb-0.5">Fully Authorized GBP Sync</p>
            <p className="text-[10px] text-[rgba(238,241,250,0.6)] leading-relaxed">
              Click <strong className="text-[#0078D7]">Connect Profile</strong> → client signs in with Google → CityWide Digital gets secure read/write access →
              reviews, posts, hours, and NAP data sync automatically to their website.
            </p>
          </div>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16 gap-3 text-[rgba(238,241,250,0.4)]">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading connections...</span>
          </div>
        )}

        {/* Empty State */}
        {!loading && connections.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111E33] rounded-2xl border border-white/8 p-12 flex flex-col items-center text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#0078D7]/10 flex items-center justify-center mb-4">
              <Store className="w-8 h-8 text-[#0078D7]" />
            </div>
            <h3 className="text-base font-bold text-[#EEF1FA] mb-2">No profiles connected yet</h3>
            <p className="text-sm text-[rgba(238,241,250,0.5)] max-w-sm mb-6">
              Connect a client's Google Business Profile to start syncing reviews, posts, hours, and NAP data to their CityWide website.
            </p>
            <button
              onClick={() => setShowDialog(true)}
              className="flex items-center gap-2 bg-[#0078D7] hover:bg-[#00447A] text-white text-sm font-bold px-5 py-3 rounded-xl transition-colors shadow-[0_4px_12px_rgba(0,120,215,0.3)]"
            >
              <Plus className="w-4 h-4" /> Connect First Profile
            </button>
          </motion.div>
        )}

        {/* Connections List */}
        {!loading && connections.length > 0 && (
          <div className="space-y-4">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                conn={conn}
                onSync={handleSync}
                onDisconnect={handleDisconnect}
              />
            ))}
            <button
              onClick={() => setShowDialog(true)}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-dashed border-white/15 text-sm font-bold text-[rgba(238,241,250,0.5)] hover:border-[#0078D7]/40 hover:text-[#0078D7] transition-all"
            >
              <Plus className="w-4 h-4" /> Connect Another Profile
            </button>
          </div>
        )}
      </div>

      {/* Connect Dialog */}
      <AnimatePresence>
        {showDialog && <ConnectDialog onClose={() => setShowDialog(false)} />}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className={cn(
              "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-bold border",
              toast.type === "success"
                ? "bg-[#111E33] border-[#22C55E]/30 text-[#22C55E]"
                : "bg-[#111E33] border-red-400/30 text-red-400"
            )}
          >
            {toast.type === "success"
              ? <CheckCircle2 className="w-4 h-4" />
              : <AlertCircle className="w-4 h-4" />}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
