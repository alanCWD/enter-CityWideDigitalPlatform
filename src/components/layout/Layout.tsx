import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";

interface LayoutProps {
  children: ReactNode;
  /** Public marketing pages use the default theme; the landing page uses "capsule". */
  variant?: "default" | "capsule";
}

export default function Layout({ children, variant = "default" }: LayoutProps) {
  const capsule = variant === "capsule";
  return (
    <div className={`min-h-screen flex flex-col ${capsule ? "capsule-page" : "bg-background"}`}>
      <Navbar variant={variant} />
      <main className={capsule ? "flex-1" : "flex-1 pt-[88px]"}>{children}</main>
      <Footer variant={variant} />
    </div>
  );
}
