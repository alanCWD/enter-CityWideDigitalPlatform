import { ReactNode, useEffect } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
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
  const { user, loading: authLoading } = useAuth();
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
        <div className="max-w-md text-center bg-[#111E33] rounded-2xl border border-white/8 p-8">
          <AlertCircle className="w-8 h-8 text-yellow-400 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[#EEF1FA] mb-2">No business linked</h2>
          <p className="text-xs text-[rgba(238,241,250,0.6)] leading-relaxed">
            Your account isn't linked to any business yet. Please contact your CityWide Digital
            account manager and ask them to send you a portal invite using this email address:{" "}
            <span className="text-[#0078D7] font-semibold">{user?.email}</span>.
          </p>
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
      <main className="px-6 py-6 max-w-7xl mx-auto">{children(current)}</main>
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
