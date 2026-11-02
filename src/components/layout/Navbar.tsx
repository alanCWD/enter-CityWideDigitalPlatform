import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ProfileMenu } from "@/components/layout/ProfileMenu";
import { LogoOnDark } from "@/components/branding/Logo";

const navLinks = [
  { label: "Services", href: "/services" },
  { label: "Pricing", href: "/pricing" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

interface NavbarProps {
  /** "capsule" is used only by the landing page's HUD theme. */
  variant?: "default" | "capsule";
}

export default function Navbar({ variant = "default" }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const capsule = variant === "capsule";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  return (
    <>
      <nav
        className={cn(
          "fixed top-0 left-0 right-0 z-50 flex items-center transition-all duration-300 ease-out",
          capsule
            ? cn(
                "h-[72px] border-b backdrop-blur-md",
                scrolled ? "bg-[#05070a]/85 border-white/10" : "bg-[#05070a]/45 border-white/5",
              )
            : cn(
                scrolled
                  ? "bg-black border-b border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.5)]"
                  : "bg-[#05090F]/25 border-b border-white/5",
                scrolled ? "h-[72px]" : "h-[88px]",
              ),
        )}
      >
        <div
          className={cn(
            "w-full mx-auto flex items-center justify-between",
            capsule ? "max-w-[1400px] px-6 md:px-10" : "max-w-[1200px] px-6",
          )}
        >
          {/* Logo — larger at the top of the page, shrinks on scroll */}
          <Link to="/" className="flex items-center group" aria-label="CityWide Digital — home">
            <LogoOnDark
              className={cn(
                "w-auto transition-all duration-300 ease-out group-hover:opacity-90",
                capsule ? "h-7" : scrolled ? "h-9" : "h-12",
              )}
            />
          </Link>

          {/* Desktop Nav */}
          <div className={cn("hidden items-center", capsule ? "md:flex gap-7" : "md:flex gap-8")}>
            {navLinks.map((link) => {
              const isActive = location.pathname === link.href;
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  data-active={capsule ? String(isActive) : undefined}
                  className={cn(
                    "transition-colors duration-120",
                    capsule
                      ? "cap-nav-link"
                      : cn(
                          "text-sm font-medium",
                          isActive
                            ? "text-[#0078D7]"
                            : "text-[rgba(238,241,250,0.7)] hover:text-[#EEF1FA]",
                        ),
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            {capsule ? (
              <>
                <a
                  href="https://calendly.com/alan-citywidedigital/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cap-nav-link"
                >
                  Book a demo
                </a>
                <Link to="/pricing" className="cap-btn px-4 py-2 text-[0.5625rem]">
                  Start trial
                </Link>
              </>
            ) : (
              <>
                <Button variant="ghost-dark" size="sm" asChild>
                  <a
                    href="https://calendly.com/alan-citywidedigital/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book a Demo
                  </a>
                </Button>
                <Button variant="on-dark" size="sm" asChild>
                  <Link to="/pricing">Get Started</Link>
                </Button>
              </>
            )}
            <ProfileMenu />
          </div>

          {/* Mobile: profile + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ProfileMenu />
            <button
              className={cn(
                "p-2 rounded-md transition-colors",
                capsule
                  ? "text-[var(--cap-ink-72)] hover:bg-white/10 hover:text-[var(--cap-ink)]"
                  : "text-[#EEF1FA] hover:bg-white/10",
              )}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      <div
        className={cn(
          "fixed inset-0 z-40 md:hidden transition-opacity duration-220",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
        {/* Drawer */}
        <div
          className={cn(
            "absolute top-0 right-0 h-full w-72 border-l p-6 pt-20 flex flex-col gap-2 transition-transform duration-220",
            capsule
              ? "bg-[#05070a] border-white/10"
              : "bg-[#0A1120] border-white/10",
            mobileOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          {navLinks.map((link) => {
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                  capsule
                    ? cn(
                        "cap-nav-link rounded-none border-b border-white/5 py-4",
                        isActive && "text-[var(--cap-ink)]",
                      )
                    : cn(
                        isActive
                          ? "bg-white/10 text-[#0078D7]"
                          : "text-[rgba(238,241,250,0.75)] hover:bg-white/10 hover:text-[#EEF1FA]",
                      ),
                )}
              >
                {link.label}
              </Link>
            );
          })}
          <div className={cn("mt-4 flex flex-col gap-3 pt-4 border-t", capsule ? "border-white/10" : "border-white/10")}>
            {capsule ? (
              <>
                <a
                  href="https://calendly.com/alan-citywidedigital/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cap-btn-ghost w-full"
                >
                  Book a demo
                </a>
                <Link to="/pricing" className="cap-btn w-full">
                  Start trial
                </Link>
              </>
            ) : (
              <>
                <Button variant="ghost-dark" asChild>
                  <a
                    href="https://calendly.com/alan-citywidedigital/30min"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book a Demo
                  </a>
                </Button>
                <Button variant="on-dark" asChild>
                  <Link to="/pricing">Get Started Free</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
