import { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Store, Shield, LogOut, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { RequirePortalAuth } from "@/components/portal/RequirePortalAuth";
import { useAuth } from "@/hooks/useAuth";

function PortalConnectInner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const crmClientId = searchParams.get("crmClientId");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  const handleConnect = async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gbp-auth-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          clientLabel: user.email ?? "New Client",
          frontendOrigin: window.location.origin,
          linkUserId: user.id,
          crmClientId: crmClientId ?? null,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError(data.error || "Could not generate authorization URL.");
        setLoading(false);
      }
    } catch {
      setError("Connection failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen portal-auth-bg flex items-center justify-center p-6">
      <div className="max-w-md w-full">
        <div className="bg-card rounded-2xl border border-border p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-primary" />
          </div>

          <h1 className="text-xl font-bold text-foreground mb-2">
            Connect Your Business Profile
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Sign in with the Google account that <strong className="text-foreground">owns</strong> your
            Google Business Profile listing. We'll automatically sync your business name, address,
            phone, reviews, and posts — no manual entry needed.
          </p>

          {/* Steps */}
          <div className="text-left bg-muted/40 rounded-xl border border-border p-4 mb-6 space-y-2.5">
            {[
              "Click the button below",
              "Sign in with your business Google account",
              "Approve the permissions request",
              "Your portal populates automatically",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-xs text-muted-foreground">{step}</span>
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 mb-4 text-left">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white text-sm font-bold py-3.5 rounded-xl transition-colors shadow-[0_4px_12px_rgba(0,120,215,0.3)]"
          >
            {loading ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting to Google…</>
            ) : (
              <><Store className="w-4 h-4" /> Connect with Google <ArrowRight className="w-4 h-4" /></>
            )}
          </button>

          {/* Footer */}
          <div className="mt-5 pt-5 border-t border-border space-y-2">
            <div className="flex items-center gap-2 bg-muted rounded-xl px-4 py-2.5 border border-border">
              <Shield className="w-3.5 h-3.5 text-primary flex-shrink-0" />
              <span className="text-xs text-muted-foreground">
                Signed in as <span className="text-foreground font-semibold">{user?.email}</span>
              </span>
            </div>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors"
            >
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-4">
          Questions? Contact{" "}
          <a href="mailto:alan@citywidedigital.ca" className="underline hover:text-muted-foreground transition-colors">
            alan@citywidedigital.ca
          </a>
        </p>
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
