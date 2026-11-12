import { Link } from "react-router-dom";
import { MapPin, Mail, Phone, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";
import { LogoOnDark } from "@/components/branding/Logo";
import { cn } from "@/lib/utils";

const footerLinks = {
  Products: [
    { label: "GBP-Synced Websites", href: "/google-business-profile-website-sync.html", plain: true },
    { label: "GBP Website Builder", href: "/services#website-builder" },
    { label: "Social Sync Pro", href: "/services#social-sync" },
    { label: "Listing Sync Pro", href: "/services#listing-manager" },
    { label: "Review Engine", href: "/services#video-reviews" },
    { label: "Site Concierge", href: "/services#site-concierge" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Partner Program", href: "/contact" },
  ],
  Support: [
    { label: "Help Center", href: "/about#faq" },
    { label: "Book a Demo", href: "https://calendly.com/alan-citywidedigital/30min", external: true },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
  ],
};

interface FooterProps {
  /** "capsule" is used only by the landing page's HUD theme. */
  variant?: "default" | "capsule";
}

export default function Footer({ variant = "default" }: FooterProps) {
  const capsule = variant === "capsule";
  const linkClass = capsule ? "cap-footer-link" : "text-sm text-[rgba(238,241,250,0.55)] hover:text-[#0078D7] transition-colors";
  const headingClass = capsule
    ? "cap-footer-heading mb-4"
    : "text-[#EEF1FA] font-semibold text-sm mb-4 uppercase tracking-wider";

  return (
    <footer className={cn("border-t", capsule ? "bg-[#05070a] border-white/10" : "bg-[#0A1120] border-white/10")}>
      <div className={cn("mx-auto px-6", capsule ? "max-w-[1400px] py-16 md:py-20" : "max-w-[1200px] py-16")}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center mb-4" aria-label="CityWide Digital — home">
              <LogoOnDark size={capsule ? "sm" : "md"} />
            </Link>
            <p
              className={cn(
                "text-sm leading-relaxed mb-6 max-w-xs",
                capsule ? "text-[var(--cap-ink-55)] font-light" : "text-[rgba(238,241,250,0.6)]",
              )}
            >
              Managed digital presence for local businesses. Connect your Google Business Profile
              to everything — automatically.
            </p>
            <div
              className={cn(
                "flex flex-col gap-2 text-sm",
                capsule ? "text-[var(--cap-ink-55)]" : "text-[rgba(238,241,250,0.5)]",
              )}
            >
              <div className="flex items-center gap-2">
                <MapPin className={cn("w-3.5 h-3.5", capsule ? "text-[var(--cap-accent)]" : "text-[#0078D7]")} />
                <span>Serving businesses nationwide</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className={cn("w-3.5 h-3.5", capsule ? "text-[var(--cap-accent)]" : "text-[#0078D7]")} />
                <a href="mailto:alan@citywidedigital.ca" className="hover:text-[var(--cap-ink)] transition-colors">
                  alan@citywidedigital.ca
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className={cn("w-3.5 h-3.5", capsule ? "text-[var(--cap-accent)]" : "text-[#0078D7]")} />
                <a href="tel:+12508827378" className="hover:text-[var(--cap-ink)] transition-colors">
                  250-882-7378
                </a>
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className={headingClass}>{group}</h4>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {"plain" in link && link.plain ? (
                      <a href={link.href} className={linkClass}>
                        {link.label}
                      </a>
                    ) : "external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={linkClass}
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link to={link.href} className={linkClass}>
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className={cn(capsule ? "cap-mono text-[0.5625rem] text-[var(--cap-ink-24)]" : "text-xs text-[rgba(238,241,250,0.4)]")}>
            &copy; {new Date().getFullYear()} CityWide Digital. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className={cn(
                capsule ? "cap-footer-link text-xs" : "text-xs text-[rgba(238,241,250,0.4)] hover:text-[#0078D7] transition-colors",
              )}
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className={cn(
                capsule ? "cap-footer-link text-xs" : "text-xs text-[rgba(238,241,250,0.4)] hover:text-[#0078D7] transition-colors",
              )}
            >
              Terms of Service
            </Link>
            {[
              { icon: Facebook, href: "https://facebook.com" },
              { icon: Instagram, href: "https://instagram.com" },
              { icon: Linkedin, href: "https://linkedin.com" },
              { icon: Twitter, href: "https://twitter.com" },
            ].map(({ icon: Icon, href }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "w-8 h-8 border flex items-center justify-center transition-colors",
                  capsule
                    ? "rounded-full border-white/10 text-[var(--cap-ink-40)] hover:text-[var(--cap-ink)] hover:border-white/30"
                    : "rounded-lg border-white/10 text-[rgba(238,241,250,0.5)] hover:text-[#0078D7] hover:border-[#0078D7]/40",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
