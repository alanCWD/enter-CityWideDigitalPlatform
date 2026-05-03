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

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();

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
          // At the top: very subtle dark veil so the hero animation reads clearly
          // through the navbar. On scroll: solid black.
          scrolled
            ? "bg-black border-b border-white/10 shadow-[0_2px_20px_rgba(0,0,0,0.5)]"
            : "bg-[#05090F]/25 border-b border-white/5",
          scrolled ? "h-[72px]" : "h-[88px]",
        )}
      >
        <div className="max-w-[1200px] w-full mx-auto px-6 flex items-center justify-between">
          {/* Logo — 2x at the top of the page, smoothly shrinks to 1.5x on scroll */}
          <Link to="/" className="flex items-center group" aria-label="CityWide Digital — home">
            <LogoOnDark
              className={cn(
                "w-auto transition-all duration-300 ease-out group-hover:opacity-90",
                scrolled ? "h-9" : "h-12",
              )}
            />
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  "text-sm font-medium transition-colors duration-120",
                  location.pathname === link.href
                    ? "text-[#0078D7]"
                    : "text-[rgba(238,241,250,0.7)] hover:text-[#EEF1FA]"
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost-dark" size="sm" asChild>
              <Link to="/contact">Book a Demo</Link>
            </Button>
            <Button variant="on-dark" size="sm" asChild>
              <Link to="/pricing">Get Started</Link>
            </Button>
            <ProfileMenu />
          </div>

          {/* Mobile: profile + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <ProfileMenu />
            <button
              className="p-2 rounded-md text-[#EEF1FA] hover:bg-white/10 transition-colors"
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
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={() => setMobileOpen(false)}
        />
        {/* Drawer */}
        <div
          className={cn(
            "absolute top-0 right-0 h-full w-72 bg-[#0A1120] border-l border-white/10 p-6 pt-20 flex flex-col gap-2 transition-transform duration-220",
            mobileOpen ? "translate-x-0" : "translate-x-full"
          )}
        >
          {navLinks.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className={cn(
                "px-4 py-3 rounded-lg text-sm font-medium transition-colors",
                location.pathname === link.href
                  ? "bg-white/10 text-[#0078D7]"
                  : "text-[rgba(238,241,250,0.75)] hover:bg-white/10 hover:text-[#EEF1FA]"
              )}
            >
              {link.label}
            </Link>
          ))}
          <div className="mt-4 flex flex-col gap-3 pt-4 border-t border-white/10">
            <Button variant="ghost-dark" asChild>
              <Link to="/contact">Book a Demo</Link>
            </Button>
            <Button variant="on-dark" asChild>
              <Link to="/pricing">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
