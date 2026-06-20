import { Target, Users, Lightbulb, Shield, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import Layout from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import CTABanner from "@/components/marketing/CTABanner";

const values = [
  {
    icon: Target,
    title: "Results Over Complexity",
    description: "We believe great technology should simplify your life, not add more to your plate. Every feature we build has one goal: make local businesses more visible with less effort.",
  },
  {
    icon: Users,
    title: "Small Businesses Deserve Enterprise Tools",
    description: "Large chains have dedicated marketing teams. We level the playing field by giving independent businesses the same digital infrastructure — at a fraction of the cost.",
  },
  {
    icon: Lightbulb,
    title: "Built on Real Insights",
    description: "Our tools are built from thousands of conversations with restaurant owners, contractors, and retailers. We understand your problems because we've listened to them.",
  },
  {
    icon: Shield,
    title: "Your Data, Protected",
    description: "We're transparent about how we use your business data. We never sell it, and we never lock you in. Your information is yours, always.",
  },
];

const team = [
  { name: "Alex Rivera", role: "Co-Founder & CEO", initials: "AR", bg: "bg-[#0078D7]" },
  { name: "Priya Nair", role: "Co-Founder & CTO", initials: "PN", bg: "bg-[#00447A]" },
  { name: "Jordan Chase", role: "Head of Product", initials: "JC", bg: "bg-primary" },
  { name: "Maria Santos", role: "Head of Customer Success", initials: "MS", bg: "bg-[#0078D7]" },
  { name: "Derek Wu", role: "Lead Engineer", initials: "DW", bg: "bg-[#00447A]" },
  { name: "Tanya Osei", role: "Head of Partnerships", initials: "TO", bg: "bg-primary" },
];

export default function About() {
  return (
    <Layout>
      {/* Hero — extends behind the fixed navbar like the home hero */}
      <section className="bg-[linear-gradient(135deg,#0A1120_0%,#1B2A4A_100%)] -mt-[88px] pt-[128px] pb-20 md:pt-[152px] md:pb-28">
        <div className="max-w-[1200px] mx-auto px-6 text-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">Our Story</p>
          <h1 className="text-4xl md:text-5xl font-extrabold text-[#EEF1FA] mb-5 leading-tight text-balance">
            We built CityWide because local businesses deserve better
          </h1>
          <p className="text-lg text-[rgba(238,241,250,0.7)] max-w-2xl mx-auto">
            Every local business owner we've ever met has the same problem: not enough time, not enough budget, and too many digital tools to manage.
          </p>
        </div>
      </section>

      {/* Story Section */}
      <section className="py-20 md:py-28 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-3xl font-bold text-foreground mb-6">The problem we saw everywhere</h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  We spent years working with hundreds of small businesses across the country — restaurants, roofers, boutiques, salons. The same story repeated over and over: they had a Google Business Profile that was more or less up to date, but their website was outdated, their directory listings had the wrong phone number, and their social pages went silent for weeks at a time.
                </p>
                <p>
                  None of these owners were lazy. They were busy running their businesses. The problem wasn't effort — it was that managing a digital presence across five different platforms is a part-time job nobody signed up for.
                </p>
                <p>
                  So we built CityWide Digital. One platform that uses the data you already maintain on Google to keep your entire digital presence up to date — automatically.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-5">
              {[
                { value: "2021", label: "Founded" },
                { value: "2,400+", label: "Businesses served" },
                { value: "40+", label: "Directories synced" },
                { value: "4.9★", label: "Avg. customer rating" },
              ].map((stat) => (
                <div key={stat.label} className="bg-accent rounded-2xl p-6 border border-border text-center">
                  <div className="text-3xl font-extrabold text-primary mb-1">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20 md:py-28 section-alt">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-4">What we stand for</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Four principles guide every decision we make.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((v) => (
              <div key={v.title} className="bg-card rounded-2xl p-6 border border-border card-shadow">
                <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center mb-5">
                  <v.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="py-20 md:py-28 bg-background">
        <div className="max-w-[1200px] mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl font-bold text-foreground mb-4">The team behind CityWide</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              A small, focused team that's deeply invested in local business success.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {team.map((member) => (
              <div key={member.name} className="flex items-center gap-4 bg-card rounded-2xl p-5 border border-border card-shadow">
                <div className={`w-14 h-14 rounded-2xl ${member.bg} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                  {member.initials}
                </div>
                <div>
                  <div className="font-bold text-foreground">{member.name}</div>
                  <div className="text-sm text-muted-foreground">{member.role}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">Interested in joining the team?</p>
            <Button variant="outline" asChild>
              <Link to="/contact">
                Get in touch <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <CTABanner />
    </Layout>
  );
}
