import { useNavigate } from "react-router-dom";
import { Store, Shield, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RequirePortalAuth } from "@/components/portal/RequirePortalAuth";
import { useAuth } from "@/hooks/useAuth";

function PortalConnectInner() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/portal/login");
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_55%,#00447A_100%)] flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <div className="bg-[#111E33] rounded-2xl border border-white/8 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#0078D7]/15 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-[#0078D7]" />
          </div>

          <h1 className="text-xl font-bold text-[#EEF1FA] mb-2">Your profile is being set up</h1>
          <p className="text-sm text-[rgba(238,241,250,0.6)] leading-relaxed mb-6">
            Your Google Business Profile is managed through CityWide Digital's master account.
            Your agency is linking your business to this portal — no action needed on your end.
          </p>

          <div className="space-y-3 mb-7 text-left">
            {[
              "Your GBP data is connected via your agency's Zernio account",
              "No Google sign-in required from you",
              "Your portal will be ready once your agency confirms the link",
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <CheckCircle className="w-3.5 h-3.5 text-[#22C55E] mt-0.5 flex-shrink-0" />
                <span className="text-xs text-[rgba(238,241,250,0.7)]">{item}</span>
              </div>
            ))}
          </div>

          <div className="bg-[#0D1526] rounded-xl p-4 border border-white/8 mb-6">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-[#0078D7]" />
              <span className="text-xs font-bold text-[#EEF1FA]">Signed in as</span>
            </div>
            <span className="text-sm text-[#0078D7]">{user?.email}</span>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full text-sm text-[rgba(238,241,250,0.4)] hover:text-[#EEF1FA] transition-colors"
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
