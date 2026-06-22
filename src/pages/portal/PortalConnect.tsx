import { useNavigate } from "react-router-dom";
import { Store, Shield, Clock } from "lucide-react";
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
      <div className="max-w-md w-full">
        <div className="bg-[#111E33] rounded-2xl border border-white/8 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)] text-center">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-[#0078D7]/15 flex items-center justify-center mx-auto mb-5">
            <Store className="w-7 h-7 text-[#0078D7]" />
          </div>

          <h1 className="text-xl font-bold text-[#EEF1FA] mb-2">
            Your portal is being set up
          </h1>
          <p className="text-sm text-[rgba(238,241,250,0.6)] leading-relaxed mb-7">
            CityWide Digital is finishing the configuration for your business portal.
            You'll receive an email once everything is ready — usually within one business day.
          </p>

          {/* Status badge */}
          <div className="inline-flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-2 mb-7">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-xs font-bold text-amber-400">Pending agency setup</span>
          </div>

          {/* Signed in as */}
          <div className="bg-[#0D1526] rounded-xl p-4 border border-white/8 mb-6 text-left">
            <div className="flex items-center gap-2 mb-1">
              <Shield className="w-3.5 h-3.5 text-[#0078D7]" />
              <span className="text-xs font-bold text-[rgba(238,241,250,0.5)] uppercase tracking-wide">Signed in as</span>
            </div>
            <span className="text-sm text-[#EEF1FA]">{user?.email}</span>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full text-sm text-[rgba(238,241,250,0.35)] hover:text-[rgba(238,241,250,0.7)] transition-colors"
          >
            Sign out
          </button>
        </div>

        <p className="text-center text-xs text-[rgba(238,241,250,0.25)] mt-4">
          Questions? Contact{" "}
          <a href="mailto:alan@citywidedigital.ca" className="underline hover:text-[rgba(238,241,250,0.5)] transition-colors">
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
