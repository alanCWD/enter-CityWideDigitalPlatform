import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-[#0D1526] flex">
      <Sidebar />
      {/* Main content — offset by sidebar width on desktop */}
      <div className="flex-1 md:ml-60 flex flex-col min-h-screen overflow-auto">
        {children}
      </div>
    </div>
  );
}
