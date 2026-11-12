import { Globe, Share2, MapPin, Video, Settings, Check, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";

const services = [
  {
    id: "website-builder",
    icon: Globe,
    name: "GBP Website Builder",
    price: "from $197/mo",
    tagline: "A living website that keeps itself updated",
    description: "Most business websites go stale within weeks of launch. CityWide's GBP Website Builder solves that permanently. Your site is directly connected to your Google Business Profile — every new review or post, menu change, updated hour, or added product automatically reflects on your website.",
    features: [
      "Live sync with Google Business Profile",
      "Niche-specific templates (Restaurant, Contractor, Retail, and more)",
      "Google Merchant Center product sync",
      "Auto-publishing GMB posts to site",
      "SEO-optimized pages out of the box",
      "Mobile-first responsive design",
      "Custom domain support",
      "Monthly traffic & ranking reports",
    ],
    niches: ["Restaurants", "Contractors", "Retail Stores", "Salons & Spas", "Auto Services"],
  },
  {
    id: "social-sync",
    icon: Share2,
    name: "Social Sync Pro",
    price: "$47/mo",
    tagline: "Post once. Appear everywhere.",
    description: "Your customers live on multiple platforms. Keeping up with all of them is a full-time job — unless you have Social Sync Pro. Every post, event, offer, or product you publish on Google Business Profile is instantly reformatted and published to Facebook, Instagram, X (Twitter), and LinkedIn.",
    features: [
      "Auto-publish to Facebook, Instagram, X, LinkedIn",
      "Reformats content for each platform's best practices",
      "Posts, events, offers, and products all supported",
      "Publishing history and analytics dashboard",
      "Schedule future posts from one place",
      "Hashtag and caption optimization",
    ],
    niches: [],
  },
  {
    id: "listing-manager",
    icon: MapPin,
    name: "Listing Sync Pro",
    price: "$79/mo",
    tagline: "Accurate everywhere, always",
    description: "Wrong phone numbers, outdated addresses, and inconsistent business names kill your local search ranking. CityWide's Listing Sync Pro powered by our directory partnerships syncs your verified business data across 40+ major directories and actively monitors for unauthorized changes.",
    features: [
      "Sync to 40+ directories (Yelp, Apple Maps, Bing, and more)",
      "Suppress duplicate listings",
      "NAP consistency monitoring",
      "Alerts for unauthorized listing changes",
      "Holiday hours broadcasting",
      "Category and description optimization",
    ],
    niches: [],
  },
  {
    id: "video-reviews",
    icon: Video,
    name: "Review Engine",
    price: "$37/mo",
    tagline: "Turn happy customers into your best salespeople",
    description: "Our Review Engine makes it simple to solicit, collect, and display customer testimonials via SMS or email. Approved reviews are automatically embedded on your website's testimonial page.",
    features: [
      "SMS and email review request campaigns",
      "Mobile-friendly video recording interface",
      "Moderation dashboard to approve/reject",
      "Auto-embed approved videos on your site",
      "Integration with Google Reviews workflow",
      "Monthly review summary report",
    ],
    niches: [],
  },
  {
    id: "site-concierge",
    icon: Settings,
    name: "Site Concierge",
    price: "Pay-per-use",
    tagline: "Any change you need — just ask",
    description: "Need a new page, a photo gallery update, a seasonal banner, or a contact form tweak? Site Concierge is your on-demand website change service. Describe what you need in plain English to our AI-powered intake chatbot, and our team handles the rest.",
    features: [
      "AI chatbot intake — describe changes in plain English",
      "Design, copy, layout, and functionality changes",
      "No long-term contracts",
      "3-business-day turnaround on standard requests",
      "Photo editing and optimization included",
      "Included credits with Pro plan",
    ],
    niches: [],
  },
];

export default function Services() {
  return (
    <Layout variant="glass">
      <GlassHero
        kicker="02 / Products & Services"
        scene
        title="Every tool your business needs online"
        lede="Purpose-built tools that work better together. Use separately or bundle for complete digital coverage."
      >
        <Link to="/pricing#start-trial" className="gp-btn">
          Start free trial
        </Link>
        <Link to="/contact" className="gp-btn-ghost">
          Talk to sales
        </Link>
      </GlassHero>

      {services.map((service, index) => (
        <section key={service.id} id={service.id} className="gp-section scroll-mt-24">
          <div className="gp-shell">
            <article className="gp-panel gp-panel--hover overflow-hidden">
              <div className="grid gap-10 p-7 md:p-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
                <div>
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07]">
                      <service.icon className="h-5 w-5 text-[var(--gp-ice)]" strokeWidth={1.5} />
                    </span>
                    <span className="gp-kicker">
                      {String(index + 1).padStart(2, "0")} / {service.price}
                    </span>
                  </div>

                  <h2 className="gp-display mt-7 text-[clamp(1.7rem,3.2vw,2.5rem)]">{service.name}</h2>
                  <p className="mt-3 text-base font-light text-[var(--gp-ink)]">{service.tagline}</p>
                  <p className="gp-body mt-4 text-[15px]">{service.description}</p>

                  {service.id === "website-builder" && (
                    <a
                      href="/google-business-profile-website-sync.html"
                      className="mt-5 inline-flex items-center gap-2 border-b border-white/20 pb-1 font-mono text-[0.625rem] uppercase tracking-[0.2em] text-[var(--gp-ice)] transition-colors hover:border-white/50 hover:text-[var(--gp-ink)]"
                    >
                      What syncs, and how fast
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </a>
                  )}

                  <div className="mt-8 flex flex-wrap gap-3">
                    <Link to="/pricing#start-trial" className="gp-btn">
                      Start free trial <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link to="/contact" className="gp-btn-ghost">
                      Talk to sales
                    </Link>
                  </div>
                </div>

                <div className="gp-inset p-6 md:p-7">
                  <p className="gp-kicker">What's included</p>
                  <ul className="mt-5 space-y-3">
                    {service.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--gp-blue)]" strokeWidth={2} />
                        <span className="text-[13.5px] font-light leading-relaxed text-[var(--gp-ink-72)]">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {service.niches.length > 0 && (
                    <div className="mt-6 border-t border-white/10 pt-5">
                      <p className="gp-kicker mb-3">Supported industries</p>
                      <div className="flex flex-wrap gap-2">
                        {service.niches.map((n) => (
                          <span key={n} className="gp-chip">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </article>
          </div>
        </section>
      ))}

      <GlassCTA kicker="Next / Bundle" />
    </Layout>
  );
}
