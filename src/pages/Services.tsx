import { Globe, Share2, MapPin, Video, Settings, CheckCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import CTABanner from "@/components/marketing/CTABanner";

const services = [
  {
    id: "website-builder",
    icon: Globe,
    name: "Smart Website Builder",
    price: "from $97/mo",
    tagline: "A living website that keeps itself updated",
    description: "Most business websites go stale within weeks of launch. CityWide's Smart Website Builder solves that permanently. Your site is directly connected to your Google Business Profile — every menu change, new post, updated hour, or added product automatically reflects on your website within minutes.",
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
    niches: ["Restaurants", "Contractors", "Retail Stores", "Healthcare", "Salons & Spas", "Auto Services"],
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
    name: "Listing Manager",
    price: "$79/mo",
    tagline: "Accurate everywhere, always",
    description: "Wrong phone numbers, outdated addresses, and inconsistent business names kill your local search ranking. CityWide's Listing Manager powered by our directory partnerships syncs your verified business data across 40+ major directories and actively monitors for unauthorized changes.",
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
    <Layout>
      {/* Page Hero */}
      <section className="bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_100%)] -mt-[88px] pt-[128px] pb-20 md:pt-[152px] md:pb-28">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Our Products</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#EEF1FA] mb-5 leading-tight">
            Every tool your business needs online
          </h1>
          <p className="text-lg text-[rgba(238,241,250,0.7)] max-w-xl mx-auto">
            Five purpose-built tools that work better together. Use one or bundle all five for complete digital coverage.
          </p>
        </div>
      </section>

      {/* Service Detail Sections */}
      {services.map((service, index) => (
        <section
          key={service.id}
          id={service.id}
          className={`py-20 md:py-28 ${index % 2 === 0 ? "bg-background" : "section-alt"}`}
        >
          <div className="max-w-[1200px] mx-auto px-6">
            <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className={index % 2 !== 0 ? "lg:order-2" : ""}>
                <div className="w-14 h-14 rounded-2xl bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center mb-6 shadow-[0_4px_16px_rgba(0,120,215,0.3)]">
                  <service.icon className="w-7 h-7 text-white" />
                </div>
                <div className="text-xs font-bold text-primary uppercase tracking-widest mb-2">{service.price}</div>
                <h2 className="text-3xl font-extrabold text-foreground mb-3">{service.name}</h2>
                <p className="text-lg font-medium text-foreground mb-4">{service.tagline}</p>
                <p className="text-muted-foreground leading-relaxed mb-8">{service.description}</p>

                <div className="flex gap-3">
                  <Button asChild>
                    <Link to="/pricing">Start Free Trial <ArrowRight className="w-4 h-4" /></Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/contact">Talk to Sales</Link>
                  </Button>
                </div>
              </div>

              <div className={index % 2 !== 0 ? "lg:order-1" : ""}>
                <div className="bg-card rounded-2xl p-8 border border-border card-shadow">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-wider mb-5">What's Included</h4>
                  <ul className="space-y-3">
                    {service.features.map((f) => (
                      <li key={f} className="flex items-start gap-3">
                        <CheckCircle className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-foreground leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {service.niches.length > 0 && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <h4 className="text-xs font-bold text-foreground uppercase tracking-wider mb-3">Supported Industries</h4>
                      <div className="flex flex-wrap gap-2">
                        {service.niches.map((n) => (
                          <span key={n} className="text-xs bg-accent text-accent-foreground rounded-full px-3 py-1 font-medium">
                            {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ))}

      <CTABanner />
    </Layout>
  );
}
