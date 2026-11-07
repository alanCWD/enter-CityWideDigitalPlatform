import { ReactNode } from "react";
import Navbar from "./Navbar";
import Footer from "./Footer";
import "@/styles/glass-theme.css";

type LayoutVariant = "default" | "capsule" | "glass";

interface LayoutProps {
  children: ReactNode;
  /**
   * "capsule" is the landing page's HUD theme; "glass" is the inner-page
   * theme that shares its typography inside translucent panels.
   */
  variant?: LayoutVariant;
}

export default function Layout({ children, variant = "default" }: LayoutProps) {
  const capsule = variant === "capsule";
  const glass = variant === "glass";
  const darkMono = capsule || glass;

  const shell = capsule ? "capsule-page" : glass ? "glass-page" : "bg-background";

  return (
    <div className={`min-h-screen flex flex-col ${shell}`}>
      <Navbar variant={darkMono ? "capsule" : "default"} />
      <main className={capsule || glass ? "flex-1" : "flex-1 pt-[88px]"}>{children}</main>
      <Footer variant={darkMono ? "capsule" : "default"} />
    </div>
  );
}
