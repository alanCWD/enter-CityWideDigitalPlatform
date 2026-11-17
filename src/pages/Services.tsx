import type { CSSProperties } from "react";
import { Globe, Share2, MapPin, Video, Settings, Megaphone, Activity, Check, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { GlassHero } from "@/components/marketing/glass/GlassHero";
import { GlassCTA } from "@/components/marketing/glass/GlassCTA";

type Service = {
  id: string;
  icon: LucideIcon;
  name: string;
  price: string;
  tagline: string;
  description: string;
  features: string[];
  niches: string[];
  /** Set on panels that stand for one of our own apps. Each app gets its own colour. */
  app?: {
    /** Space-separated RGB channels of the app colour. */
    rgb: string;
    /** Light tint for the icon stroke. */
    ink: string;
    /** Where "Explore" sends the visitor. */
    href: string;
    action?: { label: string; href: string };
  };
};

const services: Service[] = [
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
    app: {
      rgb: "246 94 94",
      ink: "#ffc4bc",
      href: "https://review-engine.citywidedigital.ca/",
    },
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
  {
    id: "creator-campaigns",
    icon: Megaphone,
    name: "Creator Campaigns",
    price: "from $1,800 CAD/mo + GST",
    tagline: "Your next customer is already scrolling",
    description: "Put your business in front of new customers with content from vetted creators. Choose a campaign, approve your creator shortlist, and follow platform-verified views in your client portal.",
    features: [
      "Vetted creators matched to your business",
      "Monthly campaign packages and creator briefs",
      "Creator shortlist approved before your campaign starts",
      "Content across Instagram, TikTok, and YouTube, depending on package",
      "Platform-verified views and engagement reporting",
      "Human review before creator payment",
    ],
    niches: [],
    app: {
      rgb: "239 190 65",
      ink: "#ffe6a2",
      href: "https://creator-campaigns.citywidedigital.ca/",
      action: { label: "Order a campaign", href: "https://creator-campaigns.citywidedigital.ca/order" },
    },
  },
  {
    id: "online-health",
    icon: Activity,
    name: "Business Online Health",
    price: "CityWide plans from $197/mo",
    tagline: "See your business online the way customers do",
    description: "Compare your Google Business Profile, website, directories, and reviews against your confirmed business details, then see what needs attention and how to address it.",
    features: [
      "A health score with clearly stated coverage",
      "Directory comparisons against confirmed business details",
      "Prioritized fixes with owners and next steps",
      "Review request and response guidance",
      "Evidence behind findings and rechecks of fixes",
      "Read-only assessment — no listings changed automatically",
    ],
    niches: [],
    app: {
      rgb: "80 195 135",
      ink: "#b5f3cf",
      href: "https://online-health.citywidedigital.ca/",
      action: { label: "Order a campaign", href: "https://creator-campaigns.citywidedigital.ca/order" },
    },
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

      {services.map((service, index) => {
        const app = service.app;
        return (
          <section key={service.id} id={service.id} className="gp-section scroll-mt-24">
            <div className="gp-shell">
              <article
                className={`gp-panel gp-panel--hover overflow-hidden${app ? " gp-panel--app" : ""}`}
                style={
                  app
                    ? ({ "--gp-app-rgb": app.rgb, "--gp-app-ink": app.ink } as CSSProperties)
                    : undefined
                }
              >
                <div className="grid gap-10 p-7 md:p-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-14">
                  <div>
                    <div className="flex items-center gap-4">
                      <span className="gp-icon-tile flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.07]">
                        <service.icon
                          className="h-5 w-5"
                          style={{ color: app ? "var(--gp-app-ink)" : "var(--gp-ice)" }}
                          strokeWidth={1.5}
                        />
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
                      {app ? (
                        <>
                          <a
                            href={app.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gp-btn-ghost gp-btn-ghost--app"
                          >
                            Explore <ArrowUpRight className="h-3.5 w-3.5" />
                          </a>
                          {app.action ? (
                            <a href={app.action.href} target="_blank" rel="noopener noreferrer" className="gp-btn gp-btn--app">
                              {app.action.label}
                            </a>
                          ) : (
                            <Link to="/pricing#start-trial" className="gp-btn gp-btn--app">
                              Start free trial
                            </Link>
                          )}
                        </>
                      ) : (
                        <>
                          <Link to="/pricing#start-trial" className="gp-btn">
                            Start free trial <ArrowUpRight className="h-3.5 w-3.5" />
                          </Link>
                          <Link to="/contact" className="gp-btn-ghost">
                            Talk to sales
                          </Link>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="gp-inset p-6 md:p-7">
                    <p className="gp-kicker">What's included</p>
                    <ul className="mt-5 space-y-3">
                      {service.features.map((f) => (
                        <li key={f} className="flex items-start gap-3">
                          <Check className="gp-check mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[var(--gp-blue)]" strokeWidth={2} />
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
        );
      })}

      <GlassCTA kicker="Next / Bundle" />
    </Layout>
  );
}
