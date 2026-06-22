import { useState, useEffect } from "react";
import { X, RefreshCw, Link2, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { crm } from "@/lib/crm";
import { useToast } from "@/hooks/use-toast";

interface ZernioProfile {
  _id: string;
  name: string;
  description?: string;
  platforms?: string[];
  category?: string;
  address?: string;
  phone?: string;
  website?: string;
  rating?: number;
  review_count?: number;
}

interface Props {
  crmClientId: string;
  clientName: string;
  onLinked: (connectionId: string) => void;
  onClose: () => void;
}

export function LinkZernioProfileDialog({ crmClientId, clientName, onLinked, onClose }: Props) {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ZernioProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linking, setLinking] = useState<string | null>(null);

  const fetchProfiles = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("social-rpc", {
        body: { action: "zernio.profiles", payload: {} },
      });
      if (fnError || !data?.ok) throw new Error(data?.error ?? fnError?.message ?? "Failed to load profiles");
      setProfiles((data.profiles as ZernioProfile[]) ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProfiles(); }, []);

  const linkProfile = async (profile: ZernioProfile) => {
    setLinking(profile._id);
    try {
      // 1. Create/update gbp_connections record via social-rpc
      const { data, error: fnError } = await supabase.functions.invoke("social-rpc", {
        body: {
          action: "zernio.linkProfile",
          payload: {
            crm_client_id: crmClientId,
            zernio_profile_id: profile._id,
            profile_name: profile.name,
            category: profile.category,
            address: profile.address,
            phone: profile.phone,
            website: profile.website,
            rating: profile.rating,
            review_count: profile.review_count,
          },
        },
      });
      if (fnError || !data?.ok) throw new Error(data?.error ?? fnError?.message ?? "Link failed");

      const connectionId = data.connection_id as string;

      // 2. Update BunnyDB CRM client with the connection ID
      await crm("clients.update", { id: crmClientId, gbp_connection_id: connectionId });

      toast({ title: `"${profile.name}" linked to ${clientName}` });
      onLinked(connectionId);
    } catch (e) {
      toast({ title: "Link failed", description: (e as Error).message, variant: "destructive" });
    } finally {
      setLinking(null);
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
          <div>
            <h3 className="text-sm font-bold text-foreground dark:text-[#EEF1FA]">Link Zernio Profile</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Select a Zernio profile to link to <strong>{clientName}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchProfiles}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground dark:text-[rgba(238,241,250,0.4)] dark:hover:text-[#EEF1FA] transition-colors disabled:opacity-40"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground dark:text-[rgba(238,241,250,0.4)] dark:hover:text-[#EEF1FA]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-4 max-h-[400px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground text-sm">
              <RefreshCw className="w-4 h-4 animate-spin" /> Loading Zernio profiles…
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div>
                <div className="text-sm font-bold text-red-400">Could not load profiles</div>
                <div className="text-xs text-red-400/70 mt-0.5">{error}</div>
              </div>
            </div>
          ) : profiles.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              No Zernio profiles found in your master account.
            </div>
          ) : (
            <div className="space-y-2">
              {profiles.map((profile) => (
                <div
                  key={profile._id}
                  className="flex items-center justify-between bg-muted/40 dark:bg-[#0D1526] rounded-xl px-4 py-3.5 border border-border dark:border-white/8"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-bold text-foreground dark:text-[#EEF1FA] truncate">{profile.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {profile.category && (
                        <span className="text-[10px] text-muted-foreground">{profile.category}</span>
                      )}
                      {profile.platforms && profile.platforms.length > 0 && (
                        <span className="text-[10px] text-[#0078D7]">
                          {profile.platforms.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => linkProfile(profile)}
                    disabled={!!linking}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-[#0078D7] hover:bg-[#005FA3] disabled:opacity-40 text-white transition-colors ml-3 flex-shrink-0"
                  >
                    {linking === profile._id ? (
                      <RefreshCw className="w-3 h-3 animate-spin" />
                    ) : (
                      <Link2 className="w-3 h-3" />
                    )}
                    {linking === profile._id ? "Linking…" : "Select"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer note */}
        <div className="px-6 py-3 border-t border-border dark:border-white/8 bg-muted/30 dark:bg-[#0D1526]">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-[#22C55E] flex-shrink-0" />
            <p className="text-[11px] text-muted-foreground dark:text-[rgba(238,241,250,0.45)]">
              These profiles come from your Zernio master account (alan@citywidedigital.ca). No Google OAuth required.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
