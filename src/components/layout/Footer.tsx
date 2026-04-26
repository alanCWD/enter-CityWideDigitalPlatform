import { Link } from "react-router-dom";
import { Zap, MapPin, Mail, Phone, Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

const footerLinks = {
  Products: [
    { label: "Website Builder", href: "/services#website-builder" },
    { label: "Social Sync Pro", href: "/services#social-sync" },
    { label: "Listing Manager", href: "/services#listing-manager" },
    { label: "Video Reviews", href: "/services#video-reviews" },
    { label: "Site Concierge", href: "/services#site-concierge" },
  ],
  Company: [
    { label: "About Us", href: "/about" },
    { label: "Pricing", href: "/pricing" },
    { label: "Contact", href: "/contact" },
    { label: "GSO Coach Tool", href: "https://gso-coach.replit.app", external: true },
    { label: "Partner Program", href: "/contact" },
  ],
  Support: [
    { label: "Help Center", href: "/contact" },
    { label: "Book a Demo", href: "/contact" },
    { label: "Privacy Policy", href: "/contact" },
    { label: "Terms of Service", href: "/contact" },
  ],
};

export default function Footer() {
  return (
    <footer className="bg-[#0A1120] border-t border-white/10">
      <div className="max-w-[1200px] mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Column */}
          <div className="lg:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-[#EEF1FA] font-bold text-lg tracking-tight">
                CityWide<span className="text-[#0078D7]"> Digital</span>
              </span>
            </Link>
            <p className="text-[rgba(238,241,250,0.6)] text-sm leading-relaxed mb-6 max-w-xs">
              Managed digital presence for local businesses. Connect your Google Business Profile 
              to everything — automatically.
            </p>
            <div className="flex flex-col gap-2 text-sm text-[rgba(238,241,250,0.5)]">
              <div className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-[#0078D7]" />
                <span>Serving businesses nationwide</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-[#0078D7]" />
                <a href="mailto:hello@citywideDigital.com" className="hover:text-[#EEF1FA] transition-colors">
                  hello@citywideDigital.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#0078D7]" />
                <a href="tel:+18005550100" className="hover:text-[#EEF1FA] transition-colors">
                  1-800-555-0100
                </a>
              </div>
            </div>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([group, links]) => (
            <div key={group}>
              <h4 className="text-[#EEF1FA] font-semibold text-sm mb-4 uppercase tracking-wider">
                {group}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-[rgba(238,241,250,0.55)] hover:text-[#0078D7] transition-colors"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        to={link.href}
                        className="text-sm text-[rgba(238,241,250,0.55)] hover:text-[#0078D7] transition-colors"
                      >
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
          <p className="text-xs text-[rgba(238,241,250,0.4)]">
            &copy; {new Date().getFullYear()} CityWide Digital. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
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
                className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-[rgba(238,241,250,0.5)] hover:text-[#0078D7] hover:border-[#0078D7]/40 transition-all"
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
