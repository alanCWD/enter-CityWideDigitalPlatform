import { Globe, Share2, MapPin, Video, Settings, HeartHandshake } from "lucide-react";

const features = [
  {
    icon: Globe,
    title: "Auto-Updating Websites",
    description: "Your website syncs with Google Business Profile — menu, hours, posts, and products update automatically.",
  },
  {
    icon: Share2,
    title: "One-Click Social Sync",
    description: "Post once on Google. It instantly publishes to Facebook, Instagram, X, and LinkedIn.",
  },
  {
    icon: MapPin,
    title: "Listing Accuracy",
    description: "Your name, address, and phone number are corrected and kept consistent across 40+ major directories.",
  },
  {
    icon: Video,
    title: "Video Review Engine",
    description: "Solicit video testimonials via SMS/email. Approved reviews auto-embed on your testimonials page.",
  },
  {
    icon: Settings,
    title: "Niche-Specific Templates",
    description: "Restaurant, contractor, retail, and more — each template shows only what your customers need.",
  },
  {
    icon: HeartHandshake,
    title: "White-Glove Support",
    description: "Dedicated onboarding, monthly check-ins, and a real human to call when you need help.",
  },
];

export default function FeatureGrid() {
  return (
    <section className="py-20 md:py-28 section-alt">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Everything Included</p>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground leading-tight mb-4">
            One platform. Every digital channel.
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Stop juggling five tools. CityWide Digital handles your entire online presence for Small Businesses from a single dashboard.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-card rounded-2xl p-7 border border-border card-shadow hover:card-shadow-hover hover:-translate-y-1 hover:border-primary/30 transition-all duration-200 group"
            >
              <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-5 group-hover:bg-primary group-hover:shadow-[0_4px_12px_rgba(0,120,215,0.25)] transition-all duration-200">
                <feature.icon className="w-6 h-6 text-primary group-hover:text-primary-foreground transition-colors duration-200" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
