import { ReactNode, useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2, Store, ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePortalConnections, type PortalConnection } from "@/hooks/usePortalConnections";
import { PortalTopBar } from "@/components/portal/PortalTopBar";
import { RequirePortalAuth } from "@/components/portal/RequirePortalAuth";

interface PortalLayoutProps {
  /**
   * Render-prop receiving the resolved connection so each tab page can use it
   * without re-fetching.
   */
  children: (connection: PortalConnection) => ReactNode;
}

function PortalLayoutInner({ children }: PortalLayoutProps) {
  const { clientId } = useParams();
  const { user, loading: authLoading, signOut } = useAuth();
  const { connections, loading: connsLoading } = usePortalConnections(user?.id);
  const navigate = useNavigate();

  useEffect(() => {
    if (!clientId && !connsLoading && connections.length > 0) {
      navigate(`/portal/${connections[0].id}`, { replace: true });
    }
  }, [clientId, connections, connsLoading, navigate]);

  if (authLoading || connsLoading) {
    return (
      <div className="min-h-screen bg-[#0A1120] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#0078D7] animate-spin" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="min-h-screen bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_55%,#00447A_100%)] flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111E33] rounded-2xl border border-white/8 p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="w-14 h-14 rounded-2xl bg-[#0078D7]/15 flex items-center justify-center mx-auto mb-4">
            <Store className="w-7 h-7 text-[#0078D7]" />
          </div>
          <h2 className="text-lg font-bold text-[#EEF1FA] mb-2">Welcome! Let's connect your business</h2>
          <p className="text-xs text-[rgba(238,241,250,0.6)] leading-relaxed mb-6">
            Sign in with the Google account that owns your Google Business Profile. We'll
            securely sync your reviews, posts, hours, and NAP details into this portal.
          </p>
          <Link
            to="/portal/connect"
            className="w-full flex items-center justify-center gap-2 bg-[#0078D7] hover:bg-[#0088EE] text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-[0_4px_12px_rgba(0,120,215,0.3)]"
          >
            <Store className="w-4 h-4" />
            Connect Google Business Profile
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-4 pt-4 border-t border-white/8 space-y-2">
            <p className="text-[10px] text-[rgba(238,241,250,0.4)]">
              Already invited by your account manager? Make sure you signed up with the same email
              they used: <span className="text-[#0078D7] font-semibold">{user?.email}</span>.
            </p>
            <button
              onClick={async () => {
                await signOut();
                navigate("/portal/login");
              }}
              className="inline-flex items-center gap-1.5 text-[10px] text-[rgba(238,241,250,0.5)] hover:text-[#EEF1FA] transition-colors"
            >
              <LogOut className="w-3 h-3" /> Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!clientId) return null;

  const current = connections.find((c) => c.id === clientId);
  if (!current) {
    return <Navigate to={`/portal/${connections[0].id}`} replace />;
  }
  const others = connections.filter((c) => c.id !== clientId);

  return (
    <div className="min-h-screen bg-[#0A1120]">
      <PortalTopBar connection={current} otherConnections={others} />
      <main className="pl-56 min-h-screen">
        <div className="px-8 py-8 max-w-5xl">{children(current)}</div>
      </main>
    </div>
  );
}

export function PortalLayout(props: PortalLayoutProps) {
  return (
    <RequirePortalAuth>
      <PortalLayoutInner {...props} />
    </RequirePortalAuth>
  );
}

