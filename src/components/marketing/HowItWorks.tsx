import { Link2, LayoutTemplate, Rocket } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Link2,
    title: "Connect Your Google Business Profile",
    description: "In minutes, we securely link your GMB account. All your business info, posts, menus, and products flow into CityWide Digital automatically.",
  },
  {
    step: "02",
    icon: LayoutTemplate,
    title: "Choose Your Niche Template",
    description: "Pick from Restaurant, Contractor, Retail, or other industry templates. Each is pre-configured with the exact GMB fields your customers care about.",
  },
  {
    step: "03",
    icon: Rocket,
    title: "Launch & Let It Run",
    description: "Your website goes live, your social channels stay active, and your directory listings stay accurate — all without touching a single thing.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 md:py-28 bg-background">
      <div className="max-w-[1200px] mx-auto px-6">
        <div className="text-center mb-14">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Simple Setup</p>
          <h2 className="text-3xl md:text-4xl font-bold text-secondary leading-tight mb-4">
            Live in 3 simple steps
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            No tech skills needed. No designers. No agencies. Just your Google account and 15 minutes.
          </p>
        </div>

        <div className="relative">
          {/* Connector line */}
          <div className="hidden lg:block absolute top-[52px] left-[calc(16.67%+32px)] right-[calc(16.67%+32px)] h-px bg-gradient-to-r from-transparent via-border to-transparent" />

          <div className="grid lg:grid-cols-3 gap-10 lg:gap-8">
            {steps.map((step, index) => (
              <div key={step.step} className="relative flex flex-col items-center text-center lg:items-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-[linear-gradient(135deg,#0078D7,#00447A)] flex items-center justify-center shadow-[0_4px_16px_rgba(0,120,215,0.3)]">
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-secondary text-[10px] font-bold text-[#EEF1FA] flex items-center justify-center border-2 border-background">
                    {index + 1}
                  </div>
                </div>
                <h3 className="text-xl font-bold text-secondary mb-3">{step.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
