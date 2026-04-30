import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function RequirePortalAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1120] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-[#0078D7] animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/portal/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
