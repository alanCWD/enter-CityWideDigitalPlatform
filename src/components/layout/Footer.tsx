import { Link } from "react-router-dom";
import { MapPin, Mail, Phone, Facebook, Instagram, Linkedin, X as XIcon, Globe, Share2, Video, Inbox, Megaphone, Activity, GraduationCap, type LucideIcon } from "lucide-react";
import { LogoOnDark } from "@/components/branding/Logo";
import AskAboutCityWide from "./AskAboutCityWide";
import { cn } from "@/lib/utils";

type FooterLink = {
  label: string;
  href: string;
  plain?: boolean;
  external?: boolean;
  icon?: LucideIcon;
  iconClass?: string;
};

const footerLinks: Record<string, FooterLink[]> = {
  Products: [
    { label: "Google Synced Website", href: "/services#website-builder", icon: Globe, iconClass: "text-[var(--product-website-icon)]" },
    { label: "Listing Sync Pro", href: "/services#listing-manager", icon: MapPin, iconClass: "text-[var(--product-listing-icon)]" },
    { label: "Social Sync Pro", href: "/services#social-sync", icon: Share2, iconClass: "text-[var(--product-social-icon)]" },
    { label: "Business Online Health", href: "/services#online-health", icon: Activity, iconClass: "text-[var(--footer-product-health)]" },
    { label: "Google Coach", href: "/services#google-coach", icon: GraduationCap, iconClass: "text-[var(--footer-product-coach)]" },
    { label: "Inbox Pro", href: "/services#inbox-pro", icon: Inbox, iconClass: "text-[var(--footer-product-inbox)]" },
    { label: "Review Engine", href: "/services#video-reviews", icon: Video, iconClass: "text-[var(--footer-product-review)]" },
    { label: "Creator Campaigns", href: "/services#creator-campaigns", icon: Megaphone, iconClass: "text-[var(--footer-product-creator)]" },
  ],
  Company: [
    { label: "About", href: "/about" },
    { label: "Crew", href: "/crew" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "Help Center", href: "/about#faq" },
    { label: "Book a Demo", href: "https://calendly.com/alan-citywidedigital/30min", external: true },
    { label: "Partner Program", href: "/contact" },
  ],
  Guides: [
    { label: "GBP synced websites", href: "/google-business-profile-website-sync.html", plain: true },
    { label: "GBP as source of truth", href: "/gbp-source-of-truth.html", plain: true },
    { label: "GBP local listing", href: "/gbp-local-listing.html", plain: true },
    { label: "Google posts and SEO", href: "/google-posts-and-local-seo.html", plain: true },
    { label: "AI search for local businesses", href: "/ai-search-local-businesses.html", plain: true },
    { label: "Inbox Pro", href: "/inbox" },
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

            <AskAboutCityWide variant={variant} />
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className={headingClass}>{group}</h4>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => {
                  const Icon = link.icon;
                  const content = (
                    <>
                      {Icon && (
                        <Icon
                          aria-hidden="true"
                          strokeWidth={1.5}
                          className={cn("h-4 w-4 shrink-0", link.iconClass ?? "text-[var(--footer-product-icon)]")}
                        />
                      )}
                      <span>{link.label}</span>
                    </>
                  );
                  const classes = cn(linkClass, Icon && "inline-flex items-center gap-2.5");
                  return (
                    <li key={link.label}>
                      {link.plain ? (
                        <a href={link.href} className={classes}>{content}</a>
                      ) : link.external ? (
                        <a href={link.href} target="_blank" rel="noopener noreferrer" className={classes}>
                          {content}
                        </a>
                      ) : (
                        <Link to={link.href} className={classes}>{content}</Link>
                      )}
                    </li>
                  );
                })}
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
            {[
              { icon: Facebook, href: "https://www.facebook.com/citywidedigital", label: "Facebook" },
              { icon: Instagram, href: "https://www.instagram.com/citywidedigital/", label: "Instagram" },
              { icon: Linkedin, href: "https://www.linkedin.com/company/citywidedigital/", label: "LinkedIn" },
              { icon: XIcon, href: "https://x.com/citywidedigita1", label: "X" },
            ].map(({ icon: Icon, href, label }) => (
              <a
                key={label}
                href={href}
                aria-label={`CityWide Digital on ${label}`}
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
