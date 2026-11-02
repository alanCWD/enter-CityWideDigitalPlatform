import { ReactNode, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { AuroraBackdrop } from "./AuroraBackdrop";
import "@/styles/glass-theme.css";

interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Shell for the agency workspace.
 *
 * While mounted it puts the document in "glass mode" (see
 * `src/styles/glass-theme.css`), which scopes the Glassmorphic CRM palette to
 * the workspace only — the public site and the client portal keep their own
 * theme. The class is removed on unmount so nothing leaks between sections.
 */
export function DashboardLayout({ children }: DashboardLayoutProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("glass-mode");
    return () => root.classList.remove("glass-mode");
  }, []);

  return (
    <div className="relative flex min-h-screen">
      <AuroraBackdrop />
      <Sidebar />
      {/* Main content — offset by sidebar width on desktop */}
      <div className="relative z-10 flex min-h-screen flex-1 flex-col overflow-auto md:ml-60">
        {children}
      </div>
    </div>
  );
}
