import { useState } from "react";
import { UtensilsCrossed, Wrench, ShoppingBag, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const niches = [
  {
    id: "restaurant",
    label: "Restaurant",
    icon: UtensilsCrossed,
    headline: "A restaurant website that runs itself",
    description: "Your menu, hours, specials, and events sync directly from GMB. Customer reviews auto-display. New posts publish to your social channels the moment you post on Google.",
    features: ["Auto-sync menu from GMB", "Daily specials & events", "Review showcase", "Reservation CTA", "Social posts auto-published"],
    color: "bg-orange-50 border-orange-100",
    accentColor: "text-orange-600",
    badgeColor: "bg-orange-100 text-orange-700",
    preview: [
      { label: "Menu Items", value: "48", color: "text-orange-500" },
      { label: "Weekly Posts", value: "7", color: "text-orange-500" },
      { label: "Reviews Shown", value: "127", color: "text-orange-500" },
    ],
  },
  {
    id: "contractor",
    label: "Contractor",
    icon: Wrench,
    headline: "A contractor site that generates leads",
    description: "Services, service areas, photo galleries, and licensing info all pull from your GMB profile. Before/after photos, certifications, and quote requests are built in from day one.",
    features: ["Services list from GMB", "Service area map", "Photo portfolio gallery", "License & insurance badges", "Lead capture form"],
    color: "bg-blue-50 border-blue-100",
    accentColor: "text-primary",
    badgeColor: "bg-blue-100 text-primary",
    preview: [
      { label: "Services Listed", value: "12", color: "text-primary" },
      { label: "Project Photos", value: "64", color: "text-primary" },
      { label: "Monthly Leads", value: "18", color: "text-primary" },
    ],
  },
  {
    id: "retail",
    label: "Retail",
    icon: ShoppingBag,
    headline: "A retail store that sells while you sleep",
    description: "Products sync from Google Merchant Center and GMB. In-store hours, promotions, and inventory updates flow automatically. Every product page is SEO-optimized out of the box.",
    features: ["Product catalog from GMB + Merchant Center", "Auto-updated promotions", "In-store hours & map", "Customer review carousel", "SEO product pages"],
    color: "bg-purple-50 border-purple-100",
    accentColor: "text-purple-600",
    badgeColor: "bg-purple-100 text-purple-700",
    preview: [
      { label: "Products Synced", value: "340", color: "text-purple-600" },
      { label: "Active Promos", value: "5", color: "text-purple-600" },
      { label: "Organic Visitors", value: "2.4k/mo", color: "text-purple-600" },
    ],
  },
];

export default function NicheShowcase() {
  const [activeNiche, setActiveNiche] = useState("contractor");
  const niche = niches.find((n) => n.id === activeNiche)!;

  return (
    <section className="py-20 md:py-28 section-alt">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Industry Templates</p>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary leading-tight mb-4">
            Built for your industry, not just any business
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Each template shows exactly what your customers need to see — nothing more, nothing less.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {niches.map((n) => (
            <button
              key={n.id}
              onClick={() => setActiveNiche(n.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
                activeNiche === n.id
                  ? "bg-secondary text-[#EEF1FA] shadow-sm"
                  : "bg-white border border-border text-muted-foreground hover:text-secondary hover:border-secondary/30"
              )}
            >
              <n.icon className="w-4 h-4" />
              {n.label}
            </button>
          ))}
        </div>

        {/* Content Card */}
        <div className={cn("rounded-2xl border p-8 lg:p-10 transition-all duration-300", niche.color)}>
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <div className={cn("inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wider", niche.badgeColor)}>
                {niche.label} Template
              </div>
              <h3 className="text-2xl font-bold text-secondary mb-4">{niche.headline}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-6">{niche.description}</p>
              <ul className="space-y-2.5">
                {niche.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm font-medium text-secondary">
                    <CheckCircle className="w-4 h-4 text-[#22C55E] flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

            {/* Stats Preview */}
            <div className="bg-white rounded-2xl p-6 border border-white/80 shadow-sm">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-5">Live Dashboard Preview</div>
              <div className="grid grid-cols-3 gap-4 mb-6">
                {niche.preview.map((item) => (
                  <div key={item.label} className="text-center p-3 bg-background rounded-xl border border-border">
                    <div className={cn("text-2xl font-extrabold mb-1", item.color)}>{item.value}</div>
                    <div className="text-xs text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2.5">
                {["Website", "Social Channels", "Directories", "Reviews"].map((item) => (
                  <div key={item} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{item}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
                      <span className="text-[#22C55E] text-xs font-semibold">Live</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
