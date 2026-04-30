import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Store, ArrowLeft, Shield, RefreshCw, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { RequirePortalAuth } from "@/components/portal/RequirePortalAuth";
import { useAuth } from "@/hooks/useAuth";

function PortalConnectInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [businessLabel, setBusinessLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!user) {
      setError("You must be signed in to connect.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // Reuse the existing whitelisted /gbp/callback redirect URI. The callback
      // detects `linkUserId` and routes the client back to /portal.
      const redirectUri = `${window.location.origin}/gbp/callback`;
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gbp-auth-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          clientLabel: businessLabel.trim() || user.email || "My Business",
          redirectUri,
          linkUserId: user.id,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Failed to start authorization.");
        setLoading(false);
      }
    } catch (e) {
      setError((e as Error).message || "Something went wrong.");
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_55%,#00447A_100%)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-[11px] text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA] transition-colors mb-4"
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </button>

        <div className="bg-[#111E33] rounded-2xl border border-white/8 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-12 h-12 rounded-xl bg-[#0078D7]/15 flex items-center justify-center flex-shrink-0">
              <Store className="w-6 h-6 text-[#0078D7]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#EEF1FA]">Connect your Google Business Profile</h1>
              <p className="text-[11px] text-[rgba(238,241,250,0.55)] mt-0.5">
                Signed in as <span className="text-[#0078D7] font-semibold">{user?.email}</span>
              </p>
            </div>
          </div>

          <p className="text-xs text-[rgba(238,241,250,0.65)] leading-relaxed mb-5">
            We'll redirect you to Google to authorize CityWide Digital. Once approved, your
            business data will appear here automatically.
          </p>

          {/* What we'll access */}
          <div className="space-y-2.5 mb-6">
            {[
              { icon: Star, text: "Read your reviews and post replies" },
              { icon: RefreshCw, text: "Sync hours, posts, and NAP details" },
              { icon: Shield, text: "Secure OAuth — you can revoke access anytime" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <item.icon className="w-3.5 h-3.5 text-[#22C55E] mt-0.5 flex-shrink-0" />
                <span className="text-xs text-[rgba(238,241,250,0.7)]">{item.text}</span>
              </div>
            ))}
          </div>

          <label className="block text-[10px] font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wider mb-1.5">
            Business name (optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Joe's Pizza"
            value={businessLabel}
            onChange={(e) => setBusinessLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-[#EEF1FA] placeholder:text-[rgba(238,241,250,0.3)] focus:outline-none focus:border-[#0078D7] transition-colors mb-1"
          />
          <p className="text-[10px] text-[rgba(238,241,250,0.4)] mb-5">
            We'll use the official name from Google if you leave this empty.
          </p>

          {error && (
            <p className="text-[11px] text-red-400 mb-4 bg-red-500/10 border border-red-500/30 rounded-lg p-2.5">
              {error}
            </p>
          )}

          <button
            onClick={handleConnect}
            disabled={loading}
            className={cn(
              "w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all",
              loading
                ? "bg-white/10 text-[rgba(238,241,250,0.4)] cursor-not-allowed"
                : "bg-[#0078D7] hover:bg-[#0088EE] text-white shadow-[0_4px_12px_rgba(0,120,215,0.3)]",
            )}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Google...
              </>
            ) : (
              <>
                <Store className="w-4 h-4" /> Continue with Google
              </>
            )}
          </button>

          <button
            onClick={handleSignOut}
            className="mt-3 w-full text-[11px] text-[rgba(238,241,250,0.4)] hover:text-[#EEF1FA] transition-colors"
          >
            Use a different account
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PortalConnect() {
  return (
    <RequirePortalAuth>
      <PortalConnectInner />
    </RequirePortalAuth>
  );
}
