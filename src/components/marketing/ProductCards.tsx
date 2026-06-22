import { Link } from "react-router-dom";
import { Globe, Share2, MapPin, Video, Settings, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const products = [
  {
    icon: Globe,
    name: "Smart Website Builder",
    tagline: "A living website that updates itself",
    price: "from $97/mo",
    badge: "Most Popular",
    featured: true,
    description: "GMB-integrated, niche-specific, SEO-ready website that updates automatically when your Google profile changes.",
    href: "/services#website-builder",
  },
  {
    icon: Share2,
    name: "Social Sync Pro",
    tagline: "Post once, publish everywhere",
    price: "$47/mo",
    badge: null,
    featured: false,
    description: "One Google post becomes four social posts. Facebook, Instagram, X, and LinkedIn — all at once, automatically.",
    href: "/services#social-sync",
  },
  {
    icon: MapPin,
    name: "Listing Manager",
    tagline: "Accurate everywhere, always",
    price: "$79/mo",
    badge: null,
    featured: false,
    description: "Sync and protect your business info across 40+ directories including Yelp, Apple Maps, and Bing Places.",
    href: "/services#listing-manager",
  },
  {
    icon: Video,
    name: "Review Engine",
    tagline: "Turn customers into advocates",
    price: "$37/mo",
    badge: null,
    featured: false,
    description: "Collect customer testimonials via SMS/email. Approved reviews auto-embed on your site's testimonials page.",
    href: "/services#video-reviews",
  },
  {
    icon: Settings,
    name: "Site Concierge",
    tagline: "Changes on demand, no contract",
    price: "Pay-per-use",
    badge: "Add-On",
    featured: false,
    description: "Chat with our AI assistant to request any website change — photos, copy, sections, or integrations.",
    href: "/services#site-concierge",
  },
];

export default function ProductCards() {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Our Products</p>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary leading-tight mb-4">
            Pick the tools you need
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Use them individually or bundle for maximum savings. Every product integrates seamlessly.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.map((product) => (
            <div
              key={product.name}
              className={
                product.featured
                  ? "relative rounded-2xl p-7 bg-[#1B2A4A] border-2 border-primary shadow-[0_8px_32px_rgba(0,120,215,0.2)] flex flex-col"
                  : "relative rounded-2xl p-7 bg-white border border-border card-shadow hover:card-shadow-hover hover:-translate-y-1 hover:border-primary/30 transition-all duration-200 flex flex-col"
              }
            >
              {product.badge && (
                <Badge
                  variant={product.featured ? "featured" : "subtle"}
                  className="absolute top-4 right-4 text-[10px]"
                >
                  {product.badge}
                </Badge>
              )}

              <div className={
                product.featured
                  ? "w-12 h-12 rounded-xl bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center mb-5 shadow-[0_4px_12px_rgba(0,120,215,0.4)]"
                  : "w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-5"
              }>
                <product.icon className={product.featured ? "w-6 h-6 text-white" : "w-6 h-6 text-primary"} />
              </div>

              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary">
                {product.price}
              </div>
              <h3 className={`text-xl font-bold mb-2 ${product.featured ? "text-[#EEF1FA]" : "text-secondary"}`}>
                {product.name}
              </h3>
              <p className={`text-sm mb-1 font-medium ${product.featured ? "text-[rgba(238,241,250,0.8)]" : "text-foreground"}`}>
                {product.tagline}
              </p>
              <p className={`text-sm leading-relaxed mb-6 flex-1 ${product.featured ? "text-[rgba(238,241,250,0.6)]" : "text-muted-foreground"}`}>
                {product.description}
              </p>

              <Link
                to={product.href}
                className={`inline-flex items-center gap-1 text-sm font-semibold transition-colors ${
                  product.featured ? "text-primary hover:text-[#5BB8FF]" : "text-primary hover:text-[#00447A]"
                }`}
              >
                Learn more <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ))}

          {/* View All CTA card */}
          <div className="rounded-2xl p-7 bg-[linear-gradient(135deg,#0A1120,#1B2A4A)] border border-white/10 flex flex-col items-start justify-between">
            <div>
              <div className="text-sm font-semibold text-[rgba(238,241,250,0.5)] uppercase tracking-wider mb-3">All Inclusive</div>
              <h3 className="text-xl font-bold text-[#EEF1FA] mb-3">Get everything in Pro</h3>
              <p className="text-sm text-[rgba(238,241,250,0.6)] leading-relaxed">
                Website + Social Sync + Listing Manager + Review Engine + Site Concierge credits. One price. Maximum impact.
              </p>
            </div>
            <Button variant="on-dark" size="sm" className="mt-6" asChild>
              <Link to="/pricing">View All Plans <ArrowRight className="w-4 h-4" /></Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
