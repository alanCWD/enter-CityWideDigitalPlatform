import { ReactNode, useEffect } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Loader2, Store, ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePortalConnections, type PortalConnection } from "@/hooks/usePortalConnections";
import { PortalTopBar } from "@/components/portal/PortalTopBar";
import { RequirePortalAuth } from "@/components/portal/RequirePortalAuth";
import { cn } from "@/lib/utils";

interface PortalLayoutProps {
  /**
   * Render-prop receiving the resolved connection so each tab page can use it
   * without re-fetching.
   */
  children: (connection: PortalConnection) => ReactNode;
  /** Let a page use the full content width (e.g. an embedded app). */
  wide?: boolean;
}

function PortalLayoutInner({ children, wide }: PortalLayoutProps) {
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  if (connections.length === 0) {
    return (
      <div className="min-h-screen portal-auth-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-card rounded-2xl border border-border p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.15)]">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
            <Store className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground mb-2">Welcome! Let's connect your business</h2>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            Sign in with the Google account that owns your Google Business Profile. We'll
            securely sync your reviews, posts, hours, and NAP details into this portal.
          </p>
          <Link
            to="/portal/connect"
            className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-white text-sm font-bold py-3 rounded-xl transition-colors shadow-[0_4px_12px_rgba(0,120,215,0.3)]"
          >
            <Store className="w-4 h-4" />
            Connect Google Business Profile
            <ArrowRight className="w-4 h-4" />
          </Link>
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Already invited by your account manager? Make sure you signed up with the same email
              they used: <span className="text-primary font-semibold">{user?.email}</span>.
            </p>
            <button
              onClick={async () => {
                await signOut();
                navigate("/portal/login");
              }}
              className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
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
    <div className="min-h-screen bg-background">
      <PortalTopBar connection={current} otherConnections={others} />
      <main className="pl-56 min-h-screen">
        <div className={cn("px-8 py-8", wide ? "max-w-none" : "max-w-5xl")}>{children(current)}</div>
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

