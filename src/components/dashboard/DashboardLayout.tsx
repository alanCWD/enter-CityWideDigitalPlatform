import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  children: ReactNode;
}

function DashboardShell({ children }: DashboardLayoutProps) {
  const { theme } = useTheme();
  return (
    <div
      className={cn(
        "min-h-screen flex",
        theme === "light" ? "theme-light bg-[#0D1526]" : "bg-[#0D1526]",
      )}
    >
      <Sidebar />
      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ThemeProvider>
      <DashboardShell>{children}</DashboardShell>
    </ThemeProvider>
  );
}
